import { getTranslations } from "next-intl/server";

import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { hasPermission, isAdminRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import { AdminAuthRequired, AdminShell, StatusPill, creatorPlanDetails, dash } from "../_components";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || !isAdminRole(session.user.role)) {
    return <AdminAuthRequired />;
  }

  const t = await getTranslations("admin");
  const role = session.user.role;
  const [adminUsers, creators] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["super_admin", "ops_admin", "support_admin"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.user.findMany({
      where: { role: "creator" },
      include: { creatorProfile: true, creatorPlan: true, _count: { select: { projects: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <AdminShell active="users" user={session.user}>
      <div className={dash.pageHead}>
        <div>
          <h1>{t("usersTitle")}</h1>
          <p className={dash.pageHeadSub}>
            {t("usersSubtitle", { adminCount: adminUsers.length, creatorCount: creators.length })}
          </p>
        </div>
      </div>

      <div className={dash.twoCol}>
        {hasPermission(role, "admin.users.manage") && (
          <details className={`${dash.panel} ${dash.disclosure}`}>
            <summary>{t("adminFormSummary")}</summary>
            <div className={dash.formCard}>
              <ApiForm action="/api/admin/users" submitLabel={t("saveAdmin")}>
                <label>
                  {t("username")}
                  <input name="username" required />
                </label>
                <label>
                  {t("passwordOptional")}
                  <input name="password" type="password" minLength={8} />
                </label>
                <label>
                  {t("roleLabel")}
                  <select name="role" defaultValue="ops_admin">
                    <option value="super_admin">{t("roleSuperAdmin")}</option>
                    <option value="ops_admin">{t("roleOpsAdmin")}</option>
                    <option value="support_admin">{t("roleSupportAdmin")}</option>
                  </select>
                </label>
                <label>
                  {t("colStatus")}
                  <select name="status" defaultValue="active">
                    <option value="active">{t("statusActive")}</option>
                    <option value="suspended">{t("statusSuspended")}</option>
                  </select>
                </label>
              </ApiForm>
            </div>
          </details>
        )}
        {hasPermission(role, "creators.manage") && (
          <details className={`${dash.panel} ${dash.disclosure}`}>
            <summary>{t("creatorFormSummary")}</summary>
            <div className={dash.formCard}>
              <ApiForm action="/api/admin/creators" submitLabel={t("createCreator")}>
                <label>
                  {t("username")}
                  <input name="username" required />
                </label>
                <label>
                  {t("passwordRequired")}
                  <input name="password" type="password" minLength={8} required />
                </label>
                <label>
                  {t("displayName")}
                  <input name="displayName" required />
                </label>
                <label>
                  {t("planName")}
                  <input name="planName" placeholder="Trial" />
                </label>
                <label>
                  {t("expiresAt")}
                  <input name="expiresAt" type="datetime-local" />
                </label>
                <label>
                  {t("maxProjects")}
                  <input name="maxProjects" type="number" min="1" defaultValue="1" />
                </label>
                <label>
                  {t("aiMessageLimit")}
                  <input name="monthlyAiMessageLimit" type="number" min="1" defaultValue="1000" />
                </label>
                <label>
                  {t("fanCodeQuota")}
                  <input name="fanCodeQuota" type="number" min="1" defaultValue="20" />
                </label>
              </ApiForm>
            </div>
          </details>
        )}
      </div>

      <section className={dash.panel}>
        <div className={dash.panelHead}>
          <h2>{t("adminAccountsPanel")}</h2>
        </div>
        <div className={dash.tableWrap}>
          <div className={`${dash.tableRow} ${dash.tableHead}`} style={{ gridTemplateColumns: "1.6fr 1fr 1fr auto" }}>
            <span>{t("colAccount")}</span>
            <span>{t("colStatus")}</span>
            <span>{t("roleLabel")}</span>
            <span />
          </div>
          {adminUsers.map((adminUser) => (
            <div key={adminUser.id} className={dash.tableRow} style={{ gridTemplateColumns: "1.6fr 1fr 1fr auto" }}>
              <div className={dash.cellMain}>
                <strong>{adminUser.username ?? adminUser.id}</strong>
                <small>{adminUser.id}</small>
              </div>
              <StatusPill status={adminUser.status} />
              <span className={dash.mono}>{adminUser.role}</span>
              <div className={dash.rowActions}>
                {hasPermission(role, "admin.users.manage") && adminUser.id !== session.user.id ? (
                  <details>
                    <summary>{t("delete")}</summary>
                    <div className={dash.formCard}>
                      <ApiForm action={`/api/admin/users/${adminUser.id}`} method="DELETE" submitLabel={t("confirmDelete")} submitVariant="danger">
                        <span className={dash.pageHeadSub}>{t("adminDeleteHint")}</span>
                      </ApiForm>
                    </div>
                  </details>
                ) : (
                  <span className={dash.pageHeadSub}>—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={dash.panel}>
        <div className={dash.panelHead}>
          <h2>{t("creatorAccountsPanel")}</h2>
        </div>
        <div className={dash.tableWrap}>
          <div className={`${dash.tableRow} ${dash.tableHead}`} style={{ gridTemplateColumns: "1.4fr 0.8fr 1fr 1.6fr auto" }}>
            <span>{t("colCreator")}</span>
            <span>{t("colStatus")}</span>
            <span>{t("colLoginName")}</span>
            <span>{t("colPlanQuota")}</span>
            <span />
          </div>
          {creators.map((creator) => (
            <div key={creator.id} className={dash.tableRow} style={{ gridTemplateColumns: "1.4fr 0.8fr 1fr 1.6fr auto" }}>
              <div className={dash.cellMain}>
                <strong>{creator.creatorProfile?.displayName ?? creator.username ?? creator.id}</strong>
                <small>{creator.id}</small>
              </div>
              <StatusPill status={creator.status} />
              <span className={dash.mono}>{creator.username ?? t("notSet")}</span>
              <div className={dash.cellMain}>
                {creatorPlanDetails(t, creator.creatorPlan, creator._count.projects).map((detail) => (
                  <small key={detail}>{detail}</small>
                ))}
              </div>
              <div className={dash.rowActions}>
                {hasPermission(role, "creators.manage") ? (
                  <>
                    <details>
                      <summary>{t("colStatus")}</summary>
                      <div className={dash.formCard}>
                        <ApiForm action={`/api/admin/creators/${creator.id}/status`} submitLabel={t("updateStatus")}>
                          <label>
                            {t("colStatus")}
                            <select name="status" defaultValue={creator.status}>
                              <option value="active">{t("statusActive")}</option>
                              <option value="suspended">{t("statusSuspended")}</option>
                            </select>
                          </label>
                        </ApiForm>
                      </div>
                    </details>
                    <details>
                      <summary>{t("delete")}</summary>
                      <div className={dash.formCard}>
                        <ApiForm action={`/api/admin/creators/${creator.id}`} method="DELETE" submitLabel={t("confirmDeleteCreator")} submitVariant="danger">
                          <span className={dash.pageHeadSub}>{t("creatorDeleteHint")}</span>
                        </ApiForm>
                      </div>
                    </details>
                  </>
                ) : (
                  <span className={dash.pageHeadSub}>—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
