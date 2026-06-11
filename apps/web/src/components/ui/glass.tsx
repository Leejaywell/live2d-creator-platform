import type { ReactNode } from "react";

import styles from "./glass.module.css";

// Atmospheric stage backdrop — the bottom layer every glass surface floats over.
export function StageBackdrop() {
  return (
    <div className={styles.stage} aria-hidden>
      <div className={styles.stageGlow} />
    </div>
  );
}

export function GlassPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={`glass ${styles.panel} ${className ?? ""}`}>{children}</section>;
}

export function GlassCard({
  children,
  interactive,
  className,
}: {
  children: ReactNode;
  interactive?: boolean;
  className?: string;
}) {
  return (
    <div className={`glass ${styles.card} ${interactive ? styles.cardInteractive : ""} ${className ?? ""}`}>
      {children}
    </div>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return <span className={styles.kicker}>{children}</span>;
}

export function StatTile({
  label,
  value,
  hint,
  ratio,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  ratio?: number;
}) {
  return (
    <div className={`glass ${styles.statTile}`}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      {hint ? <span className={styles.statHint}>{hint}</span> : null}
      {typeof ratio === "number" ? (
        <div className={styles.progress}>
          <div className={styles.progressFill} style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} />
        </div>
      ) : null}
    </div>
  );
}

export function ProgressBar({ ratio }: { ratio: number }) {
  return (
    <div className={styles.progress}>
      <div className={styles.progressFill} style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }} />
    </div>
  );
}

type Tone = "primary" | "secondary" | "ghost" | "danger";
const toneClass: Record<Tone, string> = {
  primary: styles.btnPrimary,
  secondary: styles.btnSecondary,
  ghost: styles.btnGhost,
  danger: styles.btnDanger,
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "good" | "warn" | "neutral" }) {
  const cls = tone === "good" ? styles.badgeGood : tone === "warn" ? styles.badgeWarn : styles.badgeNeutral;
  return <span className={`${styles.badge} ${cls}`}>{children}</span>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyTitle}>{title}</span>
      {children}
    </div>
  );
}

// Class string for styling any <a>/<button>/form submit as a glass button.
export function btnClass(tone: Tone = "secondary") {
  return `${styles.btn} ${toneClass[tone]}`;
}

export { styles as glassStyles, toneClass };
