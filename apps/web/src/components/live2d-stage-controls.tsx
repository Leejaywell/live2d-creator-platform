"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useRef, useState } from "react";

import styles from "./live2d-stage-controls.module.css";

// Delay before a hover-out closes the panel. Long enough to cross the gap
// between the trigger button and the floating panel without it vanishing.
const HOVER_CLOSE_DELAY_MS = 160;

export type StageAction = { label: string; active?: boolean; onSelect: () => void };
export type StageScene = { label: string; active: boolean; onSelect: () => void };
export type StageSettingSection = { title: string; items: StageAction[] };

type StageTab = "motions" | "expressions" | "audio" | "scenes" | "settings";

type Props = {
  motions: StageAction[];
  expressions: StageAction[];
  scenes: StageScene[];
  settings: StageSettingSection[];
  voiceVolume: number;
  onVoiceVolume: (v: number) => void;
  onRandom: () => void;
  bgmOn: boolean;
  onToggleBgm: () => void;
  petActive: boolean;
  onTogglePet: () => void;
  /** "dock" = bottom icon dock (preview/audience). "pet" = side-split columns
   * with a single close top-right, mirroring the landing desktop-pet. */
  variant?: "dock" | "pet";
  /** Show the desktop-pet toggle button. Hidden on mobile, which uses the pet
   * layout without an actual desktop-pet concept. */
  showPetToggle?: boolean;
};

type IconName = "motions" | "expressions" | "audio" | "scenes" | "settings" | "pet" | "close";

// Replica of the landing-demo control bar for the real Live2D viewer.
export function Live2DStageControls(props: Props) {
  const { petActive, onTogglePet, variant = "dock", showPetToggle = true } = props;
  const t = useTranslations("audience");
  const [tab, setTab] = useState<StageTab>("motions");
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const openTab = (key: StageTab) => {
    cancelClose();
    setTab(key);
    setOpen(true);
  };
  // Defer the close so moving the pointer across the gap into the panel
  // (which re-fires mouse-enter and cancels this) does not dismiss it.
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  };

  const tabMeta: Record<StageTab, { label: string; icon: IconName }> = {
    motions: { label: t("tabMotions"), icon: "motions" },
    expressions: { label: t("tabExpressions"), icon: "expressions" },
    audio: { label: t("tabAudio"), icon: "audio" },
    scenes: { label: t("tabScenes"), icon: "scenes" },
    settings: { label: t("panelSettingsTitle"), icon: "settings" },
  };

  const tabContent = (key: StageTab): ReactNode => {
    if (key === "motions" || key === "expressions") {
      const items = key === "motions" ? props.motions : props.expressions;
      return (
        <div className={styles.chipGrid}>
          {items.length ? (
            items.map((m, i) => (
              <button
                key={i}
                type="button"
                className={`${styles.chip} ${key === "expressions" ? styles.chipMuted : ""}`}
                onClick={m.onSelect}
              >
                {m.label}
              </button>
            ))
          ) : (
            <span className={styles.emptyHint}>{t("none")}</span>
          )}
        </div>
      );
    }
    if (key === "audio") {
      return (
        <div className={styles.stack}>
          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>{t("voiceVolume")}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={props.voiceVolume}
              onChange={(e) => props.onVoiceVolume(parseFloat(e.target.value))}
              aria-label={t("voiceVolume")}
            />
          </div>
          <div className={styles.audioButtons}>
            <button type="button" className={styles.actionBtn} onClick={props.onRandom}>
              {t("randomInteract")}
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${props.bgmOn ? styles.actionBtnActive : ""}`}
              onClick={props.onToggleBgm}
            >
              {props.bgmOn ? t("bgmPause") : t("bgmPlay")}
            </button>
          </div>
        </div>
      );
    }
    if (key === "scenes") {
      return (
        <div className={styles.chipGrid}>
          {props.scenes.map((s, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.chip} ${s.active ? styles.chipActive : ""}`}
              onClick={s.onSelect}
            >
              {s.label}
            </button>
          ))}
        </div>
      );
    }
    // settings
    return (
      <div className={styles.stack}>
        {props.settings.map((section, si) => (
          <div key={si} className={styles.settingSection}>
            <div className={styles.settingTitle}>{section.title}</div>
            <div className={styles.settingRow}>
              {section.items.map((it, ii) => (
                <button
                  key={ii}
                  type="button"
                  className={`${styles.chip} ${it.active ? styles.chipActive : ""}`}
                  onClick={it.onSelect}
                >
                  {it.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const closeBtn = showPetToggle ? (
    <button
      type="button"
      className={`${styles.cornerBtn} ${styles.cornerTR} ${petActive ? styles.cornerBtnActive : ""}`}
      title={petActive ? t("close") : t("petMode")}
      aria-label={petActive ? t("close") : t("petMode")}
      aria-pressed={petActive}
      onClick={onTogglePet}
    >
      <Icon name={petActive ? "close" : "pet"} />
    </button>
  ) : null;

  // ---- Pet variant: side-split icon columns + a single close top-right. ----
  if (variant === "pet") {
    const left: StageTab[] = ["motions", "expressions", "audio"];
    const right: StageTab[] = ["scenes", "settings"];
    const sideButton = (key: StageTab, side: "left" | "right") => (
      <div
        key={key}
        className={styles.petBtnWrap}
        onMouseEnter={() => openTab(key)}
        onMouseLeave={scheduleClose}
      >
        <button
          type="button"
          className={`${styles.petIconBtn} ${open && tab === key ? styles.petIconBtnActive : ""}`}
          title={tabMeta[key].label}
          aria-label={tabMeta[key].label}
          onClick={() => (open && tab === key ? (cancelClose(), setOpen(false)) : openTab(key))}
        >
          <Icon name={tabMeta[key].icon} />
        </button>
        {open && tab === key ? (
          <div className={`${styles.petList} ${side === "left" ? styles.petListLeft : styles.petListRight}`}>
            <div className={styles.petListHead}>{tabMeta[key].label}</div>
            <div className={styles.petListBody}>{tabContent(key)}</div>
          </div>
        ) : null}
      </div>
    );
    return (
      <div className={`${styles.controls} live2d-stage-controls`}>
        {closeBtn}
        <div className={styles.petSideLeft}>{left.map((k) => sideButton(k, "left"))}</div>
        <div className={styles.petSideRight}>{right.map((k) => sideButton(k, "right"))}</div>
      </div>
    );
  }

  // ---- Dock variant (default): bottom icon dock + popover panel. ----
  const dockTabs: StageTab[] = ["motions", "expressions", "audio", "scenes", "settings"];
  return (
    <div className={`${styles.controls} live2d-stage-controls`}>
      {closeBtn}
      <div className={styles.dockWrapper} onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
        {open ? (
          <div className={styles.panel} role="group" aria-label={tabMeta[tab].label}>
            <div className={styles.panelTop}>
              <span className={styles.panelTitle}>{tabMeta[tab].label}</span>
              <button type="button" className={styles.panelClose} aria-label={t("close")} onClick={() => setOpen(false)}>
                <Icon name="close" />
              </button>
            </div>
            <div className={styles.panelBody}>{tabContent(tab)}</div>
          </div>
        ) : null}
        <div className={styles.dock}>
          {dockTabs.map((key) => (
            <button
              key={key}
              type="button"
              className={`${styles.dockTab} ${open && tab === key ? styles.dockTabActive : ""}`}
              title={tabMeta[key].label}
              aria-label={tabMeta[key].label}
              onClick={() => (open && tab === key ? (cancelClose(), setOpen(false)) : openTab(key))}
              onMouseEnter={() => openTab(key)}
            >
              <Icon name={tabMeta[key].icon} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Icon({ name }: { name: IconName }) {
  const sv = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths: Record<IconName, ReactNode> = {
    motions: (
      <>
        <path d="M4 8V4h4" />
        <path d="M16 4h4v4" />
        <path d="M4 16v4h4" />
        <path d="M16 20h4v-4" />
        <line x1="6" y1="12" x2="18" y2="12" strokeWidth={2.5} />
        <line x1="12" y1="7" x2="12" y2="17" />
      </>
    ),
    expressions: (
      <>
        <path d="M8 3h8l5 5v8l-5 5H8l-5-5V8Z" />
        <line x1="8" y1="10" x2="10" y2="10" />
        <line x1="14" y1="10" x2="16" y2="10" />
        <path d="M9 14h6" />
        <path d="M9 14v1a3 3 0 0 0 6 0v-1" />
      </>
    ),
    audio: (
      <>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
      </>
    ),
    scenes: (
      <>
        <rect width="18" height="18" x="3" y="3" rx="4" />
        <line x1="3" y1="13" x2="21" y2="13" />
        <line x1="12" y1="13" x2="12" y2="21" />
        <line x1="12" y1="13" x2="6" y2="21" />
        <line x1="12" y1="13" x2="18" y2="21" />
        <circle cx="12" cy="9" r="3" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" />
      </>
    ),
    pet: (
      <>
        <path d="M3 10V5l4 4h10l4-4v5l-2 3v4l-4 3H9l-4-3v-4Z" />
        <rect x="7" y="11" width="3" height="2" rx="0.5" />
        <rect x="14" y="11" width="3" height="2" rx="0.5" />
        <path d="M11 15h2l-1 1Z" />
      </>
    ),
    close: (
      <>
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="18" y1="6" x2="6" y2="18" />
      </>
    ),
  };
  return (
    <svg {...sv} aria-hidden>
      {paths[name]}
    </svg>
  );
}
