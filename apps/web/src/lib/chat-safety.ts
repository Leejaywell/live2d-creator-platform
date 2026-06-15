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

const promptLeakPattern = /systemprompt|apikey|secret|bypass|ignoreprevious|developermessage|hiddeninstruction|访问限制|系统提示词|密钥/i;
const abusePattern = /killyourself|kys|doxx|swat|terroristattack|未成年色情|人肉搜索/i;

export function normalizeForSafetyCheck(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\-_.*+?^${}()|[\]\\~`!@#%&:;"'<>,]/g, "");
}

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
  const searchStr = normalizeForSafetyCheck(normalized);
  if (promptLeakPattern.test(searchStr)) {
    throw new ChatSafetyError({ code: "prompt_safety", message: "Message violates prompt safety rules", severity: "high" });
  }
  if (policy.contentModeration === "strict" && abusePattern.test(searchStr)) {
    throw new ChatSafetyError({ code: "content_safety", message: "Message violates content safety rules", severity: "high" });
  }
  return normalized;
}

export function enforceChatOutputSafety(reply: string, policy: { contentModeration: ContentModerationMode }) {
  if (policy.contentModeration === "off") {
    return reply;
  }
  const searchStr = normalizeForSafetyCheck(reply);
  if (promptLeakPattern.test(searchStr)) {
    throw new ChatSafetyError({ code: "prompt_safety", message: "AI response violates prompt safety rules", severity: "high" });
  }
  if (policy.contentModeration === "strict" && abusePattern.test(searchStr)) {
    throw new ChatSafetyError({ code: "content_safety", message: "AI response violates content safety rules", severity: "high" });
  }
  return reply;
}

export function isChatSafetyError(error: unknown): error is ChatSafetyError {
  return error instanceof ChatSafetyError;
}
