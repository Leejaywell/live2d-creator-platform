import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/authz";
import { validateLive2DZip } from "@/lib/live2d-validation";

export async function POST(request: NextRequest) {
  await requireSession();

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return NextResponse.json({ error: "Live2D model upload must be a zip file" }, { status: 400 });
  }

  try {
    const result = await validateLive2DZip(await file.arrayBuffer());
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Zip validation failed" }, { status: 400 });
  }
}
