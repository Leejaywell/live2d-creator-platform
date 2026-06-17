import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { Pill } from "@/components/ui";

import { CreatorAuthRequired, CreatorShell, creatorStyles as styles } from "../_components";

export const dynamic = "force-dynamic";

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
            <Pill tone="neutral">{username}</Pill>
          </div>
          <div className={styles.metaGrid} style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className={styles.metaItem}>
              <span>登录名</span>
              <strong style={{ fontSize: 15 }}>{username}</strong>
            </div>
            <div className={styles.metaItem}>
              <span>角色</span>
              <strong style={{ fontSize: 15 }}>{session.user.role}</strong>
            </div>
            <div className={styles.metaItem}>
              <span>状态</span>
              <strong style={{ fontSize: 15 }}>{session.user.status === "active" ? "正常" : session.user.status}</strong>
            </div>
          </div>
        </section>

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
      </div>
    </CreatorShell>
  );
}
