-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('super_admin', 'ops_admin', 'support_admin', 'creator');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('active', 'expired', 'paused');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('plan', 'fan_code_pack', 'quota_adjustment');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('wechat', 'alipay', 'bank_transfer', 'other');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'confirmed', 'refunded', 'void');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('grant', 'consume', 'adjustment', 'expiration_reset');

-- CreateEnum
CREATE TYPE "QuotaResource" AS ENUM ('ai_messages', 'fan_codes', 'storage_mb', 'projects');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('draft', 'published', 'paused');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('pending', 'valid', 'invalid');

-- CreateEnum
CREATE TYPE "AssetUploader" AS ENUM ('creator', 'admin');

-- CreateEnum
CREATE TYPE "VoiceStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "FanCodeBindMode" AS ENUM ('none', 'browserDevice');

-- CreateEnum
CREATE TYPE "FanCodeStatus" AS ENUM ('active', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "VoiceCloneStatus" AS ENUM ('submitted', 'reviewing', 'approved', 'rejected', 'fulfilled');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "wechatOpenId" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'creator',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "CreatorProfile" (
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CreatorPlan" (
    "creatorId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxProjects" INTEGER NOT NULL,
    "storageLimitMb" INTEGER NOT NULL,
    "monthlyAiMessageLimit" INTEGER NOT NULL,
    "fanCodeQuota" INTEGER NOT NULL,
    "usedAiMessages" INTEGER NOT NULL DEFAULT 0,
    "usedStorageMb" INTEGER NOT NULL DEFAULT 0,
    "usedFanCodes" INTEGER NOT NULL DEFAULT 0,
    "status" "PlanStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorPlan_pkey" PRIMARY KEY ("creatorId")
);

-- CreateTable
CREATE TABLE "ManualOrder" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "orderType" "OrderType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "planName" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "projectQuotaDelta" INTEGER NOT NULL DEFAULT 0,
    "aiMessageQuotaDelta" INTEGER NOT NULL DEFAULT 0,
    "storageQuotaDeltaMb" INTEGER NOT NULL DEFAULT 0,
    "fanCodeQuotaDelta" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdByAdminId" TEXT NOT NULL,
    "confirmedByAdminId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaLedgerEntry" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "manualOrderId" TEXT,
    "entryType" "LedgerEntryType" NOT NULL,
    "resource" "QuotaResource" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotaLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "intro" TEXT,
    "systemPrompt" TEXT NOT NULL,
    "welcomeMessage" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT '#0f766e',
    "status" "ProjectStatus" NOT NULL DEFAULT 'draft',
    "currentModelAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceZipUrl" TEXT NOT NULL,
    "modelJsonPath" TEXT,
    "assetBasePath" TEXT,
    "validationStatus" "ValidationStatus" NOT NULL DEFAULT 'pending',
    "validationErrors" JSONB,
    "uploadedBy" "AssetUploader" NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "durationMs" INTEGER,
    "tags" TEXT[],
    "status" "VoiceStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TriggerTag" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "keywords" TEXT[],
    "promptFragment" TEXT,
    "live2dExpression" TEXT,
    "live2dParams" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TriggerTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FanAccessCode" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxMessages" INTEGER NOT NULL,
    "usedMessages" INTEGER NOT NULL DEFAULT 0,
    "bindMode" "FanCodeBindMode" NOT NULL DEFAULT 'browserDevice',
    "boundDeviceHash" TEXT,
    "status" "FanCodeStatus" NOT NULL DEFAULT 'active',
    "batchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FanAccessCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewerSession" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fanAccessCodeId" TEXT NOT NULL,
    "deviceHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ViewerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatUsage" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fanAccessCodeId" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL,
    "tokenEstimate" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceCloneRequest" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "VoiceCloneStatus" NOT NULL DEFAULT 'submitted',
    "authorizationConfirmed" BOOLEAN NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceCloneRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" "UserRole",
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TriggerTagVoiceAssets" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TriggerTagVoiceAssets_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_wechatOpenId_key" ON "User"("wechatOpenId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Project_currentModelAssetId_key" ON "Project"("currentModelAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelAsset_projectId_version_key" ON "ModelAsset"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "TriggerTag_projectId_name_key" ON "TriggerTag"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "FanAccessCode_codeHash_key" ON "FanAccessCode"("codeHash");

-- CreateIndex
CREATE INDEX "FanAccessCode_projectId_batchId_idx" ON "FanAccessCode"("projectId", "batchId");

-- CreateIndex
CREATE UNIQUE INDEX "ViewerSession_fanAccessCodeId_deviceHash_key" ON "ViewerSession"("fanAccessCodeId", "deviceHash");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "_TriggerTagVoiceAssets_B_index" ON "_TriggerTagVoiceAssets"("B");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorProfile" ADD CONSTRAINT "CreatorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorPlan" ADD CONSTRAINT "CreatorPlan_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualOrder" ADD CONSTRAINT "ManualOrder_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualOrder" ADD CONSTRAINT "ManualOrder_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualOrder" ADD CONSTRAINT "ManualOrder_confirmedByAdminId_fkey" FOREIGN KEY ("confirmedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaLedgerEntry" ADD CONSTRAINT "QuotaLedgerEntry_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaLedgerEntry" ADD CONSTRAINT "QuotaLedgerEntry_manualOrderId_fkey" FOREIGN KEY ("manualOrderId") REFERENCES "ManualOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaLedgerEntry" ADD CONSTRAINT "QuotaLedgerEntry_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_currentModelAssetId_fkey" FOREIGN KEY ("currentModelAssetId") REFERENCES "ModelAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelAsset" ADD CONSTRAINT "ModelAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceAsset" ADD CONSTRAINT "VoiceAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriggerTag" ADD CONSTRAINT "TriggerTag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanAccessCode" ADD CONSTRAINT "FanAccessCode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewerSession" ADD CONSTRAINT "ViewerSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewerSession" ADD CONSTRAINT "ViewerSession_fanAccessCodeId_fkey" FOREIGN KEY ("fanAccessCodeId") REFERENCES "FanAccessCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatUsage" ADD CONSTRAINT "ChatUsage_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatUsage" ADD CONSTRAINT "ChatUsage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatUsage" ADD CONSTRAINT "ChatUsage_fanAccessCodeId_fkey" FOREIGN KEY ("fanAccessCodeId") REFERENCES "FanAccessCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCloneRequest" ADD CONSTRAINT "VoiceCloneRequest_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceCloneRequest" ADD CONSTRAINT "VoiceCloneRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TriggerTagVoiceAssets" ADD CONSTRAINT "_TriggerTagVoiceAssets_A_fkey" FOREIGN KEY ("A") REFERENCES "TriggerTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TriggerTagVoiceAssets" ADD CONSTRAINT "_TriggerTagVoiceAssets_B_fkey" FOREIGN KEY ("B") REFERENCES "VoiceAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
