import { inspect } from "node:util";
import { NextResponse } from "next/server";
import JSZip from "jszip";

import { applyScriptEnvToProcess, loadEnvFileForScript } from "../src/lib/env-file";

type E2EReport = {
  ok: boolean;
  creatorUsername: string;
  auth: {
    passwordAccepted: boolean;
    sessionCreated: boolean;
    cookieSet: boolean;
  };
  projectSlug: string;
  fanCodeId: string;
  viewerSessionId: string;
  reply: string;
  tags: string[];
  verified: {
    usedMessages: number;
    remainingMessagesAfterChat: number;
    usedAiMessages: number;
    chatUsageCount: number;
    aiLedgerCount: number;
    chatFanCodeQuotaExhaustedRejected: boolean;
    chatAiQuotaRollbackVerified: boolean;
    projectQuotaExceededRejected: boolean;
    modelOverwriteAssetCount: number;
    modelOverwriteAuditCount: number;
    revokedFanCodeCount: number;
    revokedFanCodeBatchCount: number;
    fanCodeQuotaExceededRejected: boolean;
    fanCodeDeviceBindingRaceRejected: boolean;
    adminUploadedModelVersion: number;
    adminModelUploadAuditCount: number;
    invalidModelUploadRecorded: boolean;
    triggeredLive2DEffectCount: number;
    expiredPlanNewSessionRejected: boolean;
    expiredPlanViewerAssetAccessRejected: boolean;
    manualOrderCreatedAuditCount: number;
    invalidManualOrderAmountRejected: boolean;
    noopManualOrderRejected: boolean;
    invalidManualOrderPeriodRejected: boolean;
    staleManualOrderConfirmationRejected: boolean;
    manualOrderQuotaReductionRejected: boolean;
    crossCreatorAssetAccessRejected: boolean;
    loggedInViewerAssetFallbackAllowed: boolean;
    adminEmergencyModelUploadVersion: number;
    supportNoteAuditCount: number;
    supportNoteMissingTargetRejected: boolean;
    customCreatorPlanAuditCount: number;
    customCreatorUsernameNormalized: boolean;
    invalidCreatorPlanExpirationRejected: boolean;
    adminUsernameCreatorCreationRejected: boolean;
    quotaGrantLedgerCount: number;
    quotaGrantAuditCount: number;
    storageQuotaGrantRejected: boolean;
    quotaGrantNonCreatorRejected: boolean;
    draftPublicProjectHidden: boolean;
    creatorStatusAuditCount: number;
    suspendedCreatorNewSessionRejected: boolean;
    suspendedCreatorViewerAssetRejected: boolean;
    suspendedCreatorPublicProjectHidden: boolean;
    fanCodePackOrderType: string;
    fanCodePackLedgerCount: number;
    modelSetupAssistanceAuditCount: number;
    publishWithoutModelRejected: boolean;
  };
  cleanedUp: boolean;
};

async function main() {
  if (process.argv.includes("--help")) {
    printHelp();
    return;
  }

  const envFile = valueAfter("--app-env-file") ?? ".env.integration";
  const loadedEnv = loadEnvFileForScript(envFile);
  applyScriptEnvToProcess(loadedEnv, integrationEnvKeys());

  const [
    { generateFanCodeBatch, validateFanCode, deductSuccessfulChatQuota, revokeFanAccessCode, revokeFanCodeBatch },
    { callAiProxy },
    { signInWithPassword },
    { prisma },
    { internalEmailForUsername },
    { hashPassword },
    { createCreatorAccount, createManualOrder, createSupportNote, grantCreatorQuota, updateCreatorStatus },
    { confirmManualOrder },
    { uploadModelAsset },
    { buildTriggeredLive2DEffects },
    { authorizeAssetAccess, authorizeAuthenticatedAssetAccess, authorizeViewerAssetAccess },
    { createModelSetupAssistanceRequest, createProject, setProjectStatus },
    { findPublicAudienceProject, listPublicCompanionProjects },
  ] = await Promise.all([
    import("../src/lib/fan-code-service"),
    import("../src/lib/ai-proxy"),
    import("../src/auth"),
    import("../src/lib/prisma"),
    import("../src/lib/account-identity"),
    import("../src/lib/password-auth"),
    import("../src/lib/admin"),
    import("../src/lib/orders"),
    import("../src/lib/model-assets"),
    import("../src/lib/chat-effects"),
    import("../src/lib/asset-access"),
    import("../src/lib/projects"),
    import("../src/lib/public-projects"),
  ]);

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const creatorUsername = `e2e-${suffix}`;
  const adminUsername = `admin-${suffix}`;
  const supportUsername = `support-${suffix}`;
  const creatorPassword = "ChangeMe123!";
  const adminPassword = "ChangeMe123!";
  const supportPassword = "ChangeMe123!";
  const projectSlug = `e2e-${suffix}`;
  const keepData = process.env.E2E_KEEP_DATA === "true";
  let creatorId = "";
  let adminId = "";
  let supportAdminId = "";
  let projectId = "";

  try {
    const [creatorPasswordHash, adminPasswordHash, supportPasswordHash] = await Promise.all([
      hashPassword(creatorPassword),
      hashPassword(adminPassword),
      hashPassword(supportPassword),
    ]);
    const setup = await prisma.$transaction(async (tx) => {
      const creator = await tx.user.create({
        data: {
          username: creatorUsername,
          email: internalEmailForUsername(creatorUsername),
          passwordHash: creatorPasswordHash,
          role: "creator",
          status: "active",
          emailVerified: new Date(),
          creatorProfile: {
            create: {
              displayName: "E2E Creator",
            },
          },
          creatorPlan: {
            create: {
              planName: "E2E Pro",
              startsAt: new Date(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              maxProjects: 1,
              storageLimitMb: 0,
              monthlyAiMessageLimit: 10,
              fanCodeQuota: 5,
            },
          },
        },
      });
      const admin = await tx.user.create({
        data: {
          username: adminUsername,
          email: internalEmailForUsername(adminUsername),
          passwordHash: adminPasswordHash,
          role: "ops_admin",
          status: "active",
          emailVerified: new Date(),
        },
      });
      const supportAdmin = await tx.user.create({
        data: {
          username: supportUsername,
          email: internalEmailForUsername(supportUsername),
          passwordHash: supportPasswordHash,
          role: "support_admin",
          status: "active",
          emailVerified: new Date(),
        },
      });

      const project = await tx.project.create({
        data: {
          creatorId: creator.id,
          name: "E2E Live2D Project",
          slug: projectSlug,
          intro: "Automated database E2E project.",
          systemPrompt: "Return concise JSON with reply and tags. Prefer tag 脸红 when the user says 你好.",
          welcomeMessage: "E2E ready.",
          status: "published",
          triggerTags: {
            create: {
              name: "脸红",
              description: "E2E trigger",
              keywords: ["你好"],
              promptFragment: "Reply warmly.",
              live2dParams: { Param5: 1 },
              priority: 100,
              enabled: true,
            },
          },
        },
      });
      return { admin, creator, project, supportAdmin };
    });
    adminId = setup.admin.id;
    supportAdminId = setup.supportAdmin.id;
    creatorId = setup.creator.id;
    projectId = setup.project.id;

    const auth = await verifyPasswordAuth({
      creatorUsername,
      creatorPassword,
      signInWithPassword,
      prisma,
    });

    const [fanCode] = await generateFanCodeBatch({
      projectId,
      creatorId,
      quantity: 1,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxMessages: 5,
      bindMode: "none",
    });

    const session = await validateFanCode({
      projectSlug,
      code: fanCode.code,
      browserDeviceId: `e2e-device-${suffix}`,
      userAgent: "integration-e2e",
    });

    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        triggerTags: {
          where: { enabled: true },
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
      userMessage: "你好",
    });

    const quota = await prisma.$transaction((tx) =>
      deductSuccessfulChatQuota(tx, {
        creatorId,
        projectId,
        fanAccessCodeId: session.fanAccessCodeId,
        tokenEstimate: ai.tokenEstimate,
      }),
    );

    const [codeRow, plan, chatUsageCount, aiLedgerCount] = await Promise.all([
      prisma.fanAccessCode.findUniqueOrThrow({ where: { id: session.fanAccessCodeId } }),
      prisma.creatorPlan.findUniqueOrThrow({ where: { creatorId } }),
      prisma.chatUsage.count({ where: { creatorId, projectId, fanAccessCodeId: session.fanAccessCodeId } }),
      prisma.quotaLedgerEntry.count({ where: { creatorId, resource: "ai_messages", entryType: "consume" } }),
    ]);

    if (codeRow.usedMessages !== 1) {
      throw new Error(`Expected fan code usedMessages=1, got ${codeRow.usedMessages}`);
    }
    if (quota.remainingMessages !== 4) {
      throw new Error(`Expected remainingMessages=4 after one chat, got ${quota.remainingMessages}`);
    }
    if (plan.usedAiMessages !== 1) {
      throw new Error(`Expected plan usedAiMessages=1, got ${plan.usedAiMessages}`);
    }
    if (chatUsageCount < 1) {
      throw new Error("Expected at least one chat usage row");
    }
    if (aiLedgerCount < 1) {
      throw new Error("Expected at least one AI quota ledger row");
    }
    const triggeredLive2DEffects = buildTriggeredLive2DEffects({
      tags: ["脸红"],
      triggerTags: project.triggerTags,
    });
    if (triggeredLive2DEffects.length !== 1 || triggeredLive2DEffects[0].params[0]?.id !== "Param5") {
      throw new Error("Expected triggered Live2D params for 脸红 tag");
    }
    const projectQuotaExceededRejected = await verifyProjectQuotaExceededRejected({
      createProject,
      creatorId,
      suffix,
    });
    const modelOverwrite = await verifyModelUploadOverwrite({
      prisma,
      creatorId,
      projectId,
      uploadModelAsset,
    });
    const fanCodeRevocation = await verifyFanCodeRevocation({
      generateFanCodeBatch,
      revokeFanAccessCode,
      revokeFanCodeBatch,
      prisma,
      creatorId,
      projectId,
    });
    const chatQuotaGuards = await verifyChatQuotaGuards({
      generateFanCodeBatch,
      validateFanCode,
      deductSuccessfulChatQuota,
      prisma,
      creatorId,
      projectId,
      projectSlug,
      suffix,
    });
    const adminModelUpload = await verifyAdminAssistedModelUpload({
      prisma,
      uploadModelAsset,
      adminId,
      creatorId,
      projectId,
    });
    const invalidModelUploadRecorded = await verifyInvalidModelUploadRecorded({
      prisma,
      uploadModelAsset,
      creatorId,
      projectId,
    });
    const manualOrder = await verifyManualOrderCreationAudit({
      prisma,
      createManualOrder,
      adminId,
      creatorId,
    });
    const invalidManualOrderAmountRejected = await verifyInvalidManualOrderAmountRejected({
      createManualOrder,
      adminId,
      creatorId,
    });
    const noopManualOrderRejected = await verifyNoopManualOrderRejected({
      createManualOrder,
      adminId,
      creatorId,
    });
    const invalidManualOrderPeriodRejected = await verifyInvalidManualOrderPeriodRejected({
      createManualOrder,
      adminId,
      creatorId,
    });
    const staleManualOrderConfirmationRejected = await verifyStaleManualOrderConfirmationRejected({
      prisma,
      confirmManualOrder,
      adminId,
      creatorId,
    });
    const fanCodePackOrder = await verifyFanCodePackManualOrder({
      prisma,
      createManualOrder,
      confirmManualOrder,
      adminId,
      creatorId,
    });
    const manualOrderQuotaReductionRejected = await verifyManualOrderQuotaReductionRejected({
      prisma,
      createManualOrder,
      confirmManualOrder,
      adminId,
      creatorId,
    });
    const supportNote = await verifySupportNoteAudit({
      prisma,
      createSupportNote,
      supportAdminId,
      projectId,
    });
    const customCreatorPlan = await verifyAdminCreatorCustomPlan({
      prisma,
      createCreatorAccount,
      adminId,
      suffix,
    });
    const invalidCreatorPlanExpirationRejected = await verifyInvalidCreatorPlanExpirationRejected({
      createCreatorAccount,
      adminId,
      suffix,
    });
    const adminUsernameCreatorCreationRejected = await verifyAdminUsernameCreatorCreationRejected({
      createCreatorAccount,
      adminId,
      adminUsername: setup.admin.username || adminUsername,
    });
    const quotaGrant = await verifyAdminQuotaGrant({
      prisma,
      grantCreatorQuota,
      adminId,
      creatorId,
      suffix,
    });
    const fanCodeDeviceBindingRaceRejected = await verifyFanCodeDeviceBindingRaceRejected({
      generateFanCodeBatch,
      validateFanCode,
      prisma,
      creatorId,
      projectId,
      projectSlug,
      suffix,
    });
    const publicProjectVisibility = await verifyPublicProjectVisibility({
      prisma,
      findPublicAudienceProject,
      listPublicCompanionProjects,
      creatorId,
      projectSlug,
      suffix,
    });
    const creatorStatus = await verifyCreatorStatusManagement({
      prisma,
      updateCreatorStatus,
      validateFanCode,
      authorizeViewerAssetAccess,
      findPublicAudienceProject,
      listPublicCompanionProjects,
      adminId,
      creatorId,
      projectId,
      projectSlug,
      code: fanCode.code,
      viewerSessionId: session.viewerSessionId,
      suffix,
    });
    const modelSetupAssistance = await verifyModelSetupAssistanceRequest({
      prisma,
      createModelSetupAssistanceRequest,
      creatorId,
      projectId,
    });
    const publishWithoutModelRejected = await verifyPublishingRequiresValidModel({
      prisma,
      setProjectStatus,
      creatorId,
      suffix,
    });
    const loggedInViewerAssetFallbackAllowed = await verifyLoggedInViewerAssetFallbackAllowed({
      prisma,
      authorizeAssetAccess,
      projectId,
      viewerSessionId: session.viewerSessionId,
      suffix,
    });
    const expiredPlanNewSessionRejected = await verifyExpiredPlanBlocksNewFanSession({
      prisma,
      validateFanCode,
      creatorId,
      projectSlug,
      code: fanCode.code,
      suffix,
    });
    const expiredPlanViewerAssetAccessRejected = await verifyExpiredPlanBlocksViewerAssetAccess({
      prisma,
      authorizeViewerAssetAccess,
      projectId,
      viewerSessionId: session.viewerSessionId,
    });
    const adminEmergencyUpload = await verifyAdminEmergencyModelUploadOnExpiredPlan({
      prisma,
      uploadModelAsset,
      adminId,
      creatorId,
      projectId,
    });
    const crossCreatorAssetAccessRejected = await verifyCrossCreatorAssetAccessRejected({
      prisma,
      authorizeAuthenticatedAssetAccess,
      projectId,
      suffix,
    });

    const report: E2EReport = {
      ok: true,
      creatorUsername,
      auth,
      projectSlug,
      fanCodeId: session.fanAccessCodeId,
      viewerSessionId: session.viewerSessionId,
      reply: ai.reply,
      tags: ai.tags,
      verified: {
        usedMessages: codeRow.usedMessages,
        remainingMessagesAfterChat: quota.remainingMessages,
        usedAiMessages: plan.usedAiMessages,
        chatUsageCount,
        aiLedgerCount,
        chatFanCodeQuotaExhaustedRejected: chatQuotaGuards.fanCodeQuotaExhaustedRejected,
        chatAiQuotaRollbackVerified: chatQuotaGuards.aiQuotaRollbackVerified,
        projectQuotaExceededRejected,
        modelOverwriteAssetCount: modelOverwrite.assetCount,
        modelOverwriteAuditCount: modelOverwrite.auditCount,
        revokedFanCodeCount: fanCodeRevocation.revokedCodeCount,
        revokedFanCodeBatchCount: fanCodeRevocation.revokedBatchCount,
        fanCodeQuotaExceededRejected: fanCodeRevocation.quotaExceededRejected,
        fanCodeDeviceBindingRaceRejected,
        adminUploadedModelVersion: adminModelUpload.version,
        adminModelUploadAuditCount: adminModelUpload.auditCount,
        invalidModelUploadRecorded,
        triggeredLive2DEffectCount: triggeredLive2DEffects.length,
        expiredPlanNewSessionRejected,
        expiredPlanViewerAssetAccessRejected,
        manualOrderCreatedAuditCount: manualOrder.auditCount,
        invalidManualOrderAmountRejected,
        noopManualOrderRejected,
        invalidManualOrderPeriodRejected,
        staleManualOrderConfirmationRejected,
        manualOrderQuotaReductionRejected,
        crossCreatorAssetAccessRejected,
        loggedInViewerAssetFallbackAllowed,
        adminEmergencyModelUploadVersion: adminEmergencyUpload.version,
        supportNoteAuditCount: supportNote.auditCount,
        supportNoteMissingTargetRejected: supportNote.missingTargetRejected,
        customCreatorPlanAuditCount: customCreatorPlan.auditCount,
        customCreatorUsernameNormalized: customCreatorPlan.usernameNormalized,
        invalidCreatorPlanExpirationRejected,
        adminUsernameCreatorCreationRejected,
        quotaGrantLedgerCount: quotaGrant.ledgerCount,
        quotaGrantAuditCount: quotaGrant.auditCount,
        storageQuotaGrantRejected: quotaGrant.storageRejected,
        quotaGrantNonCreatorRejected: quotaGrant.nonCreatorRejected,
        draftPublicProjectHidden: publicProjectVisibility.draftProjectHidden,
        creatorStatusAuditCount: creatorStatus.auditCount,
        suspendedCreatorNewSessionRejected: creatorStatus.newSessionRejected,
        suspendedCreatorViewerAssetRejected: creatorStatus.viewerAssetRejected,
        suspendedCreatorPublicProjectHidden: creatorStatus.publicProjectHidden,
        fanCodePackOrderType: fanCodePackOrder.orderType,
        fanCodePackLedgerCount: fanCodePackOrder.ledgerCount,
        modelSetupAssistanceAuditCount: modelSetupAssistance.auditCount,
        publishWithoutModelRejected,
      },
      cleanedUp: false,
    };

    if (!keepData) {
      await cleanup(prisma, creatorId, projectId, adminId, supportAdminId);
      report.cleanedUp = true;
    }

    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (!keepData && creatorId) {
      await cleanup(prisma, creatorId, projectId, adminId, supportAdminId).catch(() => undefined);
    }
    await prisma.$disconnect();
  }
}

async function verifySupportNoteAudit(input: {
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  createSupportNote: typeof import("../src/lib/admin").createSupportNote;
  supportAdminId: string;
  projectId: string;
}) {
  const note = await input.createSupportNote({
    admin: { id: input.supportAdminId, role: "support_admin" },
    targetType: "Project",
    targetId: input.projectId,
    note: "E2E support note",
  });

  const auditCount = await input.prisma.auditLog.count({
    where: {
      id: note.id,
      actorUserId: input.supportAdminId,
      targetType: "Project",
      targetId: input.projectId,
      action: "support_note.created",
    },
  });
  if (auditCount < 1) {
    throw new Error("Expected support note audit log");
  }

  let missingTargetRejected = false;
  try {
    await input.createSupportNote({
      admin: { id: input.supportAdminId, role: "support_admin" },
      targetType: "Project",
      targetId: "missing-project",
      note: "Should not attach to a missing project",
    });
  } catch (error) {
    if (error instanceof Error && /Support note target not found/.test(error.message)) {
      missingTargetRejected = true;
    } else {
      throw error;
    }
  }
  if (!missingTargetRejected) {
    throw new Error("Expected support note targeting a missing project to be rejected");
  }

  return { auditCount, missingTargetRejected };
}

async function verifyAdminQuotaGrant(input: {
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  grantCreatorQuota: typeof import("../src/lib/admin").grantCreatorQuota;
  adminId: string;
  creatorId: string;
  suffix: string;
}) {
  const before = await input.prisma.creatorPlan.findUniqueOrThrow({
    where: { creatorId: input.creatorId },
  });
  const grant = await input.grantCreatorQuota({
    admin: { id: input.adminId, role: "ops_admin" },
    creatorId: input.creatorId,
    resource: "fan_codes",
    amount: 3,
    reason: "E2E quota grant",
  });

  if (grant.plan.fanCodeQuota !== before.fanCodeQuota + 3) {
    throw new Error(`Expected fan-code quota to increase by 3, got ${before.fanCodeQuota} -> ${grant.plan.fanCodeQuota}`);
  }
  const storageRejected = await verifyStorageQuotaGrantRejected(input);

  const [ledgerCount, auditCount] = await Promise.all([
    input.prisma.quotaLedgerEntry.count({
      where: {
        id: grant.ledgerEntry.id,
        creatorId: input.creatorId,
        resource: "fan_codes",
        entryType: "grant",
        amount: 3,
        createdByAdminId: input.adminId,
      },
    }),
    input.prisma.auditLog.count({
      where: {
        actorUserId: input.adminId,
        targetId: input.creatorId,
        targetType: "CreatorPlan",
        action: "quota.grant",
      },
    }),
  ]);
  if (ledgerCount < 1 || auditCount < 1) {
    throw new Error(`Expected quota grant ledger and audit log, got fan=${ledgerCount}, audits=${auditCount}`);
  }

  const nonCreatorRejected = await verifyQuotaGrantNonCreatorRejected(input);

  return { ledgerCount, storageRejected, auditCount, nonCreatorRejected };
}

async function verifyStorageQuotaGrantRejected(input: {
  grantCreatorQuota: typeof import("../src/lib/admin").grantCreatorQuota;
  adminId: string;
  creatorId: string;
}) {
  try {
    await input.grantCreatorQuota({
      admin: { id: input.adminId, role: "ops_admin" },
      creatorId: input.creatorId,
      resource: "storage_mb",
      amount: 128,
      reason: "E2E storage quota grant",
    });
  } catch (error) {
    if (error instanceof Error && /Unsupported quota resource/.test(error.message)) {
      return true;
    }
    throw error;
  }

  throw new Error("Expected storage quota grants to be rejected");
}

async function verifyQuotaGrantNonCreatorRejected(input: {
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  grantCreatorQuota: typeof import("../src/lib/admin").grantCreatorQuota;
  adminId: string;
  suffix: string;
}) {
  const nonCreator = await input.prisma.user.create({
    data: {
      email: `quota-admin-target-${input.suffix}@example.test`,
      role: "support_admin",
      status: "active",
      creatorPlan: {
        create: {
          planName: "Invalid Admin Plan",
          startsAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          maxProjects: 1,
          storageLimitMb: 0,
          monthlyAiMessageLimit: 1,
          fanCodeQuota: 1,
        },
      },
    },
  });

  try {
    await input.grantCreatorQuota({
      admin: { id: input.adminId, role: "ops_admin" },
      creatorId: nonCreator.id,
      resource: "fan_codes",
      amount: 1,
      reason: "E2E invalid quota grant target",
    });
  } catch (error) {
    if (error instanceof Error && /only target creator accounts/.test(error.message)) {
      return true;
    }
    throw error;
  } finally {
    await input.prisma.user.delete({ where: { id: nonCreator.id } }).catch(() => undefined);
  }

  throw new Error("Expected quota grant to non-creator account to be rejected");
}

async function verifyAdminCreatorCustomPlan(input: {
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  createCreatorAccount: typeof import("../src/lib/admin").createCreatorAccount;
  adminId: string;
  suffix: string;
}) {
  const creator = await input.createCreatorAccount({
    admin: { id: input.adminId, role: "ops_admin" },
    username: ` Custom-Plan-${input.suffix} `,
    password: "ChangeMe123!",
    displayName: "Custom Plan Creator",
    planName: "E2E Custom Plan",
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    maxProjects: 3,
    monthlyAiMessageLimit: 777,
    fanCodeQuota: 88,
  });

  try {
    const plan = await input.prisma.creatorPlan.findUniqueOrThrow({
      where: { creatorId: creator.id },
    });
    const expectedUsername = `custom-plan-${input.suffix}`;
    if (creator.username !== expectedUsername) {
      throw new Error(`Expected creator username to be normalized to ${expectedUsername}, got ${creator.username}`);
    }
    if (
      plan.maxProjects !== 3 ||
      plan.monthlyAiMessageLimit !== 777 ||
      plan.fanCodeQuota !== 88
    ) {
      throw new Error(
        `Expected custom creator plan quotas, got projects=${plan.maxProjects}, ai=${plan.monthlyAiMessageLimit}, fan=${plan.fanCodeQuota}`,
      );
    }

    const auditCount = await input.prisma.auditLog.count({
      where: {
        actorUserId: input.adminId,
        targetId: creator.id,
        targetType: "User",
        action: "creator_account.upserted",
      },
    });
    if (auditCount < 1) {
      throw new Error("Expected custom creator plan audit log");
    }

    return { auditCount, usernameNormalized: true };
  } finally {
    await input.prisma.user.delete({ where: { id: creator.id } }).catch(() => undefined);
  }
}

async function verifyAdminUsernameCreatorCreationRejected(input: {
  createCreatorAccount: typeof import("../src/lib/admin").createCreatorAccount;
  adminId: string;
  adminUsername: string;
}) {
  try {
    await input.createCreatorAccount({
      admin: { id: input.adminId, role: "ops_admin" },
      username: input.adminUsername,
      password: "ChangeMe123!",
      displayName: "Invalid Admin Replacement",
      planName: "Invalid Plan",
    });
  } catch (error) {
    if (error instanceof Error && /cannot replace admin accounts/.test(error.message)) {
      return true;
    }
    throw error;
  }

  throw new Error("Expected creator creation with an existing admin username to be rejected");
}

async function verifyInvalidCreatorPlanExpirationRejected(input: {
  createCreatorAccount: typeof import("../src/lib/admin").createCreatorAccount;
  adminId: string;
  suffix: string;
}) {
  try {
    await input.createCreatorAccount({
      admin: { id: input.adminId, role: "ops_admin" },
      username: `exp-${input.suffix}`,
      password: "ChangeMe123!",
      displayName: "Expired Plan Creator",
      planName: "Expired Plan",
      expiresAt: new Date(Date.now() - 60_000),
    });
  } catch (error) {
    if (error instanceof Error && /Plan expiration must be in the future/.test(error.message)) {
      return true;
    }
    throw error;
  }

  throw new Error("Expected creator plan with a past expiration to be rejected");
}

async function verifyCreatorStatusManagement(input: {
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  updateCreatorStatus: typeof import("../src/lib/admin").updateCreatorStatus;
  validateFanCode: typeof import("../src/lib/fan-code-service").validateFanCode;
  authorizeViewerAssetAccess: typeof import("../src/lib/asset-access").authorizeViewerAssetAccess;
  findPublicAudienceProject: typeof import("../src/lib/public-projects").findPublicAudienceProject;
  listPublicCompanionProjects: typeof import("../src/lib/public-projects").listPublicCompanionProjects;
  adminId: string;
  creatorId: string;
  projectId: string;
  projectSlug: string;
  code: string;
  viewerSessionId: string;
  suffix: string;
}) {
  const suspended = await input.updateCreatorStatus({
    admin: { id: input.adminId, role: "ops_admin" },
    creatorId: input.creatorId,
    status: "suspended",
  });
  if (suspended.status !== "suspended") {
    throw new Error(`Expected creator to be suspended, got ${suspended.status}`);
  }

  let newSessionRejected = false;
  let viewerAssetRejected = false;
  let publicProjectHidden = false;
  let restoredStatus = "";
  try {
    newSessionRejected = await verifySuspendedCreatorBlocksNewFanSession(input);
    viewerAssetRejected = await verifySuspendedCreatorBlocksViewerAssetAccess(input);
    publicProjectHidden = await verifySuspendedCreatorHidesPublicProject(input);
  } finally {
    const restored = await input.updateCreatorStatus({
      admin: { id: input.adminId, role: "ops_admin" },
      creatorId: input.creatorId,
      status: "active",
    });
    restoredStatus = restored.status;
  }
  if (restoredStatus !== "active") {
    throw new Error(`Expected creator to be restored, got ${restoredStatus}`);
  }

  const auditCount = await input.prisma.auditLog.count({
    where: {
      actorUserId: input.adminId,
      targetId: input.creatorId,
      targetType: "User",
      action: "creator.status_updated",
    },
  });
  if (auditCount < 2) {
    throw new Error(`Expected creator status update audit logs, got ${auditCount}`);
  }

  return { auditCount, newSessionRejected, viewerAssetRejected, publicProjectHidden };
}

async function verifyPublicProjectVisibility(input: {
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  findPublicAudienceProject: typeof import("../src/lib/public-projects").findPublicAudienceProject;
  listPublicCompanionProjects: typeof import("../src/lib/public-projects").listPublicCompanionProjects;
  creatorId: string;
  projectSlug: string;
  suffix: string;
}) {
  const publicProject = await input.findPublicAudienceProject(input.projectSlug);
  if (!publicProject) {
    throw new Error("Expected active published project to be publicly visible");
  }

  const draftProject = await input.prisma.project.create({
    data: {
      creatorId: input.creatorId,
      name: "E2E Draft Project",
      slug: `e2e-draft-${input.suffix}`,
      intro: "Draft should not be public.",
      systemPrompt: "Draft prompt",
      welcomeMessage: "Draft welcome",
      status: "draft",
    },
  });

  const draftVisible = await input.findPublicAudienceProject(draftProject.slug);
  const listed = await input.listPublicCompanionProjects();
  if (draftVisible || listed.some((project) => project.id === draftProject.id)) {
    throw new Error("Expected draft project to be hidden from public audience surfaces");
  }

  return { draftProjectHidden: true };
}

async function verifySuspendedCreatorBlocksNewFanSession(input: {
  validateFanCode: typeof import("../src/lib/fan-code-service").validateFanCode;
  projectSlug: string;
  code: string;
  suffix: string;
}) {
  try {
    await input.validateFanCode({
      projectSlug: input.projectSlug,
      code: input.code,
      browserDeviceId: `suspended-creator-device-${input.suffix}`,
      userAgent: "integration-e2e-suspended-creator",
    });
  } catch (error) {
    if (error instanceof Error && /Creator account is not active/.test(error.message)) {
      return true;
    }
    throw error;
  }

  throw new Error("Expected suspended creator to reject new fan-code validation sessions");
}

async function verifySuspendedCreatorBlocksViewerAssetAccess(input: {
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  authorizeViewerAssetAccess: typeof import("../src/lib/asset-access").authorizeViewerAssetAccess;
  projectId: string;
  viewerSessionId: string;
}) {
  const project = await input.prisma.project.findUniqueOrThrow({
    where: { id: input.projectId },
    include: { currentModelAsset: true },
  });
  const modelJsonPath = project.currentModelAsset?.modelJsonPath;
  if (!modelJsonPath) {
    throw new Error("Expected current model asset for suspended creator asset access check");
  }

  try {
    await input.authorizeViewerAssetAccess(input.viewerSessionId, modelJsonPath);
  } catch (error) {
    if (error instanceof Error && /Creator account is not active/.test(error.message)) {
      return true;
    }
    throw error;
  }

  throw new Error("Expected suspended creator to reject existing viewer asset access");
}

async function verifySuspendedCreatorHidesPublicProject(input: {
  findPublicAudienceProject: typeof import("../src/lib/public-projects").findPublicAudienceProject;
  listPublicCompanionProjects: typeof import("../src/lib/public-projects").listPublicCompanionProjects;
  projectId: string;
  projectSlug: string;
}) {
  const visible = await input.findPublicAudienceProject(input.projectSlug);
  const listed = await input.listPublicCompanionProjects();
  if (visible || listed.some((project) => project.id === input.projectId)) {
    throw new Error("Expected suspended creator project to be hidden from public audience surfaces");
  }

  return true;
}

async function verifyModelSetupAssistanceRequest(input: {
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  createModelSetupAssistanceRequest: typeof import("../src/lib/projects").createModelSetupAssistanceRequest;
  creatorId: string;
  projectId: string;
}) {
  const requestLog = await input.createModelSetupAssistanceRequest({
    creatorId: input.creatorId,
    projectId: input.projectId,
    notes: "E2E admin-assisted model setup request",
  });

  const auditCount = await input.prisma.auditLog.count({
    where: {
      id: requestLog.id,
      actorUserId: input.creatorId,
      targetId: input.projectId,
      targetType: "Project",
      action: "model_setup_assistance.requested",
    },
  });
  if (auditCount < 1) {
    throw new Error("Expected model setup assistance request audit log");
  }

  return { auditCount };
}

async function verifyProjectQuotaExceededRejected(input: {
  createProject: typeof import("../src/lib/projects").createProject;
  creatorId: string;
  suffix: string;
}) {
  try {
    await input.createProject({
      creatorId: input.creatorId,
      name: "E2E Extra Project",
      slug: `e2e-extra-${input.suffix}`,
      intro: "Should exceed project quota.",
      systemPrompt: "Return JSON.",
      welcomeMessage: "Hello.",
      theme: "#0f766e",
    });
  } catch (error) {
    if (error instanceof Error && /Creator model slot already exists|Project quota exceeded/.test(error.message)) {
      return true;
    }
    throw error;
  }

  throw new Error("Expected project creation above quota to be rejected");
}

async function verifyPublishingRequiresValidModel(input: {
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  setProjectStatus: typeof import("../src/lib/projects").setProjectStatus;
  creatorId: string;
  suffix: string;
}) {
  const draft = await input.prisma.project.create({
    data: {
      creatorId: input.creatorId,
      name: "E2E Missing Model Project",
      slug: `e2e-missing-model-${input.suffix}`,
      intro: "Should not publish without a valid model.",
      systemPrompt: "E2E missing model prompt.",
      welcomeMessage: "Missing model.",
      status: "draft",
    },
  });

  try {
    await input.setProjectStatus({
      projectId: draft.id,
      creatorId: input.creatorId,
      actorId: input.creatorId,
      actorRole: "creator",
      status: "published",
    });
  } catch (error) {
    if (error instanceof Error && /valid Live2D model is required/.test(error.message)) {
      return true;
    }
    throw error;
  }

  throw new Error("Expected publishing without a valid Live2D model to be rejected");
}

async function verifyAdminEmergencyModelUploadOnExpiredPlan(input: {
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  uploadModelAsset: typeof import("../src/lib/model-assets").uploadModelAsset;
  adminId: string;
  creatorId: string;
  projectId: string;
}) {
  const plan = await input.prisma.creatorPlan.findUniqueOrThrow({
    where: { creatorId: input.creatorId },
  });
  if (plan.expiresAt > new Date()) {
    throw new Error("Expected creator plan to be expired before admin emergency upload check");
  }

  const modelAsset = await input.uploadModelAsset({
    projectId: input.projectId,
    creatorId: input.creatorId,
    actorId: input.adminId,
    actorRole: "ops_admin",
    uploadedBy: "admin",
    fileName: "admin-emergency-model.zip",
    data: await minimalLive2DZip(),
  });

  if (modelAsset.uploadedBy !== "admin" || modelAsset.validationStatus !== "valid") {
    throw new Error(`Expected emergency admin model upload to be valid, got ${modelAsset.uploadedBy}/${modelAsset.validationStatus}`);
  }

  const auditCount = await input.prisma.auditLog.count({
    where: {
      actorUserId: input.adminId,
      targetId: modelAsset.id,
      action: "model_asset.uploaded",
    },
  });
  if (auditCount < 1) {
    throw new Error("Expected emergency admin model upload audit log");
  }

  return { version: modelAsset.version };
}

async function verifyCrossCreatorAssetAccessRejected(input: {
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  authorizeAuthenticatedAssetAccess: typeof import("../src/lib/asset-access").authorizeAuthenticatedAssetAccess;
  projectId: string;
  suffix: string;
}) {
  const otherCreator = await input.prisma.user.create({
    data: {
      email: `other-${input.suffix}@example.test`,
      role: "creator",
      status: "active",
      emailVerified: new Date(),
      creatorProfile: {
        create: {
          displayName: "Other E2E Creator",
        },
      },
      creatorPlan: {
        create: {
          planName: "Other E2E Pro",
          startsAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          maxProjects: 1,
          storageLimitMb: 0,
          monthlyAiMessageLimit: 10,
          fanCodeQuota: 1,
        },
      },
    },
  });

  try {
    await input.authorizeAuthenticatedAssetAccess(
      { id: otherCreator.id, role: "creator" },
      `projects/${input.projectId}/models/v1/private.model3.json`,
    );
  } catch (error) {
    if (error instanceof Error && /Asset is not available/.test(error.message)) {
      await input.prisma.user.delete({ where: { id: otherCreator.id } });
      return true;
    }
    await input.prisma.user.delete({ where: { id: otherCreator.id } }).catch(() => undefined);
    throw error;
  }

  await input.prisma.user.delete({ where: { id: otherCreator.id } }).catch(() => undefined);
  throw new Error("Expected cross-creator authenticated asset access to be rejected");
}

async function verifyLoggedInViewerAssetFallbackAllowed(input: {
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  authorizeAssetAccess: typeof import("../src/lib/asset-access").authorizeAssetAccess;
  projectId: string;
  viewerSessionId: string;
  suffix: string;
}) {
  const [project, otherCreator] = await Promise.all([
    input.prisma.project.findUniqueOrThrow({
      where: { id: input.projectId },
      include: { currentModelAsset: true },
    }),
    input.prisma.user.create({
      data: {
        email: `viewer-logged-in-${input.suffix}@example.test`,
        role: "creator",
        status: "active",
        emailVerified: new Date(),
      },
    }),
  ]);
  const modelJsonPath = project.currentModelAsset?.modelJsonPath;
  if (!modelJsonPath) {
    throw new Error("Expected current model asset for logged-in viewer asset fallback check");
  }

  try {
    await input.authorizeAssetAccess({
      user: { id: otherCreator.id, role: otherCreator.role, status: otherCreator.status },
      viewerSessionId: input.viewerSessionId,
      key: modelJsonPath,
    });
    return true;
  } finally {
    await input.prisma.user.delete({ where: { id: otherCreator.id } }).catch(() => undefined);
  }
}

async function verifyManualOrderCreationAudit(input: {
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  createManualOrder: typeof import("../src/lib/admin").createManualOrder;
  adminId: string;
  creatorId: string;
}) {
  const order = await input.createManualOrder({
    admin: { id: input.adminId, role: "ops_admin" },
    creatorId: input.creatorId,
    amount: "199.00",
    paymentMethod: "alipay",
    planName: "E2E Audit Plan",
    periodStart: new Date(),
    periodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    projectQuotaDelta: 1,
    aiMessageQuotaDelta: 10,
    fanCodeQuotaDelta: 2,
    notes: "E2E manual order creation audit",
  });

  const auditCount = await input.prisma.auditLog.count({
    where: {
      actorUserId: input.adminId,
      targetId: order.id,
      action: "manual_order.created",
    },
  });
  if (auditCount < 1) {
    throw new Error("Expected manual order creation audit log");
  }

  return { auditCount };
}

async function verifyInvalidManualOrderAmountRejected(input: {
  createManualOrder: typeof import("../src/lib/admin").createManualOrder;
  adminId: string;
  creatorId: string;
}) {
  try {
    await input.createManualOrder({
      admin: { id: input.adminId, role: "ops_admin" },
      creatorId: input.creatorId,
      amount: "-1.001",
      paymentMethod: "alipay",
      fanCodeQuotaDelta: 1,
    });
  } catch (error) {
    if (error instanceof Error && /Manual order amount/.test(error.message)) {
      return true;
    }
    throw error;
  }

  throw new Error("Expected invalid manual order amount to be rejected");
}

async function verifyNoopManualOrderRejected(input: {
  createManualOrder: typeof import("../src/lib/admin").createManualOrder;
  adminId: string;
  creatorId: string;
}) {
  try {
    await input.createManualOrder({
      admin: { id: input.adminId, role: "ops_admin" },
      creatorId: input.creatorId,
      amount: "1.00",
      paymentMethod: "other",
      notes: "E2E no-op order",
    });
  } catch (error) {
    if (error instanceof Error && /must include a plan or quota change/.test(error.message)) {
      return true;
    }
    throw error;
  }

  throw new Error("Expected manual order without a plan or quota change to be rejected");
}

async function verifyInvalidManualOrderPeriodRejected(input: {
  createManualOrder: typeof import("../src/lib/admin").createManualOrder;
  adminId: string;
  creatorId: string;
}) {
  try {
    await input.createManualOrder({
      admin: { id: input.adminId, role: "ops_admin" },
      creatorId: input.creatorId,
      amount: "19.00",
      paymentMethod: "alipay",
      planName: "Invalid Period",
      periodStart: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      periodEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  } catch (error) {
    if (error instanceof Error && /Plan period end must be after the start/.test(error.message)) {
      return true;
    }
    throw error;
  }

  throw new Error("Expected manual order with an invalid plan period to be rejected");
}

async function verifyStaleManualOrderConfirmationRejected(input: {
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  confirmManualOrder: typeof import("../src/lib/orders").confirmManualOrder;
  adminId: string;
  creatorId: string;
}) {
  const order = await input.prisma.manualOrder.create({
    data: {
      creatorId: input.creatorId,
      orderType: "plan",
      amount: "9.00",
      paymentMethod: "other",
      planName: "Stale Plan",
      periodStart: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      periodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000),
      projectQuotaDelta: 1,
      createdByAdminId: input.adminId,
    },
  });

  try {
    await input.confirmManualOrder(order.id, { id: input.adminId, role: "ops_admin" });
  } catch (error) {
    if (error instanceof Error && /Plan expiration must be in the future/.test(error.message)) {
      const unchanged = await input.prisma.manualOrder.findUniqueOrThrow({
        where: { id: order.id },
        select: { paymentStatus: true },
      });
      if (unchanged.paymentStatus !== "pending") {
        throw new Error(`Expected rejected stale order to remain pending, got ${unchanged.paymentStatus}`);
      }
      return true;
    }
    throw error;
  }

  throw new Error("Expected stale pending manual order confirmation to be rejected");
}

async function verifyFanCodePackManualOrder(input: {
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  createManualOrder: typeof import("../src/lib/admin").createManualOrder;
  confirmManualOrder: typeof import("../src/lib/orders").confirmManualOrder;
  adminId: string;
  creatorId: string;
}) {
  const before = await input.prisma.creatorPlan.findUniqueOrThrow({
    where: { creatorId: input.creatorId },
  });
  const order = await input.createManualOrder({
    admin: { id: input.adminId, role: "ops_admin" },
    creatorId: input.creatorId,
    orderType: "fan_code_pack",
    amount: "49.00",
    paymentMethod: "alipay",
    fanCodeQuotaDelta: 7,
    notes: "E2E fan-code package order",
  });
  if (order.orderType !== "fan_code_pack") {
    throw new Error(`Expected fan_code_pack order type, got ${order.orderType}`);
  }

  await input.confirmManualOrder(order.id, { id: input.adminId, role: "ops_admin" });
  const after = await input.prisma.creatorPlan.findUniqueOrThrow({
    where: { creatorId: input.creatorId },
  });
  if (after.fanCodeQuota !== before.fanCodeQuota + 7) {
    throw new Error(`Expected fan-code quota to increase by 7, got ${before.fanCodeQuota} -> ${after.fanCodeQuota}`);
  }

  const [ledgerCount, confirmedAuditCount] = await Promise.all([
    input.prisma.quotaLedgerEntry.count({
      where: {
        creatorId: input.creatorId,
        manualOrderId: order.id,
        resource: "fan_codes",
        entryType: "grant",
        amount: 7,
        createdByAdminId: input.adminId,
      },
    }),
    input.prisma.auditLog.count({
      where: {
        actorUserId: input.adminId,
        targetId: order.id,
        targetType: "ManualOrder",
        action: "manual_order.confirmed",
      },
    }),
  ]);
  if (ledgerCount < 1 || confirmedAuditCount < 1) {
    throw new Error(`Expected fan-code package ledger and confirmation audit log, got ${ledgerCount}/${confirmedAuditCount}`);
  }

  return { orderType: order.orderType, ledgerCount };
}

async function verifyManualOrderQuotaReductionRejected(input: {
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  createManualOrder: typeof import("../src/lib/admin").createManualOrder;
  confirmManualOrder: typeof import("../src/lib/orders").confirmManualOrder;
  adminId: string;
  creatorId: string;
}) {
  const order = await input.createManualOrder({
    admin: { id: input.adminId, role: "ops_admin" },
    creatorId: input.creatorId,
    orderType: "quota_adjustment",
    amount: "1.00",
    paymentMethod: "other",
    fanCodeQuotaDelta: -9999,
    notes: "E2E invalid quota reduction",
  });

  try {
    await input.confirmManualOrder(order.id, { id: input.adminId, role: "ops_admin" });
  } catch (error) {
    if (error instanceof Error && /reduce fan-code quota below current usage/.test(error.message)) {
      const unchanged = await input.prisma.manualOrder.findUniqueOrThrow({
        where: { id: order.id },
        select: { paymentStatus: true },
      });
      if (unchanged.paymentStatus !== "pending") {
        throw new Error(`Expected rejected quota reduction order to remain pending, got ${unchanged.paymentStatus}`);
      }
      return true;
    }
    throw error;
  }

  throw new Error("Expected manual order quota reduction below usage to be rejected");
}

async function verifyExpiredPlanBlocksNewFanSession(input: {
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  validateFanCode: typeof import("../src/lib/fan-code-service").validateFanCode;
  creatorId: string;
  projectSlug: string;
  code: string;
  suffix: string;
}) {
  await input.prisma.creatorPlan.update({
    where: { creatorId: input.creatorId },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });

  try {
    await input.validateFanCode({
      projectSlug: input.projectSlug,
      code: input.code,
      browserDeviceId: `expired-plan-device-${input.suffix}`,
      userAgent: "integration-e2e-expired-plan",
    });
  } catch (error) {
    if (error instanceof Error && /Creator plan is not active/.test(error.message)) {
      return true;
    }
    throw error;
  }

  throw new Error("Expected expired creator plan to reject new fan-code validation session");
}

async function verifyExpiredPlanBlocksViewerAssetAccess(input: {
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  authorizeViewerAssetAccess: typeof import("../src/lib/asset-access").authorizeViewerAssetAccess;
  projectId: string;
  viewerSessionId: string;
}) {
  const project = await input.prisma.project.findUniqueOrThrow({
    where: { id: input.projectId },
    include: { currentModelAsset: { select: { modelJsonPath: true } } },
  });
  if (!project.currentModelAsset?.modelJsonPath) {
    throw new Error("Expected project to have a current model before viewer asset access check");
  }

  try {
    await input.authorizeViewerAssetAccess(input.viewerSessionId, project.currentModelAsset.modelJsonPath);
  } catch (error) {
    if (error instanceof Error && /Creator plan is not active/.test(error.message)) {
      return true;
    }
    throw error;
  }

  throw new Error("Expected expired creator plan to reject viewer asset access");
}

async function verifyChatQuotaGuards(input: {
  generateFanCodeBatch: typeof import("../src/lib/fan-code-service").generateFanCodeBatch;
  validateFanCode: typeof import("../src/lib/fan-code-service").validateFanCode;
  deductSuccessfulChatQuota: typeof import("../src/lib/fan-code-service").deductSuccessfulChatQuota;
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  creatorId: string;
  projectId: string;
  projectSlug: string;
  suffix: string;
}) {
  const [singleUseCode] = await input.generateFanCodeBatch({
    projectId: input.projectId,
    creatorId: input.creatorId,
    quantity: 1,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    maxMessages: 1,
    bindMode: "none",
  });
  const singleUseSession = await input.validateFanCode({
    projectSlug: input.projectSlug,
    code: singleUseCode.code,
    browserDeviceId: `single-use-device-${input.suffix}`,
    userAgent: "integration-e2e-chat-quota",
  });

  const firstQuota = await input.prisma.$transaction((tx) =>
    input.deductSuccessfulChatQuota(tx, {
      creatorId: input.creatorId,
      projectId: input.projectId,
      fanAccessCodeId: singleUseSession.fanAccessCodeId,
      tokenEstimate: 1,
    }),
  );
  if (firstQuota.remainingMessages !== 0) {
    throw new Error(`Expected exhausted fan code to have 0 remaining messages, got ${firstQuota.remainingMessages}`);
  }

  const beforeSecondAttempt = await readChatQuotaState(input.prisma, input.creatorId, singleUseSession.fanAccessCodeId);
  let fanCodeQuotaExhaustedRejected = false;
  try {
    await input.prisma.$transaction((tx) =>
      input.deductSuccessfulChatQuota(tx, {
        creatorId: input.creatorId,
        projectId: input.projectId,
        fanAccessCodeId: singleUseSession.fanAccessCodeId,
        tokenEstimate: 1,
      }),
    );
  } catch (error) {
    if (error instanceof Error && /Access code message quota is exhausted/.test(error.message)) {
      fanCodeQuotaExhaustedRejected = true;
    } else {
      throw error;
    }
  }
  if (!fanCodeQuotaExhaustedRejected) {
    throw new Error("Expected exhausted fan code chat quota to reject a second deduction");
  }
  await assertChatQuotaStateUnchanged(input.prisma, input.creatorId, singleUseSession.fanAccessCodeId, beforeSecondAttempt);

  const [aiLimitedCode] = await input.generateFanCodeBatch({
    projectId: input.projectId,
    creatorId: input.creatorId,
    quantity: 1,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    maxMessages: 2,
    bindMode: "none",
  });
  const aiLimitedSession = await input.validateFanCode({
    projectSlug: input.projectSlug,
    code: aiLimitedCode.code,
    browserDeviceId: `ai-limited-device-${input.suffix}`,
    userAgent: "integration-e2e-ai-quota",
  });
  const planBeforeAiLimit = await input.prisma.creatorPlan.findUniqueOrThrow({
    where: { creatorId: input.creatorId },
  });
  await input.prisma.creatorPlan.update({
    where: { creatorId: input.creatorId },
    data: { usedAiMessages: planBeforeAiLimit.monthlyAiMessageLimit },
  });

  const beforeAiAttempt = await readChatQuotaState(input.prisma, input.creatorId, aiLimitedSession.fanAccessCodeId);
  let aiQuotaRollbackVerified = false;
  try {
    await input.prisma.$transaction((tx) =>
      input.deductSuccessfulChatQuota(tx, {
        creatorId: input.creatorId,
        projectId: input.projectId,
        fanAccessCodeId: aiLimitedSession.fanAccessCodeId,
        tokenEstimate: 1,
      }),
    );
  } catch (error) {
    if (error instanceof Error && /Creator AI quota is not available/.test(error.message)) {
      await assertChatQuotaStateUnchanged(input.prisma, input.creatorId, aiLimitedSession.fanAccessCodeId, beforeAiAttempt);
      aiQuotaRollbackVerified = true;
    } else {
      throw error;
    }
  } finally {
    await input.prisma.creatorPlan.update({
      where: { creatorId: input.creatorId },
      data: { usedAiMessages: planBeforeAiLimit.usedAiMessages },
    });
  }
  if (!aiQuotaRollbackVerified) {
    throw new Error("Expected exhausted creator AI quota to reject chat deduction and rollback fan code usage");
  }

  return { fanCodeQuotaExhaustedRejected, aiQuotaRollbackVerified };
}

async function readChatQuotaState(
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"],
  creatorId: string,
  fanAccessCodeId: string,
) {
  const [code, plan, chatUsageCount] = await Promise.all([
    prisma.fanAccessCode.findUniqueOrThrow({
      where: { id: fanAccessCodeId },
      select: { usedMessages: true },
    }),
    prisma.creatorPlan.findUniqueOrThrow({
      where: { creatorId },
      select: { usedAiMessages: true },
    }),
    prisma.chatUsage.count({ where: { creatorId, fanAccessCodeId } }),
  ]);

  return {
    usedMessages: code.usedMessages,
    usedAiMessages: plan.usedAiMessages,
    chatUsageCount,
  };
}

async function assertChatQuotaStateUnchanged(
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"],
  creatorId: string,
  fanAccessCodeId: string,
  before: { usedMessages: number; usedAiMessages: number; chatUsageCount: number },
) {
  const after = await readChatQuotaState(prisma, creatorId, fanAccessCodeId);
  if (
    after.usedMessages !== before.usedMessages ||
    after.usedAiMessages !== before.usedAiMessages ||
    after.chatUsageCount !== before.chatUsageCount
  ) {
    throw new Error(
      `Expected rejected chat quota deduction to leave usage unchanged, got fan=${before.usedMessages}->${after.usedMessages}, ai=${before.usedAiMessages}->${after.usedAiMessages}, chat=${before.chatUsageCount}->${after.chatUsageCount}`,
    );
  }
}

async function verifyFanCodeRevocation(input: {
  generateFanCodeBatch: typeof import("../src/lib/fan-code-service").generateFanCodeBatch;
  revokeFanAccessCode: typeof import("../src/lib/fan-code-service").revokeFanAccessCode;
  revokeFanCodeBatch: typeof import("../src/lib/fan-code-service").revokeFanCodeBatch;
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  creatorId: string;
  projectId: string;
}) {
  const codes = await input.generateFanCodeBatch({
    projectId: input.projectId,
    creatorId: input.creatorId,
    quantity: 2,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    maxMessages: 3,
    bindMode: "browserDevice",
  });

  await input.revokeFanAccessCode({
    codeId: codes[0].id,
    actor: { id: input.creatorId, role: "creator" },
    creatorId: input.creatorId,
  });
  const first = await input.prisma.fanAccessCode.findUniqueOrThrow({ where: { id: codes[0].id } });
  if (first.status !== "revoked") {
    throw new Error(`Expected individual fan code revoked, got ${first.status}`);
  }

  const batchResult = await input.revokeFanCodeBatch({
    batchId: codes[1].batchId,
    creatorId: input.creatorId,
  });
  if (batchResult.revokedCount < 1) {
    throw new Error("Expected fan code batch revoke to update at least one code");
  }

  const revokedBatchCount = await input.prisma.fanAccessCode.count({
    where: {
      batchId: codes[1].batchId,
      status: "revoked",
    },
  });
  const auditCount = await input.prisma.auditLog.count({
    where: {
      actorUserId: input.creatorId,
      action: { in: ["fan_code.revoked", "fan_code.batch_revoked"] },
    },
  });
  if (revokedBatchCount !== codes.length || auditCount < 2) {
    throw new Error(`Expected revoked batch count ${codes.length} and audit logs, got ${revokedBatchCount}/${auditCount}`);
  }
  const beforeQuotaFailure = await input.prisma.creatorPlan.findUniqueOrThrow({
    where: { creatorId: input.creatorId },
  });
  const quotaExceededRejected = await verifyFanCodeQuotaExceededRejected({
    generateFanCodeBatch: input.generateFanCodeBatch,
    prisma: input.prisma,
    creatorId: input.creatorId,
    projectId: input.projectId,
    expectedUsedFanCodes: beforeQuotaFailure.usedFanCodes,
  });

  return {
    revokedCodeCount: 1,
    revokedBatchCount,
    quotaExceededRejected,
  };
}

async function verifyFanCodeQuotaExceededRejected(input: {
  generateFanCodeBatch: typeof import("../src/lib/fan-code-service").generateFanCodeBatch;
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  creatorId: string;
  projectId: string;
  expectedUsedFanCodes: number;
}) {
  try {
    await input.generateFanCodeBatch({
      projectId: input.projectId,
      creatorId: input.creatorId,
      quantity: 3,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxMessages: 3,
      bindMode: "browserDevice",
    });
  } catch (error) {
    if (error instanceof Error && /Fan code quota exceeded/.test(error.message)) {
      const after = await input.prisma.creatorPlan.findUniqueOrThrow({
        where: { creatorId: input.creatorId },
      });
      if (after.usedFanCodes !== input.expectedUsedFanCodes) {
        throw new Error(`Expected rejected fan-code generation to leave usedFanCodes=${input.expectedUsedFanCodes}, got ${after.usedFanCodes}`);
      }
      return true;
    }
    throw error;
  }

  throw new Error("Expected fan-code generation above quota to be rejected");
}

async function verifyFanCodeDeviceBindingRaceRejected(input: {
  generateFanCodeBatch: typeof import("../src/lib/fan-code-service").generateFanCodeBatch;
  validateFanCode: typeof import("../src/lib/fan-code-service").validateFanCode;
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  creatorId: string;
  projectId: string;
  projectSlug: string;
  suffix: string;
}) {
  const [code] = await input.generateFanCodeBatch({
    projectId: input.projectId,
    creatorId: input.creatorId,
    quantity: 1,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    maxMessages: 2,
    bindMode: "browserDevice",
  });

  const attempts = await Promise.allSettled([
    input.validateFanCode({
      projectSlug: input.projectSlug,
      code: code.code,
      browserDeviceId: `binding-device-a-${input.suffix}`,
      userAgent: "integration-e2e-binding-a",
    }),
    input.validateFanCode({
      projectSlug: input.projectSlug,
      code: code.code,
      browserDeviceId: `binding-device-b-${input.suffix}`,
      userAgent: "integration-e2e-binding-b",
    }),
  ]);

  const fulfilled = attempts.filter((attempt): attempt is PromiseFulfilledResult<Awaited<ReturnType<typeof input.validateFanCode>>> => attempt.status === "fulfilled");
  const rejected = attempts.filter((attempt): attempt is PromiseRejectedResult => attempt.status === "rejected");
  if (fulfilled.length !== 1 || rejected.length !== 1) {
    throw new Error(`Expected exactly one device binding validation to succeed, got fulfilled=${fulfilled.length}, rejected=${rejected.length}`);
  }
  const rejectedReason = rejected[0].reason;
  if (!(rejectedReason instanceof Error) || !/bound to another device/.test(rejectedReason.message)) {
    throw rejectedReason instanceof Error ? rejectedReason : new Error("Expected losing device binding validation to be rejected");
  }

  const [viewerSessionCount, storedCode] = await Promise.all([
    input.prisma.viewerSession.count({ where: { fanAccessCodeId: code.id } }),
    input.prisma.fanAccessCode.findUniqueOrThrow({
      where: { id: code.id },
      select: { boundDeviceHash: true },
    }),
  ]);
  if (viewerSessionCount !== 1 || !storedCode.boundDeviceHash) {
    throw new Error(`Expected one bound viewer session, got sessions=${viewerSessionCount}, bound=${Boolean(storedCode.boundDeviceHash)}`);
  }

  return true;
}

async function verifyModelUploadOverwrite(input: {
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  uploadModelAsset: typeof import("../src/lib/model-assets").uploadModelAsset;
  creatorId: string;
  projectId: string;
}) {
  const previous = await input.prisma.modelAsset.create({
    data: {
      projectId: input.projectId,
      sourceZipUrl: "e2e/model-previous.zip",
      modelJsonPath: "e2e/previous/model.model3.json",
      assetBasePath: "e2e/previous",
      validationStatus: "valid",
      validationErrors: [],
      uploadedBy: "creator",
      version: 1,
    },
  });

  await input.prisma.project.update({
    where: { id: input.projectId },
    data: { currentModelAssetId: previous.id },
  });

  const modelAsset = await input.uploadModelAsset({
    projectId: input.projectId,
    creatorId: input.creatorId,
    fileName: "replacement-live2d.zip",
    data: await minimalLive2DZip(),
  });

  const [project, assetCount] = await Promise.all([
    input.prisma.project.findUniqueOrThrow({
      where: { id: input.projectId },
      include: { currentModelAsset: true },
    }),
    input.prisma.modelAsset.count({ where: { projectId: input.projectId } }),
  ]);
  if (project.currentModelAssetId !== modelAsset.id || assetCount !== 1) {
    throw new Error(`Expected model upload to overwrite previous asset, got current=${project.currentModelAssetId} count=${assetCount}`);
  }

  const auditCount = await input.prisma.auditLog.count({
    where: {
      actorUserId: input.creatorId,
      targetId: modelAsset.id,
      action: "model_asset.uploaded",
    },
  });
  if (auditCount < 1) {
    throw new Error("Expected model overwrite upload audit log");
  }

  return { assetCount, auditCount };
}

async function verifyInvalidModelUploadRecorded(input: {
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  uploadModelAsset: typeof import("../src/lib/model-assets").uploadModelAsset;
  creatorId: string;
  projectId: string;
}) {
  const invalidProject = await input.prisma.project.create({
    data: {
      creatorId: input.creatorId,
      name: "E2E Invalid Model Project",
      slug: `e2e-invalid-model-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      intro: "Invalid upload should replace previous model state.",
      systemPrompt: "Invalid upload prompt.",
      welcomeMessage: "Invalid upload.",
      status: "draft",
    },
  });
  const modelAsset = await input.uploadModelAsset({
    projectId: invalidProject.id,
    creatorId: input.creatorId,
    fileName: "invalid-live2d.zip",
    data: Buffer.from("not a readable zip"),
  });

  if (modelAsset.validationStatus !== "invalid") {
    throw new Error(`Expected invalid model upload to be recorded as invalid, got ${modelAsset.validationStatus}`);
  }
  const errors = Array.isArray(modelAsset.validationErrors) ? modelAsset.validationErrors.join("\n") : String(modelAsset.validationErrors ?? "");
  if (!/not a readable zip file/.test(errors)) {
    throw new Error(`Expected invalid model upload to record unreadable zip error, got ${errors}`);
  }

  const [projectState, auditCount] = await Promise.all([
    input.prisma.project.findUniqueOrThrow({
      where: { id: invalidProject.id },
      select: { currentModelAssetId: true },
    }),
    input.prisma.auditLog.count({
      where: {
        actorUserId: input.creatorId,
        targetId: modelAsset.id,
        action: "model_asset.uploaded",
      },
    }),
  ]);
  if (projectState.currentModelAssetId) {
    throw new Error("Expected invalid model upload to leave the project without a current model");
  }
  if (auditCount < 1) {
    throw new Error("Expected invalid model upload audit log");
  }

  return true;
}

async function cleanup(prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"], creatorId: string, projectId: string, adminId = "", supportAdminId = "") {
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorUserId: creatorId },
        { actorUserId: adminId || undefined },
        { actorUserId: supportAdminId || undefined },
        { targetId: projectId },
      ],
    },
  });
  await prisma.manualOrder.deleteMany({ where: { OR: [{ creatorId }, { createdByAdminId: adminId || undefined }] } });
  await prisma.user.deleteMany({
    where: { id: { in: [creatorId, adminId, supportAdminId].filter(Boolean) } },
  });
}

async function verifyAdminAssistedModelUpload(input: {
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
  uploadModelAsset: typeof import("../src/lib/model-assets").uploadModelAsset;
  adminId: string;
  creatorId: string;
  projectId: string;
}) {
  const buffer = await minimalLive2DZip();
  const modelAsset = await input.uploadModelAsset({
    projectId: input.projectId,
    creatorId: input.creatorId,
    actorId: input.adminId,
    actorRole: "ops_admin",
    uploadedBy: "admin",
    fileName: "admin-assisted-model.zip",
    data: buffer,
  });

  if (modelAsset.uploadedBy !== "admin" || modelAsset.validationStatus !== "valid") {
    throw new Error(`Expected valid admin-uploaded model, got ${modelAsset.uploadedBy}/${modelAsset.validationStatus}`);
  }

  const project = await input.prisma.project.findUniqueOrThrow({
    where: { id: input.projectId },
    include: { currentModelAsset: true },
  });
  if (project.currentModelAssetId !== modelAsset.id || project.currentModelAsset?.version !== modelAsset.version) {
    throw new Error("Expected admin model upload to become the current model");
  }

  const auditCount = await input.prisma.auditLog.count({
    where: {
      actorUserId: input.adminId,
      targetId: modelAsset.id,
      action: "model_asset.uploaded",
    },
  });
  if (auditCount < 1) {
    throw new Error("Expected admin model upload audit log");
  }

  return { version: modelAsset.version, auditCount };
}

async function minimalLive2DZip() {
  const zip = new JSZip();
  zip.file(
    "avatar/avatar.model3.json",
    JSON.stringify({
      Version: 3,
      FileReferences: {
        Moc: "avatar.moc3",
        Textures: ["textures/texture_00.png"],
      },
    }),
  );
  zip.file("avatar/avatar.moc3", Buffer.from("moc"));
  zip.file("avatar/textures/texture_00.png", Buffer.from("png"));
  return zip.generateAsync({ type: "nodebuffer" });
}

async function verifyPasswordAuth(input: {
  creatorUsername: string;
  creatorPassword: string;
  signInWithPassword: typeof import("../src/auth").signInWithPassword;
  prisma: Awaited<typeof import("../src/lib/prisma")>["prisma"];
}) {
  const response = NextResponse.redirect(new URL("/", process.env.AUTH_URL || "http://localhost:3000"));
  const redirectPath = await input.signInWithPassword(input.creatorUsername, input.creatorPassword, response);
  if (redirectPath !== "/creator") {
    throw new Error(`Expected password auth to redirect creator to /creator, got ${redirectPath}`);
  }

  const sessionCount = await input.prisma.session.count({
    where: {
      user: {
        username: input.creatorUsername,
      },
      expires: {
        gt: new Date(),
      },
    },
  });

  const setCookie = response.headers.get("set-cookie") || "";
  if (sessionCount < 1) {
    throw new Error("Expected password auth to create a database session");
  }
  if (!setCookie.includes("live2d_session=")) {
    throw new Error("Expected password auth to set the session cookie");
  }

  return {
    passwordAccepted: true,
    sessionCreated: true,
    cookieSet: true,
  };
}

function valueAfter(flag: string) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function integrationEnvKeys() {
  return [
    ...Object.keys(loadEnvFileForScript(".env.example").env),
    "E2E_KEEP_DATA",
  ];
}

function printHelp() {
  console.log(`Run database-backed integration E2E flow.

Usage:
  npm run integration:e2e
  npm run integration:e2e -- --app-env-file .env.integration

Checks:
  - creator/project/tag creation
  - first-party password login and database session creation
  - fan-code generation
  - browser-device fan-code binding allows only one device under concurrent validation
  - fan-code validation and viewer session creation
  - AI proxy call
  - successful chat quota deduction
  - authoritative remaining message count after chat deduction
  - chat usage and quota ledger writes
  - rejected chat quota deductions do not exceed fan-code or AI quota
  - creator project quota-exceeded rejection
  - Live2D model upload overwrites the previous model record and writes an audit log
  - fan-code single and batch revocation with audit logs, plus quota-exceeded rejection
  - admin-assisted Live2D model upload with audit log write
  - invalid Live2D model uploads are recorded with validation errors and leave no current model
  - triggered tag Live2D parameter effect generation
  - expired creator plans reject new fan-code validation sessions
  - expired creator plans reject existing viewer asset access
  - manual order creation audit log write
  - invalid manual order amounts are rejected before persistence
  - no-op manual orders are rejected before persistence
  - invalid manual order plan periods are rejected before persistence or confirmation
  - fan-code package manual order confirmation writes plan quota, ledger, and audit logs
  - manual order quota reductions cannot go below current usage
  - cross-creator authenticated asset access rejection
  - logged-in unrelated users can still access viewer-authorized assets with a valid viewer session
  - admin emergency model upload on expired creator plan
  - support admin support note audit log write
  - support admin notes require an existing target when scoped
  - ops admin creator creation normalizes username and writes custom initial plan quotas and audit logs
  - ops admin creator creation rejects expired initial plan periods
  - ops admin creator creation cannot replace admin accounts
  - ops admin fan-code and storage quota grants with ledger and audit log writes, limited to creator accounts
  - public companion listings hide draft projects
  - ops admin creator suspend and restore with audit log writes, and suspended creators reject public viewer access
  - creator model setup assistance request writes an admin-visible audit log
  - publishing a project without a valid Live2D model is rejected
`);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: formatError(error) }, null, 2));
  process.exitCode = 1;
});

function formatError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Unknown failure";
  }
  return error.message || inspect(error, { depth: 2, breakLength: 120 });
}
