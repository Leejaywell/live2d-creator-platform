import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/auth";
import { authorizeAssetAccess } from "@/lib/asset-access";
import { getObjectStream, parseStorageKey, signedGetUrl } from "@/lib/storage";

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
    return assetProxyResponse(parsedKey);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 403 });
  }
}

async function assetProxyResponse(key: string) {
  if (process.env.ASSET_PROXY_MODE !== "stream") {
    return NextResponse.redirect(await signedGetUrl(key));
  }

  const object = await getObjectStream(key);
  const headers = new Headers({
    "Content-Type": object.contentType,
    "Cache-Control": object.cacheControl ?? "private, max-age=300",
  });
  if (object.contentLength !== undefined) {
    headers.set("Content-Length", String(object.contentLength));
  }

  return new NextResponse(object.body, { headers });
}
