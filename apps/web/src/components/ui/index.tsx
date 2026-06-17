import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

import styles from "./ui.module.css";

export type Tone = "live" | "amber" | "pink" | "teal" | "neutral" | "danger";
export type ButtonVariant = "primary" | "ghost" | "tintPink" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const toneClass: Record<Tone, string> = {
  live: styles.toneLive,
  amber: styles.toneAmber,
  pink: styles.tonePink,
  teal: styles.toneTeal,
  neutral: styles.toneNeutral,
  danger: styles.toneDanger,
};

const variantClass: Record<ButtonVariant, string> = {
  primary: styles.primary,
  ghost: styles.ghost,
  tintPink: styles.tintPink,
  danger: styles.danger,
};

const sizeClass: Record<ButtonSize, string> = {
  sm: styles.sm,
  md: "",
  lg: styles.lg,
};

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={styles.brand}>
      <span className={cx(styles.brandDot, small && styles.brandDotSm)} aria-hidden />
      <span className={cx(styles.brandName, small && styles.brandNameSm)}>Backstage</span>
    </span>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
};

export function Button({ variant = "primary", size = "md", block, className, ...rest }: ButtonProps) {
  return (
    <button
      className={cx(styles.btn, variantClass[variant], sizeClass[size], block && styles.block, className)}
      {...rest}
    />
  );
}

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
};

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  block,
  className,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={cx(styles.btn, variantClass[variant], sizeClass[size], block && styles.block, className)}
      {...rest}
    />
  );
}

export function Pill({
  tone = "neutral",
  mono = false,
  dot = false,
  children,
  className,
}: {
  tone?: Tone;
  mono?: boolean;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cx(styles.pill, toneClass[tone], mono && styles.pillMono, className)}>
      {dot && <span className={styles.dot} aria-hidden />}
      {children}
    </span>
  );
}

export function Card({
  pad = true,
  className,
  children,
}: {
  pad?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return <div className={cx(styles.card, pad && styles.cardPad, className)}>{children}</div>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className={styles.eyebrow}>
      <span className={styles.dot} aria-hidden />
      {children}
    </span>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: ReactNode }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

export { styles as uiStyles, cx };
