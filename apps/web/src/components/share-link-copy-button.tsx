"use client";

import { useState } from "react";

import { Button } from "@/components/ui";

export function ShareLinkCopyButton({ path, label = "复制链接" }: { path: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = new URL(path, window.location.origin).toString();
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={copy}>
      {copied ? "已复制" : label}
    </Button>
  );
}
