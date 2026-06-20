export type HeaderEntry = {
  key: string;
  value: string;
};

/** Static, request-independent security headers (no CSP — the CSP is emitted
 *  per-request by src/proxy.ts so it can carry a fresh nonce). */
export function staticSecurityHeaders(env: NodeJS.ProcessEnv = process.env): HeaderEntry[] {
  const headers: HeaderEntry[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "X-Frame-Options", value: "DENY" },
  ];

  if (env.NODE_ENV === "production" || env.ENABLE_HSTS === "true") {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains; preload",
    });
  }

  return headers;
}

export function cspHeaderName(env: NodeJS.ProcessEnv = process.env) {
  return env.CSP_REPORT_ONLY === "true" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
}

/** Full header set including CSP. Used by tests/readiness; pass a nonce to get
 *  the nonce-based script-src (no 'unsafe-inline'). */
export function securityHeaders(env: NodeJS.ProcessEnv = process.env, nonce?: string): HeaderEntry[] {
  return [
    ...staticSecurityHeaders(env),
    { key: cspHeaderName(env), value: contentSecurityPolicy(env, nonce) },
  ];
}

export function securityHeaderReadiness(env: NodeJS.ProcessEnv = process.env) {
  const mode = env.CSP_REPORT_ONLY === "true" ? "report-only" : "enforce";
  if (env.NODE_ENV === "production" && mode !== "enforce") {
    throw new Error("CSP_REPORT_ONLY must be false or unset in production");
  }
  if (env.NODE_ENV === "production" && env.ENABLE_HSTS === "false") {
    throw new Error("HSTS must not be disabled in production");
  }
  if (env.NODE_ENV === "production" && env.CSP_REPORT_URI && !isAllowedReportUri(env.CSP_REPORT_URI)) {
    throw new Error("CSP_REPORT_URI must be a same-origin path or HTTPS URL in production");
  }
  const invalidConnectSrc = invalidProductionCspSources(splitSources(env.CSP_CONNECT_SRC), ["https://", "wss://"]);
  if (env.NODE_ENV === "production" && invalidConnectSrc.length > 0) {
    throw new Error(`CSP_CONNECT_SRC includes unsafe production sources: ${invalidConnectSrc.join(", ")}`);
  }
  const invalidScriptSrc = invalidProductionCspSources(splitSources(env.CSP_SCRIPT_SRC), ["https://"]);
  if (env.NODE_ENV === "production" && invalidScriptSrc.length > 0) {
    throw new Error(`CSP_SCRIPT_SRC includes unsafe production sources: ${invalidScriptSrc.join(", ")}`);
  }
}

export function contentSecurityPolicy(env: NodeJS.ProcessEnv, nonce?: string) {
  const extraConnectSrc = splitSources(env.CSP_CONNECT_SRC);
  const extraScriptSrc = splitSources(env.CSP_SCRIPT_SRC);
  const developmentScriptSrc = env.NODE_ENV === "development" ? ["'unsafe-eval'"] : [];
  // With a per-request nonce, script-src uses 'nonce-…' + 'strict-dynamic' instead
  // of 'unsafe-inline', so injected inline scripts can't execute. The self-hosted
  // PixiJS / Cubism Core / pixi-live2d-display files are appended by trusted
  // (nonced) bundle code at runtime, which 'strict-dynamic' propagates trust to.
  // Without a nonce (legacy/static callers) we fall back to 'unsafe-inline'.
  // NOTE: style-src keeps 'unsafe-inline' because the app uses inline `style=`
  // attributes (e.g. dynamic stage backgrounds) that a nonce cannot cover.
  const scriptSrc = nonce
    ? ["script-src", "'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...developmentScriptSrc, ...extraScriptSrc]
    : ["script-src", "'self'", "'unsafe-inline'", ...developmentScriptSrc, ...extraScriptSrc];
  const directives = [
    ["default-src", "'self'"],
    ["base-uri", "'self'"],
    ["object-src", "'none'"],
    ["frame-ancestors", "'none'"],
    ["form-action", "'self'"],
    /* All runtime (PixiJS / Live2D Cubism Core / pixi-live2d-display) and model
       assets are self-hosted under /public — no third-party CDN is allowed. */
    scriptSrc,
    ["style-src", "'self'", "'unsafe-inline'"],
    /* https: 允许创作者配置外链头像与舞台背景图;仅图片资源,不放宽脚本与连接 */
    ["img-src", "'self'", "data:", "blob:", "https:"],
    ["font-src", "'self'", "data:"],
    ["media-src", "'self'", "blob:", "data:"],
    ["connect-src", "'self'", ...extraConnectSrc],
    ["worker-src", "'self'", "blob:"],
    ["manifest-src", "'self'"],
    ["report-uri", env.CSP_REPORT_URI || "/api/csp-report"],
    ["upgrade-insecure-requests"],
  ];

  return directives.map((directive) => directive.join(" ")).join("; ");
}

function isAllowedReportUri(value: string) {
  return value.startsWith("/") || value.startsWith("https://");
}

function invalidProductionCspSources(sources: string[], allowedPrefixes: string[]) {
  return sources.filter((source) => {
    if (source.includes("localhost") || source.includes("your-domain.example")) {
      return true;
    }
    if (source === "*" || source === "'unsafe-inline'" || source === "'unsafe-eval'" || source === "data:" || source === "blob:") {
      return true;
    }
    if (source.startsWith("https://*.") || source.startsWith("wss://*.")) {
      return !allowedPrefixes.some((prefix) => source.startsWith(prefix));
    }
    return !allowedPrefixes.some((prefix) => source.startsWith(prefix)) || source.includes("://*");
  });
}

function splitSources(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
