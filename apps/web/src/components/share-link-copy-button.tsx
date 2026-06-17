"use client";

import { useState } from "react";

import { Button } from "@/components/ui";

export function ShareLinkCopyButton({ path, label = "复制链接" }: { path: string; label?: string }) {
  const [status, setStatus] = useState("");

  async function copyLink() {
    const url = new URL(path, window.location.origin).toString();
    await navigator.clipboard.writeText(url);
    setStatus("已复制");
    window.setTimeout(() => setStatus(""), 1800);
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={copyLink}>
      {status || label}
    </Button>
  );
}
