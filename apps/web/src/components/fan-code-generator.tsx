"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type GeneratedCode = { id: string; batchId: string; code: string; expiresAt: string; maxMessages: number };

function defaultExpiry() {
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const offset = future.getTimezoneOffset() * 60_000;
  return new Date(future.getTime() - offset).toISOString().slice(0, 16);
}

export function FanCodeGenerator({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [codes, setCodes] = useState<GeneratedCode[]>([]);
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setStatus("生成中…");
    const formData = new FormData(event.currentTarget);
    const raw = String(formData.get("expiresAt") ?? "");
    try {
      const response = await fetch("/api/creator/fan-codes", {
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
        setStatus(data.error ?? "生成失败");
        return;
      }
      const generated = (data.codes ?? []) as GeneratedCode[];
      setCodes(generated);
      setStatus(`已生成 ${generated.length} 个粉丝码，纯文本仅本次展示`);
      downloadCsv(generated);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "生成失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} aria-busy={pending}>
      <label>
        生成数量
        <input name="quantity" type="number" min="1" max="500" defaultValue="5" />
      </label>
      <label>
        过期时间
        <input name="expiresAt" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} suppressHydrationWarning />
      </label>
      <label>
        单码消息上限
        <input name="maxMessages" type="number" min="1" defaultValue="20" />
      </label>
      <label>
        设备绑定
        <select name="bindMode" defaultValue="browserDevice">
          <option value="browserDevice">绑定首个浏览器设备</option>
          <option value="none">不绑定</option>
        </select>
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "生成中…" : "生成并导出 CSV"}
      </button>
      {status ? <p aria-live="polite">{status}</p> : null}
      {codes.length ? (
        <textarea readOnly rows={Math.min(codes.length, 8)} value={codes.map((c) => c.code).join("\n")} aria-label="本次生成的粉丝码" />
      ) : null}
    </form>
  );
}

function downloadCsv(codes: GeneratedCode[]) {
  if (!codes.length) return;
  const rows = [
    ["id", "batchId", "code", "expiresAt", "maxMessages"],
    ...codes.map((c) => [c.id, c.batchId, c.code, c.expiresAt, String(c.maxMessages)]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `fan-codes-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
