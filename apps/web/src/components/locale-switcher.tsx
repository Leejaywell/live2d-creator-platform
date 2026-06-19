"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { type MouseEvent, useTransition } from "react";

import styles from "./locale-switcher.module.css";

const OPTIONS = [
  { code: "zh", flag: "🇨🇳", label: "中文" },
  { code: "en", flag: "🇺🇸", label: "English" },
  { code: "ja", flag: "🇯🇵", label: "日本語" },
] as const;

// Flag-icon trigger that opens a popover language menu. Uses a native <details>
// so it auto-dismisses on outside click (see DetailsDismissOnOutsideClick).
// Pass `up` where the trigger sits near the bottom (e.g. the creator sidebar).
export function LocaleSwitcher({ className, up = false }: { className?: string; up?: boolean }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const current = OPTIONS.find((o) => o.code === locale) ?? OPTIONS[0];

  const choose = (code: string, event: MouseEvent<HTMLButtonElement>) => {
    event.currentTarget.closest("details")?.removeAttribute("open");
    if (code === locale) return;
    // eslint-disable-next-line react-hooks/immutability -- cookie write in a click handler
    document.cookie = `NEXT_LOCALE=${code};path=/;max-age=31536000;samesite=lax`;
    startTransition(() => router.refresh());
  };

  return (
    <details className={`${styles.root} ${up ? styles.up : ""} ${className ?? ""}`}>
      <summary className={styles.trigger} aria-label={current.label} title={current.label}>
        <span className={styles.flag} aria-hidden>
          {current.flag}
        </span>
        <span className={styles.chev} aria-hidden>
          ▾
        </span>
      </summary>
      <div className={styles.menu} role="menu">
        {OPTIONS.map((o) => (
          <button
            key={o.code}
            type="button"
            role="menuitemradio"
            aria-checked={o.code === locale}
            disabled={pending}
            className={`${styles.item} ${o.code === locale ? styles.active : ""}`}
            onClick={(event) => choose(o.code, event)}
          >
            <span className={styles.flag} aria-hidden>
              {o.flag}
            </span>
            <span className={styles.name}>{o.label}</span>
            {o.code === locale ? (
              <span className={styles.check} aria-hidden>
                ✓
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </details>
  );
}
