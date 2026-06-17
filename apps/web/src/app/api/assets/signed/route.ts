import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/auth";
import { authorizeAssetAccess } from "@/lib/asset-access";
import { parseStorageKey, signedGetUrl } from "@/lib/storage";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  const parsedKey = parseStorageKey(key);
  const session = await getCurrentSession();
  const viewerSessionId = request.nextUrl.searchParams.get("viewerSessionId");

  try {
    await authorizeAssetAccess({ user: session?.user, viewerSessionId, key: parsedKey });
    return NextResponse.json({ url: await signedGetUrl(parsedKey) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 403 });
  }
}
