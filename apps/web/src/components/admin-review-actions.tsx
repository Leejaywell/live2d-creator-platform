"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import dash from "@/app/creator/creator.module.css";

type Status = "draft" | "published" | "paused";

// Bare buttons (no wrapper) so they sit directly in the page's .rowActions
// cluster and share its uniform text-link styling (approve = green, destructive = red).
export function AdminReviewActions({ projectId, status }: { projectId: string; status: Status }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function setStatus(next: Status) {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (response.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  // Publishing is self-service; admins only moderate public models.
  return (
    <>
      {status === "paused" ? (
        <button type="button" className={dash.approve} onClick={() => setStatus("published")} disabled={pending}>
          {t("actionRestore")}
        </button>
      ) : null}
      {status === "published" ? (
        <button type="button" className={dash.danger} onClick={() => setStatus("paused")} disabled={pending}>
          {t("actionTakedown")}
        </button>
      ) : null}
    </>
  );
}
