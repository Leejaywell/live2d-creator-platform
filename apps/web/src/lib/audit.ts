import { Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type AuditInput = {
  actorUserId?: string;
  actorRole?: UserRole;
  action: string;
  targetType: string;
  targetId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ipAddress?: string;
};

export function writeAuditLog(input: AuditInput, tx: Pick<typeof prisma, "auditLog"> = prisma) {
  return tx.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      before: input.before,
      after: input.after,
      ipAddress: input.ipAddress,
    },
  });
}
