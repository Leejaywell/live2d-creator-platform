import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { Button, Pill } from "@/components/ui";

import { CreatorAuthRequired, CreatorShell, creatorStyles as styles } from "../_components";

export const dynamic = "force-dynamic";

function IdentityRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 13,
        color: "var(--text-dim)",
        padding: "10px 0",
        borderBottom: last ? "none" : "1px solid var(--hairline)",
      }}
    >
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default async function CreatorAccountPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return <CreatorAuthRequired title="账户设置" />;
  }

  const username = session.user.username ?? "creator";

  return (
    <CreatorShell active="account" user={session.user}>
      <div className={styles.pageHead}>
        <div>
          <h1>账户设置</h1>
          <p className={styles.pageHeadSub}>管理你的账号资料与登录安全</p>
        </div>
      </div>

      <div className={styles.accountGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>个人资料</h2>
          </div>
          <div className={styles.avatarRow}>
            <div className={styles.avatarBig} aria-hidden />
            <Button variant="ghost" size="sm" disabled title="即将支持">
              更换头像
            </Button>
          </div>
          <div className={styles.formCard}>
            <form>
              <label>
                登录名
                <input value={username} readOnly />
              </label>
              <label>
                角色
                <input value={session.user.role} readOnly />
              </label>
            </form>
          </div>
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2>修改密码</h2>
            </div>
            <div className={styles.formCard}>
              <ApiForm action="/api/account/password" submitLabel="更新密码">
                <label>
                  当前密码
                  <input name="currentPassword" type="password" autoComplete="current-password" required />
                </label>
                <label>
                  新密码
                  <input name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
                </label>
              </ApiForm>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2>身份信息</h2>
              <Pill tone="neutral">未认证</Pill>
            </div>
            <IdentityRow label="账号状态" value={session.user.status === "active" ? "正常" : session.user.status} />
            <IdentityRow label="主体类型" value="个人创作者" />
            <IdentityRow label="实名认证" value="MVP 阶段由管理员维护" last />
          </section>
        </div>
      </div>
    </CreatorShell>
  );
}
