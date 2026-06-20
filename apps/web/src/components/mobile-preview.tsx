"use client";

import { useState } from "react";

import styles from "./mobile-preview.module.css";

// Phone-icon button that pops a QR of the project's public URL (built from the
// machine's LAN IP) so a phone on the same network can scan and open it.
export function MobilePreview({
  qr,
  url,
  label = "手机预览",
  className,
}: {
  qr: string;
  url: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`${styles.btn} ${className ?? ""}`}
        title={label}
        aria-label={label}
        onClick={() => setOpen(true)}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="7" y="2" width="10" height="20" rx="2.5" />
          <line x1="11" y1="18" x2="13" y2="18" />
        </svg>
      </button>
      {open ? (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={label} onClick={() => setOpen(false)}>
          <div className={styles.card} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.close} aria-label="关闭" onClick={() => setOpen(false)}>
              ✕
            </button>
            <div className={styles.title}>{label}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR" width={220} height={220} className={styles.qr} />
            <a className={styles.url} href={url} target="_blank" rel="noreferrer">
              {url}
            </a>
            <p className={styles.hint}>用手机扫码打开，需与电脑处于同一 Wi-Fi 网络。</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
