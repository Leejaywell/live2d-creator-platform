import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/authz";
import { hashPassword, verifyPassword } from "@/lib/password-auth";
import { prisma } from "@/lib/prisma";
import { jsonError, parseBody } from "@/lib/request";

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await parseBody(request, passwordSchema);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });

    if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash: await hashPassword(body.newPassword) },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "Password update failed");
  }
}
