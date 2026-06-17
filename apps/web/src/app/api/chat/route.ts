import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { callAiProxyStream, estimateTokens } from "@/lib/ai-proxy";
import { buildTriggeredLive2DEffects } from "@/lib/chat-effects";
import { enforceChatOutputSafety, enforceChatSafety, isChatSafetyError } from "@/lib/chat-safety";
import { deductSuccessfulChatQuota } from "@/lib/fan-code-service";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { jsonError, parseBody } from "@/lib/request";
import { recordChatSafetyEvent } from "@/lib/safety-events";

const schema = z.object({
  viewerSessionId: z.string().min(1),
  message: z.string().min(1).max(10000),
  recentMessages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(20)
    .default([]),
});

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { key: "chat", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const body = await parseBody(request, schema);
    const runtime = await getPlatformRuntimeSettings();

    let userMessage: string;
    try {
      userMessage = enforceChatSafety(body.message, {
        contentModeration: runtime.contentModeration,
        maxFanMessageLength: runtime.maxFanMessageLength,
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

    const viewerSession = await prisma.viewerSession.findUniqueOrThrow({
      where: { id: body.viewerSessionId },
      include: {
        fanAccessCode: true,
        project: {
          include: {
            creator: { select: { id: true, status: true } },
            triggerTags: { where: { enabled: true }, orderBy: { priority: "desc" } },
          },
        },
      },
    });

    const project = viewerSession.project;
    const code = viewerSession.fanAccessCode;
    const now = new Date();

    if (project.status !== "published") {
      return NextResponse.json({ error: "Project is not published" }, { status: 403 });
    }
    if (project.creator.status !== "active") {
      return NextResponse.json({ error: "Creator account is not active" }, { status: 403 });
    }
    if (code.status !== "active" || code.expiresAt <= now) {
      return NextResponse.json({ error: "Access code is expired or revoked" }, { status: 403 });
    }
    if (code.usedMessages >= code.maxMessages) {
      return NextResponse.json({ error: "Access code quota is exhausted" }, { status: 403 });
    }

    const enabledTags = project.triggerTags.map((tag) => ({
      name: tag.name,
      description: tag.description,
      keywords: tag.keywords,
      promptFragment: tag.promptFragment,
    }));

    const aiStream = await callAiProxyStream({
      systemPrompt: project.systemPrompt,
      enabledTags,
      recentMessages: body.recentMessages,
      userMessage,
      aiProvider: runtime.aiProvider,
      chatModel: runtime.aiChatModel,
    });

    const encoder = new TextEncoder();
    const sse = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = aiStream.getReader();
        const send = (payload: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const payload = JSON.parse(value) as
              | { type: "content"; content: string }
              | { type: "done"; reply: string; tags: string[] };

            if (payload.type === "content") {
              send({ type: "content", content: payload.content });
              continue;
            }

            // finalise: output safety, effects, quota deduction
            let safeReply = payload.reply;
            try {
              safeReply = enforceChatOutputSafety(payload.reply, { contentModeration: runtime.contentModeration });
            } catch {
              safeReply = "我先不回答这个，我们聊点别的好吗？";
            }
            const tags = payload.tags ?? [];
            const live2dEffects = buildTriggeredLive2DEffects({ tags, triggerTags: project.triggerTags });

            let remainingMessages = code.maxMessages - code.usedMessages - 1;
            try {
              await prisma.$transaction((tx) =>
                deductSuccessfulChatQuota(tx, {
                  creatorId: project.creator.id,
                  projectId: project.id,
                  fanAccessCodeId: code.id,
                  tokenEstimate: estimateTokens(`${userMessage}\n${safeReply}`),
                }),
              );
              const fresh = await prisma.fanAccessCode.findUnique({
                where: { id: code.id },
                select: { usedMessages: true, maxMessages: true },
              });
              if (fresh) remainingMessages = fresh.maxMessages - fresh.usedMessages;
            } catch {
              // quota race or exhaustion after generation — keep optimistic estimate
            }

            send({ type: "done", reply: safeReply, tags, live2dEffects, remainingMessages });
          }
        } catch (error) {
          controller.error(error);
          return;
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(sse, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return jsonError(error, "Chat failed");
  }
}
