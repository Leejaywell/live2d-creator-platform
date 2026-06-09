import crypto from "node:crypto";

import { FanCodeBindMode } from "@prisma/client";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function getHashSecret() {
  const secret = process.env.FAN_CODE_HASH_SECRET;
  if (!secret) {
    throw new Error("FAN_CODE_HASH_SECRET is required");
  }
  return secret;
}

export function generateFanCode(prefix = "L2D") {
  const bytes = crypto.randomBytes(10);
  let body = "";
  for (const byte of bytes) {
    body += alphabet[byte % alphabet.length];
  }
  return `${prefix}-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8)}`;
}

export function hashFanCode(code: string) {
  return crypto
    .createHmac("sha256", getHashSecret())
    .update(code.trim().toUpperCase())
    .digest("hex");
}

export function hashBrowserDevice(deviceId: string, userAgent: string) {
  return crypto
    .createHmac("sha256", getHashSecret())
    .update(`${deviceId}:${userAgent.slice(0, 160)}`)
    .digest("hex");
}

export function shouldBindDevice(bindMode: FanCodeBindMode) {
  return bindMode === "browserDevice";
}
