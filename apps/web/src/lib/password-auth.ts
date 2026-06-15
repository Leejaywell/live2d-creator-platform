import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);
const keyLength = 64;
const saltBytes = 16;
const prefix = "scrypt";

export function assertPasswordAllowed(password: string) {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
}

export async function hashPassword(password: string) {
  assertPasswordAllowed(password);
  const salt = crypto.randomBytes(saltBytes).toString("base64url");
  const derived = (await scrypt(password, salt, keyLength)) as Buffer;
  return `${prefix}$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;
  const [algorithm, salt, encoded] = storedHash.split("$");
  if (algorithm !== prefix || !salt || !encoded) return false;

  const expected = Buffer.from(encoded, "base64url");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
