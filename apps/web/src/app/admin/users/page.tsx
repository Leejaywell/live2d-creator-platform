import styles from "@/app/dashboard.module.css";
import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { hasPermission, isAdminRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import { AdminAuthRequired, AdminChrome, creatorPlanDetails } from "../_components";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || !isAdminRole(session.user.role)) {
    return <AdminAuthRequired />;
  }

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
    <AdminChrome active="users" user={session.user}>
      <section className={styles.sectionHeader}>
        <div>
          <p className={styles.kicker}>ACCOUNTS</p>
          <h2>账号管理</h2>
        </div>
        <div className={styles.sectionActions}>
          <span className={styles.statusPill}>{creators.length} 个创作者</span>
          {hasPermission(session.user.role, "admin.users.manage") ? (
            <details className={styles.inlineAction}>
              <summary>新建 / 更新管理员</summary>
              <div>
                <ApiForm action="/api/admin/users" submitLabel="保存管理员">
                  <label>
                    用户名
                    <input name="username" required />
                  </label>
                  <label>
                    初始密码
                    <input name="password" type="password" minLength={8} placeholder="更新已有账号时可留空" />
                  </label>
                  <label>
                    角色
                    <select name="role" defaultValue="ops_admin">
                      <option value="super_admin">超级管理员(super_admin)</option>
                      <option value="ops_admin">运营管理员(ops_admin)</option>
                      <option value="support_admin">客服管理员(support_admin)</option>
                    </select>
                  </label>
                  <label>
                    状态
                    <select name="status" defaultValue="active">
                      <option value="active">正常(active)</option>
                      <option value="suspended">停用(suspended)</option>
                    </select>
                  </label>
                </ApiForm>
              </div>
            </details>
          ) : null}
          {hasPermission(session.user.role, "creators.manage") ? (
            <details className={styles.inlineAction}>
              <summary>创建创作者</summary>
              <div>
                <ApiForm action="/api/admin/creators" submitLabel="创建创作者">
                  <label>
                    用户名
                    <input name="username" required />
                  </label>
                  <label>
                    初始密码
                    <input name="password" type="password" minLength={8} required />
                  </label>
                  <label>
                    显示名称
                    <input name="displayName" required />
                  </label>
                  <label>
                    套餐名称
                    <input name="planName" />
                  </label>
                  <label>
                    到期时间
                    <input name="expiresAt" type="datetime-local" />
                  </label>
                  <label>
                    项目数上限
                    <input name="maxProjects" type="number" min="1" defaultValue="1" />
                  </label>
                  <label>
                    AI 消息上限
                    <input name="monthlyAiMessageLimit" type="number" min="1" defaultValue="1000" />
                  </label>
                  <label>
                    粉丝码配额
                    <input name="fanCodeQuota" type="number" min="1" defaultValue="20" />
                  </label>
                </ApiForm>
              </div>
            </details>
          ) : null}
        </div>
      </section>

      <section className={styles.primaryPane}>
        <section className={styles.panel}>
          <h2>管理员账号</h2>
          <div className={`${styles.dataTable} ${styles.cols4}`}>
            <div className={styles.dataHeader}>
              <span>账号</span>
              <span>状态</span>
              <span>角色</span>
              <span>操作</span>
            </div>
            {adminUsers.map((adminUser) => (
              <div className={styles.dataRow} key={adminUser.id}>
                <div className={styles.dataCell}>
                  <strong>{adminUser.username ?? adminUser.id}</strong>
                  <small>{adminUser.id}</small>
                </div>
                <div className={styles.dataCell}>
                  <span className={adminUser.status === "active" ? `${styles.statusPill} ${styles.statusGood}` : `${styles.statusPill} ${styles.statusBad}`}>{adminUser.status}</span>
                </div>
                <div className={styles.dataCell}>{adminUser.role}</div>
                <div className={`${styles.dataCell} ${styles.rowActions}`}>
                  {hasPermission(session.user.role, "admin.users.manage") && adminUser.id !== session.user.id ? (
                    <details className={`${styles.collapse} ${styles.compactDetails}`}>
                      <summary>删除</summary>
                      <ApiForm action={`/api/admin/users/${adminUser.id}`} method="DELETE" submitLabel="确认删除管理员">
                        <span className={styles.muted}>删除该管理员账号。不能删除当前登录账号或最后一个超级管理员。</span>
                      </ApiForm>
                    </details>
                  ) : null}
                </div>
              </div>
            ))}
            {!adminUsers.length ? <div className={styles.emptyState}>没有管理员账号。</div> : null}
          </div>
        </section>

        <section className={styles.panel}>
          <h2>创作者账号</h2>
          <div className={`${styles.dataTable} ${styles.cols5}`}>
            <div className={styles.dataHeader}>
              <span>创作者</span>
              <span>状态</span>
              <span>登录名</span>
              <span>套餐 / 配额</span>
              <span>操作</span>
            </div>
            {creators.map((creator) => (
              <div className={styles.dataRow} key={creator.id}>
                <div className={styles.dataCell}>
                  <strong>{creator.creatorProfile?.displayName ?? creator.username ?? creator.id}</strong>
                  <small>{creator.id}</small>
                </div>
                <div className={styles.dataCell}>
                  <span className={creator.status === "active" ? `${styles.statusPill} ${styles.statusGood}` : `${styles.statusPill} ${styles.statusBad}`}>{creator.status}</span>
                </div>
                <div className={styles.dataCell}>{creator.username ?? "未设置"}</div>
                <div className={styles.dataCell}>
                  {creatorPlanDetails(creator.creatorPlan, creator._count.projects).map((detail) => (
                    <small key={detail}>{detail}</small>
                  ))}
                </div>
                  <div className={`${styles.dataCell} ${styles.rowActions}`}>
                    {hasPermission(session.user.role, "creators.manage") ? (
                      <>
                        <details className={`${styles.collapse} ${styles.compactDetails}`}>
                          <summary>状态</summary>
                          <ApiForm action={`/api/admin/creators/${creator.id}/status`} submitLabel="更新状态">
                            <label>
                              状态
                              <select name="status" defaultValue={creator.status}>
                                <option value="active">正常(active)</option>
                                <option value="suspended">停用(suspended)</option>
                              </select>
                            </label>
                          </ApiForm>
                        </details>
                        <details className={`${styles.collapse} ${styles.compactDetails}`}>
                          <summary>删除</summary>
                          <ApiForm action={`/api/admin/creators/${creator.id}`} method="DELETE" submitLabel="确认删除创作者">
                            <span className={styles.muted}>删除该创作者账号及其项目、订单、模型、粉丝码等关联记录。</span>
                          </ApiForm>
                        </details>
                      </>
                    ) : null}
                  </div>
              </div>
            ))}
            {!creators.length ? <div className={styles.emptyState}>还没有创作者。</div> : null}
          </div>
        </section>
      </section>
    </AdminChrome>
  );
}
