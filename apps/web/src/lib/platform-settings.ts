import { Prisma, UserRole } from "@prisma/client";

import { assertPermission } from "@/lib/permissions";
import {
  parsePlatformSettingValue,
  platformSettingDefinitionFor,
  platformSettingDefinitions,
  type PlatformSettingDefinition,
  type PlatformSettingValue,
} from "@/lib/platform-setting-definitions";
import { prisma } from "@/lib/prisma";

export type PlatformSettingView = PlatformSettingDefinition & {
  value: PlatformSettingValue;
  source: "default" | "database";
  updatedAt?: Date;
};

export type WechatLoginMode = "reserved" | "sandbox" | "enabled" | "disabled";

export type PlatformRuntimeSettings = {
  aiProvider: "openai-compatible" | "disabled";
  aiChatModel: string;
  contentModeration: "off" | "basic" | "strict";
  maxFanMessageLength: number;
  ttsProvider: "preset-only" | "external-provider" | "disabled";
  assetDeliveryMode: "app-proxy" | "signed-redirect";
  checkoutMode: "manual-only" | "provider-sandbox" | "provider-live";
  wechatLogin: WechatLoginMode;
  voiceCloningFulfillment: "manual-review" | "provider-sandbox" | "provider-live" | "disabled";
};

export async function listPlatformSettings() {
  const stored = await prisma.platformSetting.findMany();
  const storedByKey = new Map(stored.map((setting) => [setting.key, setting]));

  return platformSettingDefinitions.map((definition) => {
    const storedSetting = storedByKey.get(definition.key);
    return {
      ...definition,
      value: storedSetting ? normalizeStoredSettingValue(definition, storedSetting.value) : definition.defaultValue,
      source: storedSetting ? "database" : "default",
      updatedAt: storedSetting?.updatedAt,
    } satisfies PlatformSettingView;
  });
}

export async function getPlatformRuntimeSettings(): Promise<PlatformRuntimeSettings> {
  const settings = await listPlatformSettings();
  const byKey = new Map(settings.map((setting) => [setting.key, setting.value]));

  return {
    aiProvider: parseRuntimeEnum(byKey.get("ai.provider"), ["openai-compatible", "disabled"], "openai-compatible"),
    aiChatModel: parseRuntimeString(byKey.get("ai.chatModel"), "gpt-4.1-mini"),
    contentModeration: parseRuntimeEnum(byKey.get("security.contentModeration"), ["off", "basic", "strict"], "basic"),
    maxFanMessageLength: parseRuntimeNumber(byKey.get("security.maxFanMessageLength"), 1200),
    ttsProvider: parseRuntimeEnum(byKey.get("tts.provider"), ["preset-only", "external-provider", "disabled"], "preset-only"),
    assetDeliveryMode: parseRuntimeEnum(byKey.get("storage.deliveryMode"), ["app-proxy", "signed-redirect"], "app-proxy"),
    checkoutMode: parseRuntimeEnum(byKey.get("payments.checkout"), ["manual-only", "provider-sandbox", "provider-live"], "manual-only"),
    wechatLogin: parseRuntimeEnum(byKey.get("integrations.wechatLogin"), ["reserved", "sandbox", "enabled", "disabled"], "reserved"),
    voiceCloningFulfillment: parseRuntimeEnum(
      byKey.get("voiceCloning.fulfillment"),
      ["manual-review", "provider-sandbox", "provider-live", "disabled"],
      "disabled",
    ),
  };
}

export async function upsertPlatformSetting(input: {
  admin: { id: string; role: UserRole };
  key: string;
  value: unknown;
}) {
  assertPermission(input.admin.role, "provider_secrets.manage");
  const definition = platformSettingDefinitionFor(input.key);
  if (!definition) {
    throw new Error("Unsupported platform setting");
  }

  const value = parsePlatformSettingValue(definition, input.value);

  return prisma.$transaction(async (tx) => {
    const before = await tx.platformSetting.findUnique({
      where: { key: definition.key },
    });
    const setting = await tx.platformSetting.upsert({
      where: { key: definition.key },
      update: {
        category: definition.category,
        label: definition.label,
        description: definition.description,
        value: value as Prisma.InputJsonValue,
        isSecret: definition.isSecret ?? false,
        updatedByAdminId: input.admin.id,
      },
      create: {
        key: definition.key,
        category: definition.category,
        label: definition.label,
        description: definition.description,
        value: value as Prisma.InputJsonValue,
        isSecret: definition.isSecret ?? false,
        updatedByAdminId: input.admin.id,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.admin.id,
        actorRole: input.admin.role,
        action: "platform_setting.upserted",
        targetType: "PlatformSetting",
        targetId: setting.key,
        before: sanitizeSettingForAudit(before?.value),
        after: sanitizeSettingForAudit(setting.value),
      },
    });

    return setting;
  });
}

function normalizeStoredSettingValue(definition: PlatformSettingDefinition, value: Prisma.JsonValue): PlatformSettingValue {
  try {
    return parsePlatformSettingValue(definition, value);
  } catch {
    return definition.defaultValue;
  }
}

function sanitizeSettingForAudit(value: Prisma.JsonValue | undefined) {
  if (value === undefined) return undefined;
  return { value } as Prisma.InputJsonValue;
}

function parseRuntimeEnum<const T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function parseRuntimeString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function parseRuntimeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}
