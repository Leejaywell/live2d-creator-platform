"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui";

type GeneratedCode = { id: string; batchId: string; code: string; expiresAt: string; maxMessages: number };

function defaultExpiry() {
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const offset = future.getTimezoneOffset() * 60_000;
  return new Date(future.getTime() - offset).toISOString().slice(0, 16);
}

export function FanCodeGenerator({
  projectId,
  onDone,
  endpoint = "/api/creator/fan-codes",
}: {
  projectId: string;
  onDone?: () => void;
  endpoint?: string;
}) {
  const t = useTranslations("fans");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setStatus(t("genGenerating"));
    const formData = new FormData(event.currentTarget);
    const raw = String(formData.get("expiresAt") ?? "");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          quantity: Number(formData.get("quantity") ?? 5),
          maxMessages: Number(formData.get("maxMessages") ?? 20),
          bindMode: String(formData.get("bindMode") ?? "browserDevice"),
          expiresAt: raw ? new Date(raw).toISOString() : undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(data.error ?? t("genFailed"));
        return;
      }
      const generated = (data.codes ?? []) as GeneratedCode[];
      setStatus(t("genSuccess", { n: generated.length }));
      router.refresh();
      onDone?.();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : t("genFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} aria-busy={pending}>
      <label>
        {t("genQuantity")}
        <input name="quantity" type="number" min="1" max="500" defaultValue="5" />
      </label>
      <label>
        {t("genExpiry")}
        <input name="expiresAt" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} suppressHydrationWarning />
      </label>
      <label>
        {t("genMaxMessages")}
        <input name="maxMessages" type="number" min="1" defaultValue="20" />
      </label>
      <label>
        {t("genBindMode")}
        <select name="bindMode" defaultValue="browserDevice">
          <option value="browserDevice">{t("genBindBrowser")}</option>
          <option value="none">{t("genBindNone")}</option>
        </select>
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? t("genGenerating") : t("genGenerate")}
      </Button>
      {status ? <p aria-live="polite">{status}</p> : null}
    </form>
  );
}
