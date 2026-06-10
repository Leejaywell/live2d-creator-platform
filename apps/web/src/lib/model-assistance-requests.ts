import { Prisma } from "@prisma/client";

export type ModelAssistanceRequestView = {
  id: string;
  projectId: string;
  projectName: string;
  creatorEmail: string;
  notes: string;
  createdAt: Date;
  status: "pending" | "fulfilled";
  fulfilledAt?: Date;
  fulfilledModelAssetId?: string;
  fulfilledModelVersion?: number;
};

export type ModelAssistanceFulfillment = {
  id: string;
  projectId: string;
  version: number;
  createdAt: Date;
};

export function modelAssistanceRequestFromAuditLog(event: {
  id: string;
  targetId: string | null;
  after: Prisma.JsonValue | null;
  actor?: { email: string } | null;
  createdAt: Date;
}, fulfillment?: ModelAssistanceFulfillment | null): ModelAssistanceRequestView {
  const data = auditObject(event.after);
  return {
    id: event.id,
    projectId: stringValue(data.projectId, event.targetId ?? ""),
    projectName: stringValue(data.projectName, "Unknown project"),
    creatorEmail: event.actor?.email ?? "Unknown creator",
    notes: stringValue(data.notes, ""),
    createdAt: event.createdAt,
    status: fulfillment ? "fulfilled" : "pending",
    fulfilledAt: fulfillment?.createdAt,
    fulfilledModelAssetId: fulfillment?.id,
    fulfilledModelVersion: fulfillment?.version,
  };
}

export function resolveModelAssistanceRequests(
  events: Array<{
    id: string;
    targetId: string | null;
    after: Prisma.JsonValue | null;
    actor?: { email: string } | null;
    createdAt: Date;
  }>,
  fulfillments: ModelAssistanceFulfillment[],
): ModelAssistanceRequestView[] {
  return events.map((event) => {
    const base = modelAssistanceRequestFromAuditLog(event);
    const fulfillment = fulfillments
      .filter((item) => item.projectId === base.projectId && item.createdAt >= base.createdAt)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())[0];
    return fulfillment ? { ...base, status: "fulfilled", fulfilledAt: fulfillment.createdAt, fulfilledModelAssetId: fulfillment.id, fulfilledModelVersion: fulfillment.version } : base;
  });
}

export function modelAssistanceStatusText(request: Pick<ModelAssistanceRequestView, "createdAt" | "status" | "fulfilledAt" | "fulfilledModelVersion">) {
  if (request.status === "fulfilled") {
    const modelVersion = request.fulfilledModelVersion ? ` with model version ${request.fulfilledModelVersion}` : "";
    return `Fulfilled${modelVersion} on ${request.fulfilledAt?.toISOString() ?? "an unknown date"}.`;
  }
  return `Requested ${request.createdAt.toISOString()}. Waiting for admin-assisted model setup.`;
}

function auditObject(value: Prisma.JsonValue | null) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" && value ? value : fallback;
}
