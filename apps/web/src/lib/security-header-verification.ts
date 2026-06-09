export type SecurityHeaderVerification = {
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; detail?: string }>;
};

export function verifySecurityHeaders(headers: Headers, options: { requireHsts?: boolean } = {}): SecurityHeaderVerification {
  const csp = headers.get("content-security-policy");
  const cspReportOnly = headers.get("content-security-policy-report-only");
  const hsts = headers.get("strict-transport-security");

  const checks = [
    equalsHeader(headers, "x-content-type-options", "nosniff"),
    equalsHeader(headers, "x-frame-options", "DENY"),
    equalsHeader(headers, "referrer-policy", "strict-origin-when-cross-origin"),
    containsHeader(headers, "permissions-policy", "camera=()"),
    {
      name: "csp_enforced",
      ok: Boolean(csp) && !cspReportOnly,
      detail: csp ? undefined : "Content-Security-Policy header is missing",
    },
    {
      name: "csp_frame_ancestors",
      ok: Boolean(csp?.includes("frame-ancestors 'none'")),
      detail: "CSP must deny framing",
    },
    {
      name: "csp_report_uri",
      ok: Boolean(csp?.includes("report-uri ")),
      detail: "CSP must define a report-uri",
    },
  ];

  if (options.requireHsts) {
    checks.push({
      name: "hsts",
      ok: Boolean(hsts?.includes("max-age=") && hsts.includes("includeSubDomains")),
      detail: "Strict-Transport-Security must include max-age and includeSubDomains",
    });
  }

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}

function equalsHeader(headers: Headers, name: string, expected: string) {
  const actual = headers.get(name);
  return {
    name: name.replaceAll("-", "_"),
    ok: actual === expected,
    detail: actual === expected ? undefined : `Expected ${expected}, got ${actual ?? "missing"}`,
  };
}

function containsHeader(headers: Headers, name: string, expected: string) {
  const actual = headers.get(name);
  return {
    name: name.replaceAll("-", "_"),
    ok: Boolean(actual?.includes(expected)),
    detail: actual?.includes(expected) ? undefined : `Expected ${name} to include ${expected}`,
  };
}
