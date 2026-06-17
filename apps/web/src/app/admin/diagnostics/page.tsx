import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { Pill } from "@/components/ui";
import { fanCodeDisplayStatus } from "@/lib/fan-code-status";
import { hasPermission, isAdminRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { listRecentSafetyEvents } from "@/lib/safety-events";

import { AdminAuthRequired, AdminShell, dash } from "../_components";

export const dynamic = "force-dynamic";

export default async function AdminDiagnosticsPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || !isAdminRole(session.user.role)) {
    return <AdminAuthRequired />;
  }

  const role = session.user.role;
  const [fanAccessCodes, safetyEvents] = await Promise.all([
    prisma.fanAccessCode.findMany({
      include: { project: { include: { creator: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    listRecentSafetyEvents(30),
  ]);

  return (
    <AdminShell active="diagnostics" user={session.user}>
      <div className={dash.pageHead}>
        <div>
          <h1>诊断</h1>
          <p className={dash.pageHeadSub}>粉丝码状态、安全事件与支持工具</p>
        </div>
        {hasPermission(role, "support.notes") && (
          <details className={`${dash.disclosure}`}>
            <summary style={{ color: "var(--teal)", cursor: "pointer" }}>+ 添加支持备注</summary>
            <div className={dash.formCard} style={{ marginTop: 12, minWidth: 280 }}>
              <ApiForm action="/api/admin/support-notes" submitLabel="保存备注">
                <label>
                  目标类型
                  <select name="targetType" defaultValue="General">
                    <option value="General">General</option>
                    <option value="User">User</option>
                    <option value="Project">Project</option>
                    <option value="FanAccessCode">FanAccessCode</option>
                    <option value="ManualOrder">ManualOrder</option>
                  </select>
                </label>
                <label>
                  目标 ID
                  <input name="targetId" />
                </label>
                <label>
                  备注
                  <textarea name="note" required />
                </label>
              </ApiForm>
            </div>
          </details>
        )}
      </div>

      <div className={dash.twoCol}>
        <section className={dash.panel}>
          <div className={dash.panelHead}>
            <h2>粉丝码诊断</h2>
          </div>
          <div className={dash.table}>
            {fanAccessCodes.map((code) => (
              <div key={code.id} className={dash.tableRow} style={{ gridTemplateColumns: "1fr auto" }}>
                <div className={dash.cellMain}>
                  <strong>
                    {code.project.name} · {code.project.creator.username ?? "—"}
                  </strong>
                  <small>
                    {code.usedMessages}/{code.maxMessages} 条 · {code.bindMode}
                    {code.boundDeviceHash ? " · 已绑定" : " · 未绑定"} · {code.expiresAt.toISOString().slice(0, 10)} 到期
                  </small>
                  <small>批次 {code.batchId}</small>
                </div>
                <div className={dash.rowActions} style={{ flexDirection: "column", alignItems: "flex-end" }}>
                  <Pill tone="neutral">{fanCodeDisplayStatus(code)}</Pill>
                  {code.boundDeviceHash && hasPermission(role, "fan_codes.manage") && (
                    <details className={dash.disclosure}>
                      <summary>重置绑定</summary>
                      <div className={dash.formCard}>
                        <ApiForm action={`/api/admin/fan-codes/${code.id}/device-binding`} submitLabel="确认重置">
                          <span className={dash.pageHeadSub}>清除已绑定浏览器并使现有观众会话失效。</span>
                        </ApiForm>
                      </div>
                    </details>
                  )}
                </div>
              </div>
            ))}
            {fanAccessCodes.length === 0 && <div className={dash.empty}>还没有粉丝码。</div>}
          </div>
        </section>

        <section className={dash.panel}>
          <div className={dash.panelHead}>
            <h2>安全事件</h2>
          </div>
          <div className={dash.table}>
            {safetyEvents.map((event) => (
              <div key={event.id} className={dash.tableRow} style={{ gridTemplateColumns: "1fr auto" }}>
                <div className={dash.cellMain}>
                  <strong>{event.projectName}</strong>
                  <small>{event.messagePreview || "无消息预览"}</small>
                  <small>
                    {event.creatorUsername}
                    {event.projectSlug ? ` · /c/${event.projectSlug}` : ""} · {event.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                  </small>
                </div>
                <Pill tone={event.severity === "high" ? "danger" : "amber"}>
                  {event.severity} · {event.code}
                </Pill>
              </div>
            ))}
            {safetyEvents.length === 0 && <div className={dash.empty}>还没有被拦截的消息。</div>}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
