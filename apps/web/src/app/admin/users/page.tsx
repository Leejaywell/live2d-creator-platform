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
          <h1>账号管理</h1>
          <p className={dash.pageHeadSub}>{adminUsers.length} 个管理员 · {creators.length} 个创作者</p>
        </div>
      </div>

      <div className={dash.twoCol}>
        {hasPermission(role, "admin.users.manage") && (
          <details className={`${dash.panel} ${dash.disclosure}`}>
            <summary>+ 新建 / 更新管理员</summary>
            <div className={dash.formCard}>
              <ApiForm action="/api/admin/users" submitLabel="保存管理员">
                <label>
                  用户名
                  <input name="username" required />
                </label>
                <label>
                  初始密码（更新时可留空）
                  <input name="password" type="password" minLength={8} />
                </label>
                <label>
                  角色
                  <select name="role" defaultValue="ops_admin">
                    <option value="super_admin">超级管理员</option>
                    <option value="ops_admin">运营管理员</option>
                    <option value="support_admin">客服管理员</option>
                  </select>
                </label>
                <label>
                  状态
                  <select name="status" defaultValue="active">
                    <option value="active">正常</option>
                    <option value="suspended">停用</option>
                  </select>
                </label>
              </ApiForm>
            </div>
          </details>
        )}
        {hasPermission(role, "creators.manage") && (
          <details className={`${dash.panel} ${dash.disclosure}`}>
            <summary>+ 创建创作者</summary>
            <div className={dash.formCard}>
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
                  <input name="planName" placeholder="Trial" />
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
        )}
      </div>

      <section className={dash.panel}>
        <div className={dash.panelHead}>
          <h2>管理员账号</h2>
        </div>
        <div className={dash.tableWrap}>
          <div className={`${dash.tableRow} ${dash.tableHead}`} style={{ gridTemplateColumns: "1.6fr 1fr 1fr auto" }}>
            <span>账号</span>
            <span>状态</span>
            <span>角色</span>
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
                  <details className={dash.disclosure}>
                    <summary>删除</summary>
                    <div className={dash.formCard}>
                      <ApiForm action={`/api/admin/users/${adminUser.id}`} method="DELETE" submitLabel="确认删除">
                        <span className={dash.pageHeadSub}>不能删除当前账号或最后一个超级管理员。</span>
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
          <h2>创作者账号</h2>
        </div>
        <div className={dash.tableWrap}>
          <div className={`${dash.tableRow} ${dash.tableHead}`} style={{ gridTemplateColumns: "1.4fr 0.8fr 1fr 1.6fr auto" }}>
            <span>创作者</span>
            <span>状态</span>
            <span>登录名</span>
            <span>套餐 / 配额</span>
            <span />
          </div>
          {creators.map((creator) => (
            <div key={creator.id} className={dash.tableRow} style={{ gridTemplateColumns: "1.4fr 0.8fr 1fr 1.6fr auto" }}>
              <div className={dash.cellMain}>
                <strong>{creator.creatorProfile?.displayName ?? creator.username ?? creator.id}</strong>
                <small>{creator.id}</small>
              </div>
              <StatusPill status={creator.status} />
              <span className={dash.mono}>{creator.username ?? "未设置"}</span>
              <div className={dash.cellMain}>
                {creatorPlanDetails(creator.creatorPlan, creator._count.projects).map((detail) => (
                  <small key={detail}>{detail}</small>
                ))}
              </div>
              <div className={dash.rowActions}>
                {hasPermission(role, "creators.manage") ? (
                  <>
                    <details className={dash.disclosure}>
                      <summary>状态</summary>
                      <div className={dash.formCard}>
                        <ApiForm action={`/api/admin/creators/${creator.id}/status`} submitLabel="更新状态">
                          <label>
                            状态
                            <select name="status" defaultValue={creator.status}>
                              <option value="active">正常</option>
                              <option value="suspended">停用</option>
                            </select>
                          </label>
                        </ApiForm>
                      </div>
                    </details>
                    <details className={dash.disclosure}>
                      <summary>删除</summary>
                      <div className={dash.formCard}>
                        <ApiForm action={`/api/admin/creators/${creator.id}`} method="DELETE" submitLabel="确认删除创作者">
                          <span className={dash.pageHeadSub}>同时删除其项目、订单、模型、粉丝码等记录。</span>
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
