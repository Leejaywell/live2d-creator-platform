"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import dash from "@/app/creator/creator.module.css";

type Status = "draft" | "published" | "paused";

// Bare buttons (no wrapper) so they sit directly in the page's .rowActions
// cluster and share its uniform text-link styling (approve = green, destructive = red).
export function AdminReviewActions({ projectId, status }: { projectId: string; status: Status }) {
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

  return (
    <>
      {status !== "published" ? (
        <button type="button" className={dash.approve} onClick={() => setStatus("published")} disabled={pending}>
          {status === "draft" ? "通过" : "恢复"}
        </button>
      ) : null}
      {status === "draft" ? (
        <button type="button" className={dash.danger} onClick={() => setStatus("paused")} disabled={pending}>
          驳回
        </button>
      ) : null}
      {status === "published" ? (
        <button type="button" className={dash.danger} onClick={() => setStatus("paused")} disabled={pending}>
          下架
        </button>
      ) : null}
    </>
  );
}
