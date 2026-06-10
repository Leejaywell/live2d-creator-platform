import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { updateUserWechatBinding } from "@/lib/admin";
import { requireSession } from "@/lib/authz";
import { jsonError, parseBody } from "@/lib/request";

const wechatBindingSchema = z.object({
  openId: z.string().optional(),
});

export async function POST(request: NextRequest, context: RouteContext<"/api/admin/users/[userId]/wechat">) {
  try {
    const session = await requireSession();
    const { userId } = await context.params;
    const body = await parseBody(request, wechatBindingSchema);
    const user = await updateUserWechatBinding({
      admin: { id: session.user.id, role: session.user.role },
      userId,
      openId: body.openId,
    });
    return NextResponse.json({ user });
  } catch (error) {
    return jsonError(error, "WeChat binding update failed");
  }
}
