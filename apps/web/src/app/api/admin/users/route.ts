import { NextRequest, NextResponse } from "next/server";
import { UserStatus } from "@prisma/client";
import { z } from "zod";

import { requirePermission } from "@/lib/authz";
import { upsertAdminUser } from "@/lib/admin";
import { jsonError, parseBody } from "@/lib/request";

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(8).optional().or(z.literal("").transform(() => undefined)),
  role: z.enum(["super_admin", "ops_admin", "support_admin"]),
  status: z.nativeEnum(UserStatus).default(UserStatus.active),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("admin.users.manage");
    const body = await parseBody(request, schema);
    const user = await upsertAdminUser({
      admin: { id: session.user.id, role: session.user.role },
      username: body.username,
      password: body.password,
      role: body.role,
      status: body.status,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Admin user save failed");
  }
}
