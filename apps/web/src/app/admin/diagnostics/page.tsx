import { getTranslations } from "next-intl/server";

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

  const t = await getTranslations("admin");
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
          <h1>{t("diagnosticsTitle")}</h1>
          <p className={dash.pageHeadSub}>{t("diagnosticsSubtitle")}</p>
        </div>
        {hasPermission(role, "support.notes") && (
          <details className={`${dash.disclosure}`}>
            <summary style={{ color: "var(--teal)", cursor: "pointer" }}>{t("addSupportNoteSummary")}</summary>
            <div className={dash.formCard} style={{ marginTop: 12, minWidth: 280 }}>
              <ApiForm action="/api/admin/support-notes" submitLabel={t("saveNote")}>
                <label>
                  {t("targetType")}
                  <select name="targetType" defaultValue="General">
                    <option value="General">General</option>
                    <option value="User">User</option>
                    <option value="Project">Project</option>
                    <option value="FanAccessCode">FanAccessCode</option>
                    <option value="ManualOrder">ManualOrder</option>
                  </select>
                </label>
                <label>
                  {t("targetId")}
                  <input name="targetId" />
                </label>
                <label>
                  {t("note")}
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
            <h2>{t("fanCodePanel")}</h2>
          </div>
          <div className={dash.table}>
            {fanAccessCodes.map((code) => (
              <div key={code.id} className={dash.tableRow} style={{ gridTemplateColumns: "1fr auto" }}>
                <div className={dash.cellMain}>
                  <strong>
                    {code.project.name} · {code.project.creator.username ?? "—"}
                  </strong>
                  <small>
                    {code.usedMessages}/{code.maxMessages} {t("fanCodeMessagesUnit")} · {code.bindMode}
                    {code.boundDeviceHash ? t("fanCodeBoundSuffix") : t("fanCodeUnboundSuffix")} ·{" "}
                    {t("expiresOn", { date: code.expiresAt.toISOString().slice(0, 10) })}
                  </small>
                  <small>{t("batchLabel", { id: code.batchId })}</small>
                </div>
                <div className={dash.rowActions} style={{ flexDirection: "column", alignItems: "flex-end" }}>
                  <Pill tone="neutral">{fanCodeDisplayStatus(code)}</Pill>
                  {code.boundDeviceHash && hasPermission(role, "fan_codes.manage") && (
                    <details>
                      <summary>{t("resetBinding")}</summary>
                      <div className={dash.formCard}>
                        <ApiForm action={`/api/admin/fan-codes/${code.id}/device-binding`} submitLabel={t("confirmReset")}>
                          <span className={dash.pageHeadSub}>{t("resetBindingHint")}</span>
                        </ApiForm>
                      </div>
                    </details>
                  )}
                </div>
              </div>
            ))}
            {fanAccessCodes.length === 0 && <div className={dash.empty}>{t("emptyFanCodes")}</div>}
          </div>
        </section>

        <section className={dash.panel}>
          <div className={dash.panelHead}>
            <h2>{t("safetyEventsPanel")}</h2>
          </div>
          <div className={dash.table}>
            {safetyEvents.map((event) => (
              <div key={event.id} className={dash.tableRow} style={{ gridTemplateColumns: "1fr auto" }}>
                <div className={dash.cellMain}>
                  <strong>{event.projectName}</strong>
                  <small>{event.messagePreview || t("noMessagePreview")}</small>
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
            {safetyEvents.length === 0 && <div className={dash.empty}>{t("emptyBlockedMessages")}</div>}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
