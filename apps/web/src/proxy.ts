import { NextRequest, NextResponse } from "next/server";

import { contentSecurityPolicy, cspHeaderName } from "@/lib/security-headers";

// Per-request Content-Security-Policy with a fresh nonce. Next.js reads the nonce
// from the request's CSP header and stamps it onto its own scripts; combined with
// 'strict-dynamic' this removes the need for 'unsafe-inline' in script-src.
// (Using a nonce opts pages into dynamic rendering — acceptable for this app.)
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(process.env, nonce);
  const headerName = cspHeaderName(process.env);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // The request header must carry the *enforcing* CSP name so Next picks up the
  // nonce even when we emit report-only to the browser.
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(headerName, csp);
  return response;
}

export const config = {
  // Run on pages/routes but skip static assets, image optimizer, the vendored
  // Live2D runtime, favicon, and link-prefetches (which don't need the CSP).
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|vendor/|live2dcubismcore.min.js).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }, { type: "header", key: "purpose", value: "prefetch" }],
    },
  ],
};
