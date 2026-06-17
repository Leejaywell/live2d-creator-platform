import { NextResponse } from "next/server";

import { requireSession } from "@/lib/authz";
import { resetFanAccessCodeDeviceBinding, revokeFanAccessCode } from "@/lib/fan-code-service";
import { jsonError } from "@/lib/request";

export async function POST(_request: Request, context: RouteContext<"/api/creator/fan-codes/[codeId]">) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can reset fan code devices" }, { status: 403 });
    }

    const { codeId } = await context.params;
    const code = await resetFanAccessCodeDeviceBinding({
      codeId,
      actor: { id: session.user.id, role: session.user.role },
      creatorId: session.user.id,
    });

    return NextResponse.json({ code });
  } catch (error) {
    return jsonError(error, "Fan code device reset failed");
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/creator/fan-codes/[codeId]">) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can revoke fan codes" }, { status: 403 });
    }

    const { codeId } = await context.params;
    const code = await revokeFanAccessCode({
      codeId,
      creatorId: session.user.id,
    });

    return NextResponse.json({ code });
  } catch (error) {
    return jsonError(error, "Fan code revoke failed");
  }
}
