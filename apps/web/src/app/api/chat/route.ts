import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { callAiProxy } from "@/lib/ai-proxy";
import { buildTriggeredLive2DEffects, buildTriggeredVoiceAssets } from "@/lib/chat-effects";
import { deductSuccessfulChatQuota } from "@/lib/fan-code-service";
import { logEvent, recordApiRequest } from "@/lib/metrics";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { jsonError, parseBody } from "@/lib/request";

const requestSchema = z.object({
  viewerSessionId: z.string().min(1),
  message: z.string().min(1).max(2000),
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
    const result = await prisma.$transaction(async (tx) => {
      const viewerSession = await tx.viewerSession.findUniqueOrThrow({
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
                include: {
                  voiceAssets: {
                    where: { status: "active" },
                  },
                },
                orderBy: { priority: "desc" },
              },
            },
          },
        },
      });

      if (viewerSession.project.status !== "published") {
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

      const plan = await tx.creatorPlan.findUniqueOrThrow({
        where: { creatorId: viewerSession.project.creatorId },
      });
      if (plan.status !== "active" || plan.expiresAt <= new Date() || plan.usedAiMessages >= plan.monthlyAiMessageLimit) {
        throw new Error("Creator AI quota is not available");
      }

      const ai = await callAiProxy({
        systemPrompt: viewerSession.project.systemPrompt,
        enabledTags: viewerSession.project.triggerTags.map((tag) => ({
          name: tag.name,
          description: tag.description,
          keywords: tag.keywords,
          promptFragment: tag.promptFragment,
        })),
        recentMessages: body.recentMessages,
        userMessage: body.message,
      });

      const quota = await deductSuccessfulChatQuota(tx, {
        creatorId: viewerSession.project.creatorId,
        projectId: viewerSession.projectId,
        fanAccessCodeId: viewerSession.fanAccessCodeId,
        tokenEstimate: ai.tokenEstimate,
      });

      return {
        ...ai,
        voiceAssets: buildTriggeredVoiceAssets({
          tags: ai.tags,
          triggerTags: viewerSession.project.triggerTags,
          viewerSessionId: body.viewerSessionId,
        }),
        live2dEffects: buildTriggeredLive2DEffects({
          tags: ai.tags,
          triggerTags: viewerSession.project.triggerTags,
        }),
        remainingMessages: quota.remainingMessages,
      };
    });

    recordApiRequest({ route: "/api/chat", method: "POST", status: 200, durationMs: performance.now() - startedAt });
    return NextResponse.json(result);
  } catch (error) {
    logEvent("warn", "chat_failed", { error: error instanceof Error ? error.message : "Unknown failure" });
    recordApiRequest({ route: "/api/chat", method: "POST", status: 400, durationMs: performance.now() - startedAt });
    return jsonError(error, "Chat failed");
  }
}
