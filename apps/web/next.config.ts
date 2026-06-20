import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { staticSecurityHeaders } from "./src/lib/security-headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  // PGlite (local in-process Postgres) ships WASM and must not be bundled by the
  // server compiler — load it as a normal Node module instead.
  serverExternalPackages: ["@electric-sql/pglite", "pglite-prisma-adapter"],
  async headers() {
    // CSP is emitted per-request (with a fresh nonce) by src/proxy.ts; the rest of
    // the security headers are request-independent and set statically here.
    return [
      {
        source: "/:path*",
        headers: staticSecurityHeaders(),
      },
    ];
  },
};

export default withNextIntl(nextConfig);
