import crypto from "node:crypto";

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authCookieName } from "@/auth";
import { requireSession } from "@/lib/authz";
import { assertPasswordAllowed, hashPassword, verifyPassword } from "@/lib/password-auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { jsonError, parseBody } from "@/lib/request";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { key: "account-password", limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const session = await requireSession();
    const body = await parseBody(request, schema);
    assertPasswordAllowed(body.newPassword);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
    if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: "当前密码不正确" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(body.newPassword) },
    });

    // Invalidate every OTHER session for this user so any previously stolen or
    // shared session is forced to re-authenticate after a password change.
    // The caller's current session (identified by the hashed session cookie,
    // matching the hashing used in src/auth.ts) is preserved so they stay
    // signed in. If the cookie is missing we drop all sessions and let them
    // re-login.
    const currentToken = (await cookies()).get(authCookieName())?.value;
    const currentSessionToken = currentToken
      ? crypto.createHash("sha256").update(currentToken).digest("hex")
      : undefined;
    await prisma.session.deleteMany({
      where: {
        userId: user.id,
        ...(currentSessionToken ? { NOT: { sessionToken: currentSessionToken } } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "密码更新失败");
  }
}
