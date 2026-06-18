"use client";

import { useState } from "react";

// Plain text-link control so it inherits the unified .rowActions styling
// when placed inside a table action cluster.
export function ShareLinkCopyButton({ path, label = "复制链接" }: { path: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = new URL(path, window.location.origin).toString();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button type="button" onClick={copy}>
      {copied ? "已复制" : label}
    </button>
  );
}
