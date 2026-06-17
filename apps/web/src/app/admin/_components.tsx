import Link from "next/link";
import type { ReactNode } from "react";
import type { CreatorPlan, UserRole } from "@prisma/client";

import { Pill, type Tone } from "@/components/ui";
import { paymentStatusTone } from "@/lib/billing-history";

import { creatorStyles as dash } from "../creator/_components";
import styles from "./admin.module.css";

type NavKey = "overview" | "users" | "billing" | "projects" | "diagnostics" | "settings";

const adminLinks: ReadonlyArray<readonly [NavKey, string, string]> = [
  ["overview", "/admin", "首页"],
  ["projects", "/admin/projects", "项目审核"],
  ["users", "/admin/users", "用户"],
  ["billing", "/admin/billing", "订单"],
  ["settings", "/admin/settings", "设置"],
  ["diagnostics", "/admin/diagnostics", "诊断"],
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
      <header className={styles.topbar}>
        <div className={styles.brandRow}>
          <span className={styles.brandDot} aria-hidden />
          <span className={styles.brandName}>Backstage</span>
          <span className={styles.roleBadge}>Admin</span>
        </div>
        <nav className={styles.nav} aria-label="管理后台导航">
          {adminLinks.map(([key, href, label]) => (
            <Link key={key} href={href} className={`${styles.navItem} ${active === key ? styles.navActive : ""}`}>
              {label}
            </Link>
          ))}
        </nav>
        <div className={styles.topRight}>
          <span className={styles.userChip}>{user.username ?? "admin"}</span>
          <Link href="/creator" className={styles.topLink}>
            创作者
          </Link>
          <Link href="/api/auth/signout" className={styles.topLink}>
            退出
          </Link>
          <span className={styles.avatar} aria-hidden>
            管
          </span>
        </div>
      </header>
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
