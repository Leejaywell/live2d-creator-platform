import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/authz";
import { upsertPlatformSetting } from "@/lib/platform-settings";
import { jsonError, parseBody } from "@/lib/request";

const schema = z.object({
  provider: z.enum(["openai-compatible", "disabled"]),
  baseUrl: z.string().trim().url().max(200),
  chatModel: z.string().trim().min(1).max(200),
  // Optional: when omitted/blank the existing stored key is kept unchanged.
  apiKey: z.string().trim().max(400).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("provider_secrets.manage");
    const body = await parseBody(request, schema);
    const admin = { id: session.user.id, role: session.user.role };

    await upsertPlatformSetting({ admin, key: "ai.provider", value: body.provider });
    await upsertPlatformSetting({ admin, key: "ai.baseUrl", value: body.baseUrl });
    await upsertPlatformSetting({ admin, key: "ai.chatModel", value: body.chatModel });
    // Only overwrite the secret when a new value is actually supplied.
    if (body.apiKey) {
      await upsertPlatformSetting({ admin, key: "ai.apiKey", value: body.apiKey });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "AI provider save failed");
  }
}
