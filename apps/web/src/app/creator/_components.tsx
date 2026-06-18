import Link from "next/link";
import type { ReactNode } from "react";

import { Brand } from "@/components/ui";

import styles from "./creator.module.css";

type NavKey = "overview" | "projects" | "billing" | "account";

const creatorLinks: ReadonlyArray<readonly [NavKey, string, string, string]> = [
  ["overview", "/creator", "工作台", "◎"],
  ["projects", "/creator/projects", "模型", "▤"],
  ["billing", "/creator/billing", "账单", "⊟"],
  ["account", "/creator/account", "账户", "⚙"],
];

export function CreatorShell({
  active,
  user,
  planName,
  children,
}: {
  active: NavKey;
  user: { username: string | null };
  planName?: string | null;
  children: ReactNode;
}) {
  const displayName = user.username ?? "creator";
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="创作者工作台导航">
        <div className={styles.sidebarBrand}>
          <Brand small />
        </div>
        <div className={styles.sidebarLabel}>创作者</div>
        <nav>
          {creatorLinks.map(([key, href, label, icon]) => (
            <Link
              key={label}
              href={href}
              className={`${styles.navItem} ${active === key ? styles.navActive : ""}`}
            >
              <span className={styles.navIcon} aria-hidden>
                {icon}
              </span>
              {label}
            </Link>
          ))}
        </nav>
        <div className={styles.sidebarFoot}>
          <div className={styles.sidebarAvatar} aria-hidden />
          <div className={styles.sidebarFootText}>
            <div className={styles.sidebarFootName}>{displayName}</div>
            <div className={styles.sidebarFootPlan}>{planName ?? "未开通套餐"}</div>
          </div>
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}

export function CreatorAuthRequired({ title }: { title: string }) {
  return (
    <main className={styles.authShell}>
      <div className={styles.authCard}>
        <p className={styles.kicker}>STAGE DOOR</p>
        <h1>{title}</h1>
        <p>请使用有效的创作者账号登录后继续。</p>
        <div className={styles.authActions}>
          <Link href="/sign-in">去登录</Link>
          <Link href="/">回首页</Link>
        </div>
      </div>
    </main>
  );
}

export function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className={styles.progress} aria-label={`已使用 ${pct}%`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function UsageTrend({ daily }: { daily: Array<{ date: string; messages: number; tokens: number }> }) {
  const maxMessages = Math.max(1, ...daily.map((day) => day.messages));
  return (
    <ol className={styles.trend}>
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

export function projectStatusLabel(status: string) {
  if (status === "published") return "上演中";
  if (status === "paused") return "已暂停";
  return "草稿";
}

export function projectStatusTone(status: string): "live" | "amber" | "danger" | "neutral" {
  if (status === "published") return "live";
  if (status === "paused") return "danger";
  return "amber";
}

type ProjectStepInput = {
  status: string;
  currentModelAsset?: { validationStatus: string } | null;
  triggerTags?: unknown[];
};

export function nextProjectStep(project: ProjectStepInput) {
  const validation = project.currentModelAsset?.validationStatus;
  if (!validation || validation === "pending") return "上传 Live2D 模型";
  if (validation === "invalid") return "修复模型校验错误";
  if (!project.triggerTags || project.triggerTags.length === 0) return "配置触发标签";
  if (project.status === "draft") return "发布上演";
  if (project.status === "paused") return "恢复上演";
  return "运营中 · 可发放粉丝码";
}

export { styles as creatorStyles };
