import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/authz";
import { assertPasswordAllowed, hashPassword, verifyPassword } from "@/lib/password-auth";
import { prisma } from "@/lib/prisma";
import { jsonError, parseBody } from "@/lib/request";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "密码更新失败");
  }
}
