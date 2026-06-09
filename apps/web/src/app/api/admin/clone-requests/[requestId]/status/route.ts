import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { updateVoiceCloneRequestStatus } from "@/lib/admin";
import { requirePermission } from "@/lib/authz";
import { jsonError, parseBody } from "@/lib/request";

const statusSchema = z.object({
  status: z.enum(["submitted", "reviewing", "approved", "rejected", "fulfilled"]),
});

export async function POST(request: NextRequest, context: RouteContext<"/api/admin/clone-requests/[requestId]/status">) {
  try {
    const session = await requirePermission("clone_requests.review");
    const { requestId } = await context.params;
    const body = await parseBody(request, statusSchema);
    const cloneRequest = await updateVoiceCloneRequestStatus({
      admin: { id: session.user.id, role: session.user.role },
      requestId,
      status: body.status,
    });
    return NextResponse.json({ cloneRequest });
  } catch (error) {
    return jsonError(error, "Voice clone request update failed");
  }
}
