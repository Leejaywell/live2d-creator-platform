export type FanCodeStatusInput = {
  status: string;
  expiresAt: Date;
  usedMessages: number;
  maxMessages: number;
  boundDeviceHash: string | null;
};

export function fanCodeDisplayStatus(code: FanCodeStatusInput, now = new Date()) {
  if (code.status === "revoked") return "revoked";
  if (code.status === "expired" || code.expiresAt <= now) return "expired";
  if (code.usedMessages >= code.maxMessages) return "used up";
  if (code.boundDeviceHash) return "bound";
  return "unused";
}
