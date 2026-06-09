import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/authz";
import { createProject } from "@/lib/projects";
import { jsonError, parseBody } from "@/lib/request";

const optionalUrl = z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional());

const createProjectSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  intro: z.string().optional(),
  avatarUrl: optionalUrl,
  systemPrompt: z.string().min(1),
  welcomeMessage: z.string().min(1),
  theme: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can create projects" }, { status: 403 });
    }

    const body = await parseBody(request, createProjectSchema);
    const project = await createProject({
      creatorId: session.user.id,
      ...body,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Project creation failed");
  }
}
