import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { upsertAdminUser } from "@/lib/admin";
import { requirePermission } from "@/lib/authz";
import { jsonError, parseBody } from "@/lib/request";

const adminUserSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(["super_admin", "ops_admin", "support_admin"]),
  status: z.enum(["active", "suspended"]).default("active"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("admin.users.manage");
    const body = await parseBody(request, adminUserSchema);
    const user = await upsertAdminUser({
      admin: { id: session.user.id, role: session.user.role },
      email: body.email,
      role: body.role,
      status: body.status,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Admin user upsert failed");
  }
}
