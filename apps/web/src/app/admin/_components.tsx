import Link from "next/link";
import type { ReactNode } from "react";
import type { CreatorPlan, UserRole } from "@prisma/client";

import styles from "@/app/dashboard.module.css";
import { ApiForm } from "@/components/api-form";
import { paymentStatusTone } from "@/lib/billing-history";
import { type PlatformSettingView } from "@/lib/platform-settings";

type AdminChromeProps = {
  active: "overview" | "users" | "billing" | "projects" | "diagnostics" | "settings";
  children: ReactNode;
  user: {
    username: string | null;
    role: UserRole;
  };
};

const adminLinks = [
  ["overview", "/admin", "概览"],
  ["users", "/admin/users", "账号管理"],
  ["billing", "/admin/billing", "订单与配额"],
  ["projects", "/admin/projects", "项目交付"],
  ["diagnostics", "/admin/diagnostics", "诊断"],
  ["settings", "/admin/settings", "系统设置"],
] as const;

export function AdminChrome({ active, children, user }: AdminChromeProps) {
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>CONTROL ROOM</p>
          <h1>管理后台</h1>
          <p>
            {user.username ?? "未设置账号"} · {user.role}
          </p>
        </div>
        <nav className={styles.nav}>
          <Link href="/creator">创作者工作台</Link>
          <Link href="/">首页</Link>
          <Link href="/api/auth/signout">退出登录</Link>
        </nav>
      </header>

      <div className={styles.consoleLayout}>
        <aside className={styles.consoleSidebar} aria-label="管理后台导航">
          <div className={styles.sidebarTitle}>
            <span>管理菜单</span>
            <strong>{user.role}</strong>
          </div>
          <nav>
            {adminLinks.map(([key, href, label]) => (
              <Link className={active === key ? styles.sidebarActive : undefined} href={href} key={key}>
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className={styles.consoleContent}>{children}</div>
      </div>
    </main>
  );
}

export function AdminAuthRequired() {
  return (
    <main className={styles.authShell}>
      <div className={styles.authCard}>
        <p className={styles.kicker}>CONTROL ROOM</p>
        <h1>管理后台</h1>
        <p>请使用有效的超级管理员、运营管理员或客服管理员账号登录。</p>
        <div className={styles.authActions}>
          <Link href="/sign-in">去登录</Link>
          <Link href="/">回首页</Link>
        </div>
      </div>
    </main>
  );
}

export function CapabilityRow({ title, detail, done = false }: { title: string; detail: string; done?: boolean }) {
  return (
    <li className={styles.checkItem}>
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <span className={done ? `${styles.statusPill} ${styles.statusGood}` : `${styles.statusPill} ${styles.statusWarn}`}>{done ? "已就绪" : "规划中"}</span>
    </li>
  );
}

export function paymentStatusToneClass(status: string) {
  const tone = paymentStatusTone(status);
  if (tone === "good") return `${styles.statusPill} ${styles.statusGood}`;
  if (tone === "bad") return `${styles.statusPill} ${styles.statusBad}`;
  if (tone === "warn") return `${styles.statusPill} ${styles.statusWarn}`;
  return styles.statusPill;
}

export function creatorPlanDetails(plan: CreatorPlan | null, projectCount: number) {
  if (!plan) return ["未开通套餐"];

  return [
    `${plan.planName} · ${plan.status} · ${plan.expiresAt.toISOString().slice(0, 10)} 到期`,
    `项目 ${projectCount}/${plan.maxProjects} · AI 消息 ${plan.usedAiMessages}/${plan.monthlyAiMessageLimit}`,
    `粉丝码 ${plan.usedFanCodes}/${plan.fanCodeQuota}`,
  ];
}

export function UsageTrend({ daily }: { daily: Array<{ date: string; messages: number; tokens: number }> }) {
  const maxMessages = Math.max(1, ...daily.map((day) => day.messages));
  return (
    <ol className={styles.trendList}>
      {daily.map((day) => (
        <li key={day.date}>
          <span>{day.date.slice(5)}</span>
          <div className={styles.progress} aria-label={`${day.date} 有 ${day.messages} 条消息`}>
            <span style={{ width: `${Math.round((day.messages / maxMessages) * 100)}%` }} />
          </div>
          <strong>{day.messages}</strong>
        </li>
      ))}
    </ol>
  );
}

export function PlatformSettingForm({ setting }: { setting: PlatformSettingView }) {
  return (
    <div className={styles.row}>
      <strong>{setting.label}</strong>
      <span>
        {setting.category} · {setting.source}
        {setting.updatedAt ? ` · 更新于 ${setting.updatedAt.toISOString().slice(0, 10)}` : ""}
      </span>
      <span>{setting.description}</span>
      <details className={`${styles.collapse} ${styles.compactDetails}`}>
        <summary>编辑</summary>
        <ApiForm action="/api/admin/platform-settings" submitLabel="保存设置">
          <input type="hidden" name="key" value={setting.key} />
          <label>
            值
            {setting.valueType === "enum" ? (
              <select name="value" defaultValue={String(setting.value)}>
                {setting.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : setting.valueType === "number" ? (
              <input name="value" type="number" min="1" max="10000" defaultValue={String(setting.value)} />
            ) : setting.valueType === "boolean" ? (
              <select name="value" defaultValue={String(setting.value)}>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input name="value" defaultValue={String(setting.value)} />
            )}
          </label>
        </ApiForm>
      </details>
    </div>
  );
}
