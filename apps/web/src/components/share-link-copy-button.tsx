"use client";

import { useState } from "react";

import styles from "@/app/dashboard.module.css";

export function ShareLinkCopyButton({ path, label = "Copy share link" }: { path: string; label?: string }) {
  const [status, setStatus] = useState("");

  async function copyLink() {
    const url = new URL(path, window.location.origin).toString();
    await navigator.clipboard.writeText(url);
    setStatus("Copied");
    window.setTimeout(() => setStatus(""), 1800);
  }

  return (
    <span className={styles.copyAction}>
      <button type="button" onClick={copyLink}>
        {label}
      </button>
      {status ? <small aria-live="polite">{status}</small> : null}
    </span>
  );
}
