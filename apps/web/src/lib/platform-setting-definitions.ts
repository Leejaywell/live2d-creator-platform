import { PlatformSettingCategory } from "@prisma/client";
import { z } from "zod";

export type PlatformSettingValue = string | number | boolean;

export type PlatformSettingDefinition = {
  key: string;
  category: PlatformSettingCategory;
  label: string;
  description: string;
  valueType: "string" | "number" | "float" | "boolean" | "enum";
  defaultValue: PlatformSettingValue;
  options?: string[];
  /** Inclusive bounds for "number" / "float" value types. */
  min?: number;
  max?: number;
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
    key: "ai.baseUrl",
    category: "ai",
    label: "AI base URL",
    description: "OpenAI-compatible base URL of the chosen provider.",
    valueType: "string",
    defaultValue: "https://api.openai.com/v1",
  },
  {
    key: "ai.apiKey",
    category: "ai",
    label: "AI API key",
    description: "Secret API key for the chosen provider (stored server-side only).",
    valueType: "string",
    defaultValue: "",
    isSecret: true,
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
    key: "ai.temperature",
    category: "ai",
    label: "Temperature",
    description: "Sampling temperature sent to the AI provider (0 = deterministic, 2 = most creative).",
    valueType: "float",
    defaultValue: 0.7,
    min: 0,
    max: 2,
  },
  {
    key: "storage.deliveryMode",
    category: "storage",
    label: "Asset delivery",
    description: "How protected model assets are served to browsers.",
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
  // NOTE: the "payments.checkout" setting was removed from the admin UI. The
  // runtime `checkoutMode` still exists (see getPlatformRuntimeSettings) and
  // defaults to "manual-only" — billing/webhook logic depends on it.
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
    case "float": {
      const min = definition.min ?? 0;
      const max = definition.max ?? Number.MAX_SAFE_INTEGER;
      return z.number().min(min).max(max).parse(value);
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
