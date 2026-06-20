import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireSession } from "@/lib/authz";
import { normalizeProjectSlug } from "@/lib/project-slugs";
import { createProject } from "@/lib/projects";
import { rateLimit } from "@/lib/rate-limit";
import { jsonError, parseBody } from "@/lib/request";

const optionalUrl = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().url().nullable().optional(),
);

const themeColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const schema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(80).transform(normalizeProjectSlug).pipe(z.string().min(1).max(80).regex(/^[a-z0-9-]+$/)),
  intro: z.string().max(2000).optional(),
  avatarUrl: optionalUrl,
  backgroundUrl: optionalUrl,
  systemPrompt: z.string().min(1).max(8000),
  characterSetting: z.string().max(8000).optional(),
  welcomeMessage: z.string().min(1).max(2000),
  theme: themeColor.optional(),
});

export async function POST(request: NextRequest) {
  try {
    const limited = await rateLimit(request, { key: "project-create", limit: 10, windowMs: 60_000 });
    if (limited) return limited;

    const session = await requireSession();
    if (session.user.role !== "creator") {
      return NextResponse.json({ error: "Only creators can create projects" }, { status: 403 });
    }
    const body = await parseBody(request, schema);
    const project = await createProject({ creatorId: session.user.id, ...body });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return jsonError(error, "Project creation failed");
  }
}
