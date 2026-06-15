import styles from "@/app/dashboard.module.css";
import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";

import { CreatorAuthRequired, CreatorChrome } from "../_components";

export const dynamic = "force-dynamic";

export default async function CreatorAccountPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return <CreatorAuthRequired title="账号安全" />;
  }

  return (
    <CreatorChrome active="account" user={session.user}>
      <section className={styles.sectionHeader}>
        <div>
          <p className={styles.kicker}>ACCOUNT</p>
          <h2>账号安全</h2>
        </div>
        <div className={styles.sectionActions}>
          <span className={styles.statusPill}>{session.user.username ?? "creator"}</span>
          <details className={styles.inlineAction}>
            <summary>修改密码</summary>
            <div>
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
          </details>
        </div>
      </section>

      <section className={styles.panel}>
        <h2>账号信息</h2>
        <div className={styles.metaGrid}>
          <div className={styles.metaItem}>
            <span>登录名</span>
            <strong>{session.user.username ?? "creator"}</strong>
          </div>
          <div className={styles.metaItem}>
            <span>角色</span>
            <strong>{session.user.role}</strong>
          </div>
          <div className={styles.metaItem}>
            <span>状态</span>
            <strong>{session.user.status}</strong>
          </div>
        </div>
      </section>
    </CreatorChrome>
  );
}
