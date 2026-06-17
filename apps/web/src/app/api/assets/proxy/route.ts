import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/auth";
import { authorizeAssetAccess } from "@/lib/asset-access";
import { jsonError } from "@/lib/request";
import { getObjectStream } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key") ?? "";
    const viewerSessionId = searchParams.get("viewerSessionId");
    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    const session = await getCurrentSession();
    const authorized = await authorizeAssetAccess({
      user: session?.user ?? null,
      viewerSessionId,
      key,
    });

    const { body, contentType, contentLength, cacheControl } = await getObjectStream(authorized.key);
    const headers = new Headers({
      "Content-Type": contentType,
      "Cache-Control": cacheControl ?? "private, max-age=300",
    });
    if (typeof contentLength === "number") {
      headers.set("Content-Length", String(contentLength));
    }
    return new Response(body, { headers });
  } catch (error) {
    return jsonError(error, "Asset unavailable");
  }
}
