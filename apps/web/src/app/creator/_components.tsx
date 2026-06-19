import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Brand } from "@/components/ui";

import styles from "./creator.module.css";

type NavKey = "overview" | "projects" | "billing" | "account";

const creatorLinks: ReadonlyArray<readonly [NavKey, string, string, string]> = [
  ["overview", "/creator", "navOverview", "◎"],
  ["projects", "/creator/projects", "navProjects", "▤"],
  ["billing", "/creator/billing", "navBilling", "⊟"],
  ["account", "/creator/account", "navAccount", "⚙"],
];

export async function CreatorShell({
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
  const t = await getTranslations("creator");
  const displayName = user.username ?? "creator";
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label={t("sidebarNavLabel")}>
        <div className={styles.sidebarBrand}>
          <Brand small />
        </div>
        <div className={styles.sidebarLabel}>{t("sidebarRole")}</div>
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
              {t(label)}
            </Link>
          ))}
        </nav>
        <div className={styles.sidebarFoot}>
          <div className={styles.sidebarAvatar} aria-hidden />
          <div className={styles.sidebarFootText}>
            <div className={styles.sidebarFootName}>{displayName}</div>
            <div className={styles.sidebarFootPlan}>{planName ?? t("noPlan")}</div>
          </div>
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}

export async function CreatorAuthRequired({ title }: { title: string }) {
  const t = await getTranslations("creator");
  return (
    <main className={styles.authShell}>
      <div className={styles.authCard}>
        <p className={styles.kicker}>STAGE DOOR</p>
        <h1>{title}</h1>
        <p>{t("authPrompt")}</p>
        <div className={styles.authActions}>
          <Link href="/sign-in">{t("authGoSignIn")}</Link>
          <Link href="/">{t("authBackHome")}</Link>
        </div>
      </div>
    </main>
  );
}

export async function UsageBar({ used, limit }: { used: number; limit: number }) {
  const t = await getTranslations("creator");
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className={styles.progress} aria-label={t("usageBarLabel", { pct })}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export async function UsageTrend({ daily }: { daily: Array<{ date: string; messages: number; tokens: number }> }) {
  const t = await getTranslations("creator");
  const maxMessages = Math.max(1, ...daily.map((day) => day.messages));
  return (
    <ol className={styles.trend}>
      {daily.map((day) => (
        <li key={day.date}>
          <span>{day.date.slice(5)}</span>
          <div
            className={styles.progress}
            aria-label={t("usageTrendDayLabel", { date: day.date, messages: day.messages })}
          >
            <span style={{ width: `${Math.round((day.messages / maxMessages) * 100)}%` }} />
          </div>
          <strong>{day.messages}</strong>
        </li>
      ))}
    </ol>
  );
}

export function projectStatusLabel(status: string) {
  if (status === "published") return "statusPublished";
  if (status === "paused") return "statusPaused";
  return "statusDraft";
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
  if (!validation || validation === "pending") return "stepUploadModel";
  if (validation === "invalid") return "stepFixValidation";
  if (!project.triggerTags || project.triggerTags.length === 0) return "stepConfigTags";
  if (project.status === "draft") return "stepPublish";
  if (project.status === "paused") return "stepResume";
  return "stepRunning";
}

export { styles as creatorStyles };
