"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import styles from "./live2d-controls.module.css";

export type ControlItem = { label: string; onSelect: () => void; active?: boolean };
export type ControlSection = { title: string; items: ControlItem[] };
export type ControlPanel = {
  key: string;
  title: string;
  icon: "act" | "voice" | "settings";
  sections: ControlSection[];
};

// Shared Live2D viewer controls: a vertical stack of round buttons on the left,
// each opening a categorized popover panel to the right (motions / dress-up,
// voice lines, model settings). Reveal-on-hover (desktop) / always-on (touch) is
// handled by the parent stage CSS via the `.live2d-controls` global hook.
export function Live2DControls({ panels }: { panels: ControlPanel[] }) {
  const t = useTranslations("audience");
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className={`${styles.bar} live2d-controls`}>
      {panels.map((p) => (
        <div key={p.key} className={styles.group}>
          {open === p.key ? (
            <div className={styles.popover} role="menu" aria-label={p.title}>
              {p.sections.map((s, si) => (
                <div key={si} className={styles.section}>
                  <div className={styles.sectionHead}>
                    <span className={styles.diamond} aria-hidden>
                      {si % 2 === 0 ? "◇" : "◆"}
                    </span>
                    {s.title}
                  </div>
                  {s.items.length ? (
                    s.items.map((it, ii) => (
                      <button
                        key={ii}
                        type="button"
                        role="menuitem"
                        className={`${styles.item} ${it.active ? styles.itemActive : ""}`}
                        onClick={() => {
                          it.onSelect();
                          setOpen(null);
                        }}
                      >
                        {it.label}
                        {it.active ? <span className={styles.itemMark} aria-hidden>❀</span> : null}
                      </button>
                    ))
                  ) : (
                    <div className={styles.empty}>{t("none")}</div>
                  )}
                </div>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            className={`${styles.btn} ${open === p.key ? styles.btnActive : ""}`}
            onClick={() => setOpen((o) => (o === p.key ? null : p.key))}
            title={p.title}
            aria-label={p.title}
            aria-expanded={open === p.key}
          >
            <Icon kind={p.icon} />
          </button>
        </div>
      ))}
    </div>
  );
}

function Icon({ kind }: { kind: "act" | "voice" | "settings" }) {
  const sv = {
    width: 19,
    height: 19,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (kind === "act") {
    return (
      <svg {...sv} aria-hidden>
        <path d="M12 3l1.7 4.7L18 9.4l-4.3 1.7L12 16l-1.7-4.9L6 9.4l4.3-1.7z" />
        <path d="M18.5 14l.8 2.3 2.2.8-2.2.8-.8 2.3-.8-2.3-2.2-.8 2.2-.8z" />
      </svg>
    );
  }
  if (kind === "voice") {
    return (
      <svg {...sv} aria-hidden>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <path d="M12 18v3" />
      </svg>
    );
  }
  return (
    <svg {...sv} aria-hidden>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" />
    </svg>
  );
}
