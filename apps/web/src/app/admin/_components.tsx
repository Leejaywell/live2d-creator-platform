import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { CreatorPlan, UserRole } from "@prisma/client";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { Pill, type Tone } from "@/components/ui";
import { paymentStatusTone } from "@/lib/billing-history";

import { creatorStyles as dash } from "../creator/_components";
import styles from "./admin.module.css";

type AdminTranslator = Awaited<ReturnType<typeof getTranslations<"admin">>>;

type NavKey = "overview" | "users" | "billing" | "projects" | "diagnostics" | "settings";

const adminLinks: ReadonlyArray<readonly [NavKey, string, string]> = [
  ["overview", "/admin", "navOverview"],
  ["users", "/admin/users", "navUsers"],
  ["projects", "/admin/projects", "navProjects"],
  ["billing", "/admin/billing", "navBilling"],
  ["settings", "/admin/settings", "navSettings"],
  ["diagnostics", "/admin/diagnostics", "navDiagnostics"],
];

export async function AdminShell({
  active,
  user,
  children,
}: {
  active: NavKey;
  user: { username: string | null; role: UserRole };
  children: ReactNode;
}) {
  const t = await getTranslations("admin");
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brandRow}>
          <span className={styles.brandDot} aria-hidden />
          <span className={styles.brandName}>Backstage</span>
          <span className={styles.roleBadge}>Admin</span>
        </div>
        <nav className={styles.nav} aria-label={t("navAriaLabel")}>
          {adminLinks.map(([key, href, label]) => (
            <Link key={key} href={href} className={`${styles.navItem} ${active === key ? styles.navActive : ""}`}>
              {t(label)}
            </Link>
          ))}
        </nav>
        <div className={styles.topRight}>
          <LocaleSwitcher />
          <span className={styles.userChip}>{user.username ?? "admin"}</span>
          <Link href="/creator" className={styles.topLink}>
            {t("navCreatorLink")}
          </Link>
          <Link href="/api/auth/signout" className={styles.topLink}>
            {t("navSignOut")}
          </Link>
          <span className={styles.avatar} aria-hidden>
            {t("navAvatar")}
          </span>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}

export async function AdminAuthRequired() {
  const t = await getTranslations("admin");
  return (
    <main className={dash.authShell}>
      <div className={dash.authCard}>
        <p className={dash.kicker}>CONTROL ROOM</p>
        <h1>{t("authTitle")}</h1>
        <p>{t("authDescription")}</p>
        <div className={dash.authActions}>
          <Link href="/sign-in">{t("authSignIn")}</Link>
          <Link href="/">{t("authBackHome")}</Link>
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

export function creatorPlanDetails(t: AdminTranslator, plan: CreatorPlan | null, projectCount: number) {
  if (!plan) return [t("planNone")];
  return [
    t("planExpiry", {
      planName: plan.planName,
      status: plan.status,
      date: plan.expiresAt.toISOString().slice(0, 10),
    }),
    t("planUsage", {
      projects: projectCount,
      maxProjects: plan.maxProjects,
      usedAi: plan.usedAiMessages,
      aiLimit: plan.monthlyAiMessageLimit,
    }),
    t("planFanCodes", { used: plan.usedFanCodes, quota: plan.fanCodeQuota }),
  ];
}

export async function StatusPill({ status }: { status: string }) {
  const t = await getTranslations("admin");
  return (
    <Pill tone={status === "active" ? "live" : "danger"}>
      {status === "active" ? t("statusActive") : t("statusSuspended")}
    </Pill>
  );
}

export { dash };
