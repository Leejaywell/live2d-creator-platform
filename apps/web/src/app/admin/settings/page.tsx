import styles from "@/app/dashboard.module.css";
import { getCurrentSession } from "@/auth";
import { hasPermission, isAdminRole } from "@/lib/permissions";
import { listPlatformSettings } from "@/lib/platform-settings";

import { AdminAuthRequired, AdminChrome, PlatformSettingForm } from "../_components";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || !isAdminRole(session.user.role)) {
    return <AdminAuthRequired />;
  }

  const canManageSettings = hasPermission(session.user.role, "provider_secrets.manage");
  const platformSettings = canManageSettings ? await listPlatformSettings() : [];

  return (
    <AdminChrome active="settings" user={session.user}>
      <section className={styles.sectionHeader}>
        <div>
          <p className={styles.kicker}>SETTINGS</p>
          <h2>系统设置</h2>
        </div>
        <span className={canManageSettings ? `${styles.statusPill} ${styles.statusGood}` : `${styles.statusPill} ${styles.statusWarn}`}>
          {canManageSettings ? "可管理" : "只读角色"}
        </span>
      </section>

      <section className={styles.panel}>
        <h2>平台设置</h2>
        <p className={styles.muted}>配置服务商模式与运行策略,真正的密钥仍保存在部署环境变量中。</p>
        {canManageSettings ? (
          <div className={styles.tableLike}>
            {platformSettings.map((setting) => (
              <PlatformSettingForm key={setting.key} setting={setting} />
            ))}
          </div>
        ) : (
          <p className={styles.muted}>当前账号没有系统设置管理权限。</p>
        )}
      </section>
    </AdminChrome>
  );
}
