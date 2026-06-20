import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { callAiProxy } from "@/lib/ai-proxy";
import { requireSession } from "@/lib/authz";
import { buildTriggeredLive2DEffects } from "@/lib/chat-effects";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";
import { jsonError, parseBody } from "@/lib/request";

const schema = z.object({ message: z.string().min(1).max(4000) });

export async function POST(request: NextRequest, context: RouteContext<"/api/creator/projects/[projectId]/tags/test">) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can test tags" }, { status: 403 });
    }
    const { projectId } = await context.params;
    const project = await prisma.project.findFirstOrThrow({
      where: { id: projectId, creatorId: session.user.id },
      include: { triggerTags: { where: { enabled: true }, orderBy: { priority: "desc" } } },
    });
    const body = await parseBody(request, schema);
    const runtime = await getPlatformRuntimeSettings();

    const result = await callAiProxy({
      systemPrompt: project.systemPrompt,
      enabledTags: project.triggerTags.map((tag) => ({
        name: tag.name,
        description: tag.description,
        keywords: tag.keywords,
        promptFragment: tag.promptFragment,
      })),
      recentMessages: [],
      userMessage: body.message,
      aiProvider: runtime.aiProvider,
      chatModel: runtime.aiChatModel,
      baseUrl: runtime.aiBaseUrl,
      apiKey: runtime.aiApiKey,
    });

    const live2dEffects = buildTriggeredLive2DEffects({ tags: result.tags, triggerTags: project.triggerTags });
    return NextResponse.json({ ...result, live2dEffects });
  } catch (error) {
    return jsonError(error, "Tag test failed");
  }
}
