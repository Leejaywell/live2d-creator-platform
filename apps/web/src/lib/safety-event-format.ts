import { Prisma } from "@prisma/client";

import type { SafetyEventView } from "@/lib/safety-events";

export function previewMessage(message: string) {
  const normalized = message.trim().replace(/\s+/g, " ");
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}

export function safetyEventFromAuditLog(event: { id: string; after: Prisma.JsonValue | null; createdAt: Date }): SafetyEventView {
  const data = auditObject(event.after);
  return {
    id: event.id,
    projectName: stringValue(data.projectName, "Unknown project"),
    projectSlug: stringValue(data.projectSlug, ""),
    creatorUsername: stringValue(data.creatorUsername, "Unknown creator"),
    code: stringValue(data.code, "unknown"),
    severity: stringValue(data.severity, "medium"),
    messagePreview: stringValue(data.messagePreview, ""),
    createdAt: event.createdAt,
  };
}

function auditObject(value: Prisma.JsonValue | null) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value ? value : fallback;
}
