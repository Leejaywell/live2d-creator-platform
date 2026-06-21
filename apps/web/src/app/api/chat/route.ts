import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { callAiProxy, estimateTokens } from "@/lib/ai-proxy";
import { buildTriggeredLive2DEffects } from "@/lib/chat-effects";
import { enforceChatOutputSafety, enforceChatSafety, isChatSafetyError } from "@/lib/chat-safety";
import { hashBrowserDevice, shouldBindDevice } from "@/lib/fan-codes";
import { recordChatUsage, refundChatQuota, reserveChatQuota } from "@/lib/fan-code-service";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";
import { rateLimit, rateLimitIdentifier } from "@/lib/rate-limit";
import { jsonError, parseBody } from "@/lib/request";
import { recordChatSafetyEvent } from "@/lib/safety-events";

const PREVIEW_BATCH_IDS = new Set(["preview", "admin-preview"]);

const schema = z.object({
  viewerSessionId: z.string().min(1),
  browserDeviceId: z.string().optional(),
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

    // Second limit keyed by the viewer session, so a spoofed/rotated client IP
    // can't exceed the per-code throttle.
    const sessionGate = await rateLimitIdentifier(`chat-session:${body.viewerSessionId}`, {
      key: "chat-session",
      limit: 20,
      windowMs: 60_000,
    });
    if (!sessionGate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(sessionGate.retryAfterSeconds) } },
      );
    }
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

    // Creator/admin debug-preview sessions may chat regardless of publish status.
    // Quota handling differs by session type:
    //  - admin preview:   free — never touches the creator's quota at all.
    //  - creator preview: spends the creator's OWN AI quota, but not a fan's
    //                     message allowance (chargeFanCode=false).
    //  - normal fan:      spends both the fan code and the creator's quota.
    const isPreviewSession = PREVIEW_BATCH_IDS.has(code.batchId ?? "");
    const isAdminPreview = code.batchId === "admin-preview";
    const isCreatorPreview = code.batchId === "preview";
    if (!isPreviewSession && project.status !== "published") {
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

    // Re-verify the device on every message: viewerSessionId must not be replayable
    // from a different device when the code is device-bound.
    if (shouldBindDevice(code.bindMode) && viewerSession.deviceHash) {
      const userAgent = request.headers.get("user-agent") ?? "";
      const deviceHash = body.browserDeviceId
        ? hashBrowserDevice(body.browserDeviceId, userAgent)
        : null;
      if (deviceHash !== viewerSession.deviceHash) {
        return NextResponse.json({ error: "Access code is bound to another device" }, { status: 403 });
      }
    }

    const enabledTags = project.triggerTags.map((tag) => ({
      name: tag.name,
      description: tag.description,
      keywords: tag.keywords,
      promptFragment: tag.promptFragment,
    }));

    // Client-supplied history is untrusted: drop any entry that fails the input
    // safety filter so forged/disallowed turns can't be used to steer the model.
    const safeHistory = body.recentMessages.filter((m) => {
      try {
        enforceChatSafety(m.content, {
          contentModeration: runtime.contentModeration,
          maxFanMessageLength: runtime.maxFanMessageLength,
        });
        return true;
      } catch {
        return false;
      }
    });

    // Reserve quota BEFORE the paid AI call (atomic, count-guarded). Concurrent
    // requests on one session can no longer all pass a stale check and each
    // obtain a reply; a request that can't reserve never reaches the provider.
    // Preview sessions (creator/admin debug) never touch the creator's quota or
    // usage accounting — admins testing a model must not burn the creator's budget.
    let remainingMessages: number;
    if (isAdminPreview) {
      remainingMessages = Math.max(0, code.maxMessages - code.usedMessages);
    } else {
      try {
        const reserved = await prisma.$transaction((tx) =>
          reserveChatQuota(tx, {
            creatorId: project.creator.id,
            fanAccessCodeId: code.id,
            chargeFanCode: !isCreatorPreview,
          }),
        );
        remainingMessages = reserved.remainingMessages;
      } catch {
        return NextResponse.json({ error: "Access code quota is exhausted" }, { status: 403 });
      }
    }

    const refund = () =>
      isAdminPreview
        ? Promise.resolve()
        : prisma
            .$transaction((tx) =>
              refundChatQuota(tx, {
                creatorId: project.creator.id,
                fanAccessCodeId: code.id,
                chargeFanCode: !isCreatorPreview,
              }),
            )
            .catch(() => {});

    // Non-streaming call: robust JSON+schema parsing (callAiProxy) that never
    // returns an empty reply — it falls back to a non-empty local reply if the
    // provider misbehaves. The client UI only ever rendered the full reply at
    // once anyway, so there is no streaming UX lost here, and the previous
    // fragile token-by-token JSON extraction (which could yield empty replies on
    // multi-turn history) is gone.
    let aiResult: { reply: string; tags: string[] };
    try {
      aiResult = await callAiProxy({
        systemPrompt: project.systemPrompt,
        enabledTags,
        recentMessages: safeHistory,
        userMessage,
        aiProvider: runtime.aiProvider,
        chatModel: runtime.aiChatModel,
        baseUrl: runtime.aiBaseUrl,
        apiKey: runtime.aiApiKey,
        temperature: runtime.aiTemperature,
      });
    } catch (error) {
      await refund();
      return jsonError(error, "Chat failed");
    }

    let safeReply = aiResult.reply;
    try {
      safeReply = enforceChatOutputSafety(aiResult.reply, { contentModeration: runtime.contentModeration });
    } catch {
      safeReply = "我先不回答这个，我们聊点别的好吗？";
    }
    const tags = aiResult.tags;
    const live2dEffects = buildTriggeredLive2DEffects({ tags, triggerTags: project.triggerTags });

    // Reservation succeeded → record accounting and report fresh remaining.
    // Admin preview skips accounting entirely; creator preview records the
    // creator's own AI usage (its quota was reserved above).
    if (!isAdminPreview) {
      try {
        await prisma.$transaction((tx) =>
          recordChatUsage(tx, {
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
        if (fresh) remainingMessages = Math.max(0, fresh.maxMessages - fresh.usedMessages);
      } catch {
        // accounting is best-effort; quota was already reserved atomically
      }
    }

    const encoder = new TextEncoder();
    const sse = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (payload: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        send({ type: "content", content: safeReply });
        send({ type: "done", reply: safeReply, tags, live2dEffects, remainingMessages });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
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
