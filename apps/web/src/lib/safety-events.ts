import { Prisma } from "@prisma/client";

import { type ChatSafetyError } from "@/lib/chat-safety";
import { prisma } from "@/lib/prisma";
import { previewMessage, safetyEventFromAuditLog } from "@/lib/safety-event-format";

export type SafetyEventView = {
  id: string;
  projectName: string;
  projectSlug: string;
  creatorUsername: string;
  code: string;
  severity: string;
  messagePreview: string;
  createdAt: Date;
};

export async function recordChatSafetyEvent(input: {
  viewerSessionId: string;
  message: string;
  error: ChatSafetyError;
  ipAddress?: string;
}) {
  const viewerSession = await prisma.viewerSession.findUnique({
    where: { id: input.viewerSessionId },
    include: {
      project: {
        include: {
          creator: {
            select: { username: true },
          },
        },
      },
    },
  });

  return prisma.auditLog.create({
    data: {
      action: "chat.safety_blocked",
      targetType: "ChatSafetyEvent",
      targetId: input.viewerSessionId,
      ipAddress: input.ipAddress,
      after: {
        viewerSessionId: input.viewerSessionId,
        projectId: viewerSession?.projectId,
        projectName: viewerSession?.project.name,
        projectSlug: viewerSession?.project.slug,
        creatorUsername: viewerSession?.project.creator.username,
        code: input.error.code,
        severity: input.error.severity,
        messagePreview: previewMessage(input.message),
      } satisfies Prisma.InputJsonObject,
    },
  });
}

export async function listRecentSafetyEvents(limit = 20): Promise<SafetyEventView[]> {
  const events = await prisma.auditLog.findMany({
    where: {
      action: "chat.safety_blocked",
      targetType: "ChatSafetyEvent",
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return events.map((event) => safetyEventFromAuditLog(event));
}
