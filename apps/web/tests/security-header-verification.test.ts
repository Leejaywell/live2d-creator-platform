import assert from "node:assert/strict";
import test from "node:test";

import { verifySecurityHeaders } from "../src/lib/security-header-verification";

test("verifySecurityHeaders accepts enforced production security headers", () => {
  const headers = new Headers({
    "content-security-policy": "default-src 'self'; frame-ancestors 'none'; report-uri /api/csp-report",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "referrer-policy": "strict-origin-when-cross-origin",
    "strict-transport-security": "max-age=31536000; includeSubDomains; preload",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  });

  const report = verifySecurityHeaders(headers, { requireHsts: true });

  assert.equal(report.ok, true);
});

test("verifySecurityHeaders rejects report-only CSP in production verification", () => {
  const headers = new Headers({
    "content-security-policy-report-only": "default-src 'self'; frame-ancestors 'none'; report-uri /api/csp-report",
    "permissions-policy": "camera=()",
    "referrer-policy": "strict-origin-when-cross-origin",
    "strict-transport-security": "max-age=31536000; includeSubDomains; preload",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  });

  const report = verifySecurityHeaders(headers, { requireHsts: true });

  assert.equal(report.ok, false);
  assert.equal(report.checks.some((check) => check.name === "csp_enforced" && !check.ok), true);
});

test("verifySecurityHeaders requires HSTS when requested", () => {
  const headers = new Headers({
    "content-security-policy": "default-src 'self'; frame-ancestors 'none'; report-uri /api/csp-report",
    "permissions-policy": "camera=()",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  });

  const report = verifySecurityHeaders(headers, { requireHsts: true });

  assert.equal(report.ok, false);
  assert.equal(report.checks.some((check) => check.name === "hsts" && !check.ok), true);
});
