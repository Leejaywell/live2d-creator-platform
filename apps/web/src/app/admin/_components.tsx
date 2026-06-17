import Link from "next/link";
import type { ReactNode } from "react";
import type { CreatorPlan, UserRole } from "@prisma/client";

import { Brand, Pill, type Tone } from "@/components/ui";
import { paymentStatusTone } from "@/lib/billing-history";

import { creatorStyles as dash } from "../creator/_components";
import styles from "./admin.module.css";

type NavKey = "overview" | "users" | "billing" | "projects" | "diagnostics" | "settings";

const adminLinks: ReadonlyArray<readonly [NavKey, string, string, string]> = [
  ["overview", "/admin", "概览", "◎"],
  ["users", "/admin/users", "账号", "☻"],
  ["billing", "/admin/billing", "订单", "⊟"],
  ["projects", "/admin/projects", "交付", "▤"],
  ["settings", "/admin/settings", "设置", "⚙"],
  ["diagnostics", "/admin/diagnostics", "诊断", "❉"],
];

export function AdminShell({
  active,
  user,
  children,
}: {
  active: NavKey;
  user: { username: string | null; role: UserRole };
  children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="管理后台导航">
        <div className={styles.brandRow}>
          <Brand small />
          <span className={styles.roleBadge}>{user.role}</span>
        </div>
        <div className={styles.sidebarLabel}>控制台</div>
        <nav>
          {adminLinks.map(([key, href, label, icon]) => (
            <Link
              key={key}
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
          <span>{user.username ?? "admin"}</span>
          <Link href="/creator">创作者工作台</Link>
          <Link href="/api/auth/signout">退出登录</Link>
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}

export function AdminAuthRequired() {
  return (
    <main className={dash.authShell}>
      <div className={dash.authCard}>
        <p className={dash.kicker}>CONTROL ROOM</p>
        <h1>管理后台</h1>
        <p>请使用有效的超级管理员、运营管理员或客服管理员账号登录。</p>
        <div className={dash.authActions}>
          <Link href="/sign-in">去登录</Link>
          <Link href="/">回首页</Link>
        </div>
      </div>
    </main>
  );
}

export function paymentStatusPillTone(status: string): Tone {
  const tone = paymentStatusTone(status);
  if (tone === "good") return "live";
  if (tone === "bad") return "danger";
  if (tone === "warn") return "amber";
  return "neutral";
}

export function creatorPlanDetails(plan: CreatorPlan | null, projectCount: number) {
  if (!plan) return ["未开通套餐"];
  return [
    `${plan.planName} · ${plan.status} · ${plan.expiresAt.toISOString().slice(0, 10)} 到期`,
    `项目 ${projectCount}/${plan.maxProjects} · AI ${plan.usedAiMessages}/${plan.monthlyAiMessageLimit}`,
    `粉丝码 ${plan.usedFanCodes}/${plan.fanCodeQuota}`,
  ];
}

export function StatusPill({ status }: { status: string }) {
  return <Pill tone={status === "active" ? "live" : "danger"}>{status === "active" ? "正常" : "停用"}</Pill>;
}

export { dash };
