import styles from "@/app/dashboard.module.css";
import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { fanCodeDisplayStatus } from "@/lib/fan-code-status";
import { hasPermission, isAdminRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { listRecentSafetyEvents } from "@/lib/safety-events";

import { AdminAuthRequired, AdminChrome } from "../_components";

export const dynamic = "force-dynamic";

export default async function AdminDiagnosticsPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || !isAdminRole(session.user.role)) {
    return <AdminAuthRequired />;
  }

  const [fanAccessCodes, safetyEvents] = await Promise.all([
    prisma.fanAccessCode.findMany({
      include: { project: { include: { creator: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    listRecentSafetyEvents(30),
  ]);

  return (
    <AdminChrome active="diagnostics" user={session.user}>
      <section className={styles.sectionHeader}>
        <div>
          <p className={styles.kicker}>SUPPORT</p>
          <h2>诊断</h2>
        </div>
        <div className={styles.sectionActions}>
          <span className={styles.statusPill}>{fanAccessCodes.length} 个粉丝码</span>
          {hasPermission(session.user.role, "support.notes") ? (
            <details className={styles.inlineAction}>
              <summary>添加支持备注</summary>
              <div>
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
          ) : null}
        </div>
      </section>

      <section className={styles.twoColumn}>
        <section className={styles.panel}>
          <h2>粉丝码诊断</h2>
          <ul className={styles.list}>
            {fanAccessCodes.map((code) => (
              <li className={styles.row} key={code.id}>
                <strong>{fanCodeDisplayStatus(code)}</strong>
                <span>
                  {code.project.creator.username ?? code.project.creator.id} · {code.project.name} · /c/{code.project.slug}
                </span>
                <span>
                  {code.usedMessages}/{code.maxMessages} 条消息 · {code.bindMode}
                  {code.boundDeviceHash ? " · 已绑定设备" : " · 未绑定"} · {code.expiresAt.toISOString()} 到期
                </span>
                <span className={styles.muted}>
                  ID {code.id} · 批次 {code.batchId}
                </span>
                {code.boundDeviceHash && hasPermission(session.user.role, "fan_codes.manage") ? (
                  <details className={styles.collapse}>
                    <summary>重置设备绑定</summary>
                    <ApiForm action={`/api/admin/fan-codes/${code.id}/device-binding`} submitLabel="确认重置">
                      <span className={styles.muted}>清除已绑定的浏览器并使现有观众会话失效。</span>
                    </ApiForm>
                  </details>
                ) : null}
              </li>
            ))}
            {!fanAccessCodes.length ? <li className={styles.row}>还没有粉丝码。</li> : null}
          </ul>
        </section>

        <section className={styles.panel}>
          <h2>安全事件</h2>
          <ul className={styles.list}>
            {safetyEvents.map((event) => (
              <li className={styles.row} key={event.id}>
                <strong>{event.projectName}</strong>
                <span className={event.severity === "high" ? `${styles.statusPill} ${styles.statusBad}` : `${styles.statusPill} ${styles.statusWarn}`}>
                  {event.severity} · {event.code}
                </span>
                <span>
                  {event.creatorUsername}
                  {event.projectSlug ? ` · /c/${event.projectSlug}` : ""} · {event.createdAt.toISOString()}
                </span>
                <span>{event.messagePreview || "无消息预览。"}</span>
              </li>
            ))}
            {!safetyEvents.length ? <li className={styles.row}>还没有被拦截的消息。</li> : null}
          </ul>
        </section>
      </section>
    </AdminChrome>
  );
}
