import assert from "node:assert/strict";
import test from "node:test";

import {
  contentSecurityPolicy,
  securityHeaderReadiness,
  securityHeaders,
  staticSecurityHeaders,
} from "../src/lib/security-headers";

function scriptSrcOf(csp: string) {
  return csp.split(";").map((directive) => directive.trim()).find((directive) => directive.startsWith("script-src ")) ?? "";
}

test("CSP self-hosted with no third-party CDN sources", () => {
  const csp = contentSecurityPolicy({ NODE_ENV: "test" });

  assert.match(csp, /script-src/);
  assert.doesNotMatch(csp, /'unsafe-eval'/);
  // Live2D runtime + models are vendored under /public — no CDN allowances.
  assert.doesNotMatch(csp, /https:\/\/cubism\.live2d\.com/);
  assert.doesNotMatch(csp, /https:\/\/cdnjs\.cloudflare\.com/);
  assert.doesNotMatch(csp, /https:\/\/cdn\.jsdelivr\.net/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /report-uri \/api\/csp-report/);
});

test("script-src uses a nonce + strict-dynamic (no 'unsafe-inline') when a nonce is supplied", () => {
  const scriptSrc = scriptSrcOf(contentSecurityPolicy({ NODE_ENV: "production" }, "test-nonce"));

  assert.match(scriptSrc, /'nonce-test-nonce'/);
  assert.match(scriptSrc, /'strict-dynamic'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-inline'/);
});

test("static security headers carry no CSP (the proxy emits the per-request CSP)", () => {
  const headers = staticSecurityHeaders({ NODE_ENV: "production" });
  assert.ok(!headers.some((header) => header.key.startsWith("Content-Security-Policy")));
  // The non-CSP hardening headers are still present.
  assert.ok(headers.some((header) => header.key === "X-Frame-Options" && header.value === "DENY"));
  assert.ok(headers.some((header) => header.key === "Strict-Transport-Security"));
});

test("securityHeaders allow React development eval only in development", () => {
  const developmentCsp = securityHeaders({ NODE_ENV: "development" }).find((header) => header.key === "Content-Security-Policy")?.value ?? "";
  const productionCsp = securityHeaders({ NODE_ENV: "production" }).find((header) => header.key === "Content-Security-Policy")?.value ?? "";

  assert.match(developmentCsp, /'unsafe-eval'/);
  assert.doesNotMatch(productionCsp, /'unsafe-eval'/);
});

test("securityHeaders can emit report-only CSP outside production", () => {
  const headers = securityHeaders({ NODE_ENV: "development", CSP_REPORT_ONLY: "true" });

  assert.equal(headers.some((header) => header.key === "Content-Security-Policy-Report-Only"), true);
  assert.equal(headers.some((header) => header.key === "Content-Security-Policy"), false);
});

test("securityHeaderReadiness rejects report-only CSP in production", () => {
  assert.throws(() => securityHeaderReadiness({ NODE_ENV: "production", CSP_REPORT_ONLY: "true" }), /CSP_REPORT_ONLY/);
});

test("securityHeaders include HSTS in production", () => {
  const headers = securityHeaders({ NODE_ENV: "production" });

  assert.equal(headers.some((header) => header.key === "Strict-Transport-Security"), true);
});

test("securityHeaderReadiness rejects insecure external CSP report URI in production", () => {
  assert.throws(
    () => securityHeaderReadiness({ NODE_ENV: "production", CSP_REPORT_URI: "http://example.test/csp" }),
    /CSP_REPORT_URI/,
  );
});

test("securityHeaderReadiness rejects unsafe extra CSP sources in production", () => {
  assert.throws(
    () => securityHeaderReadiness({ NODE_ENV: "production", CSP_SCRIPT_SRC: "https://cdn.example.com,'unsafe-eval'" }),
    /CSP_SCRIPT_SRC/,
  );
  assert.throws(
    () => securityHeaderReadiness({ NODE_ENV: "production", CSP_CONNECT_SRC: "https://api.example.com,http://localhost:4000" }),
    /CSP_CONNECT_SRC/,
  );
});

test("securityHeaderReadiness accepts HTTPS and WSS extra CSP sources in production", () => {
  assert.doesNotThrow(() =>
    securityHeaderReadiness({
      NODE_ENV: "production",
      CSP_SCRIPT_SRC: "https://cdn.example.com,https://*.trusted-cdn.com",
      CSP_CONNECT_SRC: "https://api.example.com,wss://events.example.com",
    }),
  );
});
