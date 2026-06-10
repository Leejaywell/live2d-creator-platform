import { PlatformSettingCategory } from "@prisma/client";
import { z } from "zod";

export type PlatformSettingValue = string | number | boolean;

export type PlatformSettingDefinition = {
  key: string;
  category: PlatformSettingCategory;
  label: string;
  description: string;
  valueType: "string" | "number" | "boolean" | "enum";
  defaultValue: PlatformSettingValue;
  options?: string[];
  isSecret?: boolean;
};

export const platformSettingDefinitions: readonly PlatformSettingDefinition[] = [
  {
    key: "ai.provider",
    category: "ai",
    label: "AI provider",
    description: "OpenAI-compatible provider used by the backend chat proxy.",
    valueType: "enum",
    defaultValue: "openai-compatible",
    options: ["openai-compatible", "disabled"],
  },
  {
    key: "ai.chatModel",
    category: "ai",
    label: "Chat model",
    description: "Default model name sent to the configured AI provider.",
    valueType: "string",
    defaultValue: "gpt-4.1-mini",
  },
  {
    key: "tts.provider",
    category: "tts",
    label: "TTS provider",
    description: "Mode for future generated speech; preset voice clips remain available either way.",
    valueType: "enum",
    defaultValue: "preset-only",
    options: ["preset-only", "external-provider", "disabled"],
  },
  {
    key: "storage.deliveryMode",
    category: "storage",
    label: "Asset delivery",
    description: "How protected model and voice assets are served to browsers.",
    valueType: "enum",
    defaultValue: "app-proxy",
    options: ["app-proxy", "signed-redirect"],
  },
  {
    key: "security.contentModeration",
    category: "security",
    label: "Content moderation",
    description: "Operational moderation mode for fan messages before AI provider calls.",
    valueType: "enum",
    defaultValue: "basic",
    options: ["off", "basic", "strict"],
  },
  {
    key: "security.maxFanMessageLength",
    category: "security",
    label: "Max fan message length",
    description: "Maximum accepted fan message length in characters.",
    valueType: "number",
    defaultValue: 1200,
  },
  {
    key: "integrations.wechatLogin",
    category: "integrations",
    label: "WeChat login",
    description: "Login integration status. Credentials stay in deployment secrets.",
    valueType: "enum",
    defaultValue: "reserved",
    options: ["reserved", "sandbox", "enabled", "disabled"],
  },
  {
    key: "payments.checkout",
    category: "payments",
    label: "Checkout mode",
    description: "Commercial source of truth for creator plans and fan-code packages.",
    valueType: "enum",
    defaultValue: "manual-only",
    options: ["manual-only", "provider-sandbox", "provider-live"],
  },
  {
    key: "voiceCloning.fulfillment",
    category: "voice_cloning",
    label: "Voice cloning fulfillment",
    description: "Voice-clone request intake is paused unless explicitly enabled for manual review.",
    valueType: "enum",
    defaultValue: "disabled",
    options: ["manual-review", "provider-sandbox", "provider-live", "disabled"],
  },
];

export function platformSettingDefinitionFor(key: string) {
  return platformSettingDefinitions.find((definition) => definition.key === key);
}

export function parsePlatformSettingValue(definition: PlatformSettingDefinition, value: unknown): PlatformSettingValue {
  switch (definition.valueType) {
    case "boolean":
      return z.boolean().parse(value);
    case "number": {
      const parsed = z.number().int().positive().max(10000).parse(value);
      return parsed;
    }
    case "enum": {
      const parsed = z.string().trim().min(1).parse(value);
      if (!definition.options?.includes(parsed)) {
        throw new Error(`Unsupported value for ${definition.key}`);
      }
      return parsed;
    }
    case "string":
      return z.string().trim().min(1).max(200).parse(value);
  }
}
