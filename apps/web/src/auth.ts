import crypto from "node:crypto";

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/smtp";

const sessionCookieName = "live2d_session";
const magicLinkMaxAgeMs = 15 * 60 * 1000;
const sessionMaxAgeMs = Number(process.env.AUTH_SESSION_MAX_AGE_DAYS || 30) * 24 * 60 * 60 * 1000;

export type AuthSession = {
  user: {
    id: string;
    email: string;
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
      email: session.user.email,
      role: session.user.role,
      status: session.user.status,
    },
  };
}

export async function requestMagicLink(email: string, origin: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("Enter a valid email address");
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || user.status !== "active") {
    return;
  }

  const token = randomToken();
  await prisma.verificationToken.create({
    data: {
      identifier: normalizedEmail,
      token: hashToken(token),
      expires: new Date(Date.now() + magicLinkMaxAgeMs),
    },
  });

  const url = new URL("/api/auth/callback", process.env.AUTH_URL || origin);
  url.searchParams.set("email", normalizedEmail);
  url.searchParams.set("token", token);

  await sendMail({
    to: normalizedEmail,
    subject: "Sign in to Live2D Creator Platform",
    text: `Use this link to sign in:\n\n${url.toString()}\n\nThis link expires in 15 minutes.`,
    html: `<p>Use this link to sign in:</p><p><a href="${escapeHtml(url.toString())}">Sign in</a></p><p>This link expires in 15 minutes.</p>`,
  });
}

export async function consumeMagicLink(email: string, token: string, response: NextResponse) {
  const normalizedEmail = email.trim().toLowerCase();
  const hashedToken = hashToken(token);
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token: hashedToken },
  });

  if (!verificationToken || verificationToken.identifier !== normalizedEmail || verificationToken.expires <= new Date()) {
    if (verificationToken) {
      await prisma.verificationToken.delete({ where: { token: hashedToken } }).catch(() => undefined);
    }
    throw new Error("Invalid or expired sign-in link");
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || user.status !== "active") {
    throw new Error("Account is not active");
  }

  const sessionToken = randomToken();
  const expires = new Date(Date.now() + sessionMaxAgeMs);
  await prisma.$transaction([
    prisma.verificationToken.delete({ where: { token: hashedToken } }),
    prisma.session.create({
      data: {
        sessionToken: hashToken(sessionToken),
        userId: user.id,
        expires,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: user.emailVerified ?? new Date() },
    }),
  ]);

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

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
