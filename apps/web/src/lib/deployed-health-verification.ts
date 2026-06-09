export type DeployedHealthVerification = {
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; detail?: string }>;
};

export function verifyDeployedHealthReport(report: Record<string, unknown>): DeployedHealthVerification {
  const service = report.service && typeof report.service === "object" ? (report.service as Record<string, unknown>) : {};
  const checks = [
    {
      name: "health_ok",
      ok: report.ok === true,
      detail: report.ok === true ? undefined : `Expected ok=true, got ${String(report.ok)}`,
    },
    {
      name: "service_name",
      ok: service.name === "live2d-creator-platform-web",
      detail: service.name === "live2d-creator-platform-web" ? undefined : `Unexpected service name: ${String(service.name)}`,
    },
    {
      name: "runtime_node_env",
      ok: service.nodeEnv === "production",
      detail: service.nodeEnv === "production" ? undefined : `Expected NODE_ENV=production, got ${String(service.nodeEnv)}`,
    },
    {
      name: "runtime_uptime",
      ok: typeof service.uptimeSeconds === "number" && Number.isFinite(service.uptimeSeconds) && service.uptimeSeconds >= 0,
      detail: "Health response must include numeric service.uptimeSeconds",
    },
  ];

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}
