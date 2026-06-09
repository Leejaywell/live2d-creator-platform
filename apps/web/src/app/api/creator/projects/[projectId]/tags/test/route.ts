import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { callAiProxy } from "@/lib/ai-proxy";
import { buildTriggeredLive2DEffects, buildTriggeredVoiceAssetReferences } from "@/lib/chat-effects";
import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { jsonError, parseBody } from "@/lib/request";

const testSchema = z.object({
  message: z.string().min(1).max(2000),
});

export async function POST(request: NextRequest, context: RouteContext<"/api/creator/projects/[projectId]/tags/test">) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can test trigger tags" }, { status: 403 });
    }

    const { projectId } = await context.params;
    const body = await parseBody(request, testSchema);
    const project = await prisma.project.findFirstOrThrow({
      where: { id: projectId, creatorId: session.user.id },
      include: {
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
    });

    const ai = await callAiProxy({
      systemPrompt: project.systemPrompt,
      enabledTags: project.triggerTags.map((tag) => ({
        name: tag.name,
        description: tag.description,
        keywords: tag.keywords,
        promptFragment: tag.promptFragment,
      })),
      recentMessages: [],
      userMessage: body.message,
    });

    const voiceAssets = buildTriggeredVoiceAssetReferences({
      tags: ai.tags,
      triggerTags: project.triggerTags,
    }).map(({ id, name, tag }) => ({ id, name, tag }));

    return NextResponse.json({
      reply: ai.reply,
      tags: ai.tags,
      tokenEstimate: ai.tokenEstimate,
      live2dEffects: buildTriggeredLive2DEffects({
        tags: ai.tags,
        triggerTags: project.triggerTags,
      }),
      voiceAssets,
    });
  } catch (error) {
    return jsonError(error, "Trigger tag test failed");
  }
}
