import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupportNote } from "@/lib/admin";
import { requirePermission } from "@/lib/authz";
import { jsonError, parseBody } from "@/lib/request";

const supportNoteSchema = z.object({
  targetType: z.enum(["General", "User", "Project", "FanAccessCode", "ManualOrder", "VoiceCloneRequest"]),
  targetId: z.string().optional(),
  note: z.string().trim().min(1).max(4000),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("support.notes");
    const body = await parseBody(request, supportNoteSchema);
    const supportNote = await createSupportNote({
      admin: { id: session.user.id, role: session.user.role },
      ...body,
    });
    return NextResponse.json({ supportNote }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Support note creation failed");
  }
}
