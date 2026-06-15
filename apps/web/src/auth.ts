import crypto from "node:crypto";

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { normalizeUsername } from "@/lib/account-identity";
import { verifyPassword } from "@/lib/password-auth";
import { prisma } from "@/lib/prisma";

const sessionCookieName = "live2d_session";
const sessionMaxAgeMs = Number(process.env.AUTH_SESSION_MAX_AGE_DAYS || 30) * 24 * 60 * 60 * 1000;

export type AuthSession = {
  user: {
    id: string;
    username: string | null;
    role: "super_admin" | "ops_admin" | "support_admin" | "creator";
    status: "active" | "suspended";
  };
};

export async function getCurrentSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken: hashToken(token) },
    include: { user: true },
  });

  if (!session || session.expires <= new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    }
    return null;
  }

  return {
    user: {
      id: session.user.id,
      username: session.user.username,
      role: session.user.role,
      status: session.user.status,
    },
  };
}

export async function signInWithPassword(username: string, password: string, response: NextResponse) {
  const normalizedUsername = normalizeUsername(username);

  const user = await prisma.user.findUnique({ where: { username: normalizedUsername } });
  if (!user || user.status !== "active" || !(await verifyPassword(password, user.passwordHash))) {
    throw new Error("Invalid username or password");
  }

  return createSessionForUser(user.id, response);
}

async function createSessionForUser(userId: string, response: NextResponse) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const sessionToken = randomToken();
  const expires = new Date(Date.now() + sessionMaxAgeMs);
  await prisma.session.create({
    data: {
      sessionToken: hashToken(sessionToken),
      userId: user.id,
      expires,
    },
  });

  response.cookies.set(sessionCookieName, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });

  return user.role === "creator" ? "/creator" : "/admin";
}

export async function clearCurrentSession(request: NextRequest, response: NextResponse) {
  const token = request.cookies.get(sessionCookieName)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { sessionToken: hashToken(token) } });
  }
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function authCookieName() {
  return sessionCookieName;
}

function randomToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
