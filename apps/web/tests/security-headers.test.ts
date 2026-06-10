import assert from "node:assert/strict";
import test from "node:test";

import { securityHeaderReadiness, securityHeaders } from "../src/lib/security-headers";

test("securityHeaders include CSP for Live2D runtime sources", () => {
  const headers = securityHeaders({ NODE_ENV: "test" });
  const csp = headers.find((header) => header.key === "Content-Security-Policy")?.value ?? "";

  assert.match(csp, /script-src/);
  assert.match(csp, /'unsafe-inline'/);
  assert.doesNotMatch(csp, /'unsafe-eval'/);
  assert.match(csp, /https:\/\/cubism\.live2d\.com/);
  assert.match(csp, /https:\/\/cdnjs\.cloudflare\.com/);
  assert.match(csp, /https:\/\/cdn\.jsdelivr\.net/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /report-uri \/api\/csp-report/);
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
