import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { callAiProxyStream, estimateTokens } from "@/lib/ai-proxy";
import { buildTriggeredLive2DEffects } from "@/lib/chat-effects";
import { enforceChatSafety, enforceChatOutputSafety, isChatSafetyError } from "@/lib/chat-safety";
import { deductSuccessfulChatQuota } from "@/lib/fan-code-service";
import { logEvent, recordApiRequest } from "@/lib/metrics";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { jsonError, parseBody } from "@/lib/request";
import { recordChatSafetyEvent } from "@/lib/safety-events";

const requestSchema = z.object({
  viewerSessionId: z.string().min(1),
  message: z.string().min(1).max(10000),
  recentMessages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(20).default([]),
});

export async function POST(request: NextRequest) {
  const startedAt = performance.now();
  const limited = await rateLimit(request, { key: "chat", limit: 20, windowMs: 60_000 });
  if (limited) {
    recordApiRequest({ route: "/api/chat", method: "POST", status: 429, durationMs: performance.now() - startedAt });
    return limited;
  }

  try {
    const body = await parseBody(request, requestSchema);
    const runtimeSettings = await getPlatformRuntimeSettings();
    let userMessage: string;
    try {
      userMessage = enforceChatSafety(body.message, {
        contentModeration: runtimeSettings.contentModeration,
        maxFanMessageLength: runtimeSettings.maxFanMessageLength,
      });
    } catch (error) {
      if (isChatSafetyError(error)) {
        await recordChatSafetyEvent({
          viewerSessionId: body.viewerSessionId,
          message: body.message,
          error,
          ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
        });
      }
      throw error;
    }
    // Step 1: Validate session, access code, and plan — plain read, no transaction needed.
    // This releases the DB connection immediately instead of holding it during the AI call.
    const viewerSession = await prisma.viewerSession.findUniqueOrThrow({
      where: { id: body.viewerSessionId },
      include: {
        fanAccessCode: true,
        project: {
          include: {
            creator: {
              select: { status: true },
            },
            triggerTags: {
              where: { enabled: true },
              orderBy: { priority: "desc" },
            },
          },
        },
      },
    });

    if (viewerSession.project.status !== "published" && viewerSession.fanAccessCode.batchId !== "preview") {
      throw new Error("Project is not published");
    }
    if (viewerSession.project.creator.status !== "active") {
      throw new Error("Creator account is not active");
    }
    if (viewerSession.fanAccessCode.status !== "active" || viewerSession.fanAccessCode.expiresAt <= new Date()) {
      throw new Error("Access code is expired or revoked");
    }
    if (viewerSession.fanAccessCode.usedMessages >= viewerSession.fanAccessCode.maxMessages) {
      throw new Error("Access code message quota is exhausted");
    }

    const plan = await prisma.creatorPlan.findUniqueOrThrow({
      where: { creatorId: viewerSession.project.creatorId },
    });
    if (plan.status !== "active" || plan.expiresAt <= new Date() || plan.usedAiMessages >= plan.monthlyAiMessageLimit) {
      throw new Error("Creator AI quota is not available");
    }

    // Step 2: Call AI proxy stream — no DB connection held during the AI response.
    const aiStream = await callAiProxyStream({
      systemPrompt: viewerSession.project.systemPrompt,
      enabledTags: viewerSession.project.triggerTags.map((tag) => ({
        name: tag.name,
        description: tag.description,
        keywords: tag.keywords,
        promptFragment: tag.promptFragment,
      })),
      recentMessages: body.recentMessages,
      userMessage,
      aiProvider: runtimeSettings.aiProvider,
      chatModel: runtimeSettings.aiChatModel,
    });

    const responseStream = new ReadableStream({
      async start(controller) {
        const reader = aiStream.getReader();
        let replyText = "";
        let tags: string[] = [];

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const payload = JSON.parse(value);
            if (payload.type === "content") {
              replyText += payload.content;
              controller.enqueue(`data: ${JSON.stringify({ type: "content", content: payload.content })}\n\n`);
            } else if (payload.type === "done") {
              tags = payload.tags;
            }
          }

          enforceChatOutputSafety(replyText, {
            contentModeration: runtimeSettings.contentModeration,
          });

          // Step 3: Atomic quota deduction — short transaction, completes in <50ms.
          const quota = await prisma.$transaction(async (tx) => {
            return deductSuccessfulChatQuota(tx, {
              creatorId: viewerSession.project.creatorId,
              projectId: viewerSession.projectId,
              fanAccessCodeId: viewerSession.fanAccessCodeId,
              tokenEstimate: estimateTokens(`${userMessage}\n${replyText}`),
            });
          });

          const live2dEffects = buildTriggeredLive2DEffects({
            tags,
            triggerTags: viewerSession.project.triggerTags,
          });

          controller.enqueue(
            `data: ${JSON.stringify({
              type: "done",
              tags,
              live2dEffects,
              remainingMessages: quota.remainingMessages,
            })}\n\n`
          );
          controller.enqueue("data: [DONE]\n\n");
        } catch (err) {
          console.error("Stream error:", err);
          controller.enqueue(`data: ${JSON.stringify({ type: "error", error: err instanceof Error ? err.message : "Stream error" })}\n\n`);
        } finally {
          controller.close();
        }
      },
    });

    recordApiRequest({ route: "/api/chat", method: "POST", status: 200, durationMs: performance.now() - startedAt });
    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    logEvent("warn", "chat_failed", { error: error instanceof Error ? error.message : "Unknown failure" });
    recordApiRequest({ route: "/api/chat", method: "POST", status: 400, durationMs: performance.now() - startedAt });
    return jsonError(error, "Chat failed");
  }
}
