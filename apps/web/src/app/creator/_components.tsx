import Link from "next/link";
import type { ReactNode } from "react";

import styles from "@/app/dashboard.module.css";
import { StageBackdrop } from "@/components/ui/glass";
import { paymentStatusTone } from "@/lib/billing-history";
import { buildCheckoutUrl, checkoutSkuFromOrderNotes } from "@/lib/checkout-products";

type CreatorChromeProps = {
  active: "overview" | "projects" | "billing" | "account";
  children: ReactNode;
  user: {
    username: string | null;
  };
};

const creatorLinks = [
  ["overview", "/creator", "概览"],
  ["projects", "/creator/projects", "角色项目"],
  ["billing", "/creator/billing", "账单配额"],
  ["account", "/creator/account", "账号安全"],
] as const;

export function CreatorChrome({ active, children, user }: CreatorChromeProps) {
  return (
    <main className={styles.shell}>
      <StageBackdrop />
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>BACKSTAGE</p>
          <h1>创作者工作台</h1>
          <p>{user.username ?? "未设置账号"}</p>
        </div>
        <nav className={styles.nav}>
          <Link href="/admin">管理后台</Link>
          <Link href="/">首页</Link>
          <Link href="/api/auth/signout">退出登录</Link>
        </nav>
      </header>

      <div className={styles.consoleLayout}>
        <aside className={styles.consoleSidebar} aria-label="创作者工作台导航">
          <div className={styles.sidebarTitle}>
            <span>工作台菜单</span>
            <strong>{user.username ?? "creator"}</strong>
          </div>
          <nav>
            {creatorLinks.map(([key, href, label]) => (
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

export function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className={styles.progress} aria-label={`已使用 ${pct}%`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function projectStatusLabel(status: string) {
  if (status === "published") return "上演中";
  if (status === "paused") return "已暂停";
  return "草稿";
}

export function paymentStatusToneClass(status: string) {
  const tone = paymentStatusTone(status);
  if (tone === "good") return `${styles.statusPill} ${styles.statusGood}`;
  if (tone === "bad") return `${styles.statusPill} ${styles.statusBad}`;
  if (tone === "warn") return `${styles.statusPill} ${styles.statusWarn}`;
  return styles.statusPill;
}

export function nextProjectStep(project: {
  status: string;
  triggerTags: unknown[];
  fanAccessCodes: unknown[];
}) {
  if (!project.triggerTags.length) return "下一步:创建触发标签,绑定表情和人设片段。";
  if (!project.fanAccessCodes.length) return "下一步:生成粉丝访问码再分享。";
  if (project.status !== "published") return "下一步:模型就绪后发布项目。";
  return "已就绪,随时可以分享给粉丝。";
}

export function resumableCheckoutPaymentLink(
  order: {
    id: string;
    notes?: string | null;
    paymentStatus: string;
  },
  checkoutMode: string,
) {
  if (checkoutMode === "manual-only" || order.paymentStatus !== "pending") {
    return undefined;
  }
  return checkoutSkuFromOrderNotes(order.notes) ? buildCheckoutUrl(order.id) : undefined;
}

export function cancellableCheckoutOrder(
  order: {
    notes?: string | null;
    paymentStatus: string;
  }
) {
  return order.paymentStatus === "pending" && Boolean(checkoutSkuFromOrderNotes(order.notes));
}
