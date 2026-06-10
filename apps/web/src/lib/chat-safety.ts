export type ContentModerationMode = "off" | "basic" | "strict";

export type ChatSafetyPolicy = {
  contentModeration: ContentModerationMode;
  maxFanMessageLength: number;
};

export type ChatSafetyViolationCode = "empty_message" | "message_too_long" | "prompt_safety" | "content_safety";

export class ChatSafetyError extends Error {
  code: ChatSafetyViolationCode;
  severity: "low" | "medium" | "high";

  constructor(input: { code: ChatSafetyViolationCode; message: string; severity: "low" | "medium" | "high" }) {
    super(input.message);
    this.name = "ChatSafetyError";
    this.code = input.code;
    this.severity = input.severity;
  }
}

const promptLeakPattern = /system prompt|api key|secret|bypass|ignore previous|developer message|hidden instruction|访问限制|系统提示词|密钥/i;
const abusePattern = /\b(kill yourself|kys|doxx|swat|terrorist attack)\b|未成年色情|人肉搜索/i;

export function enforceChatSafety(message: string, policy: ChatSafetyPolicy) {
  const normalized = message.trim();
  if (!normalized) {
    throw new ChatSafetyError({ code: "empty_message", message: "Message is required", severity: "low" });
  }
  if (normalized.length > policy.maxFanMessageLength) {
    throw new ChatSafetyError({
      code: "message_too_long",
      message: `Message exceeds ${policy.maxFanMessageLength} character limit`,
      severity: "medium",
    });
  }
  if (policy.contentModeration === "off") {
    return normalized;
  }
  if (promptLeakPattern.test(normalized)) {
    throw new ChatSafetyError({ code: "prompt_safety", message: "Message violates prompt safety rules", severity: "high" });
  }
  if (policy.contentModeration === "strict" && abusePattern.test(normalized)) {
    throw new ChatSafetyError({ code: "content_safety", message: "Message violates content safety rules", severity: "high" });
  }
  return normalized;
}

export function isChatSafetyError(error: unknown): error is ChatSafetyError {
  return error instanceof ChatSafetyError;
}
