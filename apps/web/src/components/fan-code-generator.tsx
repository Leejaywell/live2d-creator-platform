"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type FanCodeGeneratorProps = {
  projectId: string;
};

type GeneratedCode = {
  id: string;
  batchId: string;
  code: string;
  expiresAt: string;
  maxMessages: number;
};

export function FanCodeGenerator({ projectId }: FanCodeGeneratorProps) {
  const [status, setStatus] = useState("");
  const [codes, setCodes] = useState<GeneratedCode[]>([]);
  const [expiresAt, setExpiresAt] = useState(defaultFanCodeExpiry);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setStatus("提交中…");

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const rawExpiresAt = String(formData.get("expiresAt") ?? "");
      if (rawExpiresAt) {
        formData.set("expiresAt", new Date(rawExpiresAt).toISOString());
      }
      const response = await fetch("/api/creator/fan-codes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(Object.fromEntries(formData)),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(data.error ?? "请求失败");
        return;
      }

      const generated = (data.codes ?? []) as GeneratedCode[];
      setCodes(generated);
      setStatus(`已生成 ${generated.length} 个粉丝码,纯文本仅本次展示`);
      downloadCsv(generated);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "请求失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} aria-busy={pending}>
      <input type="hidden" name="projectId" value={projectId} />
      <label>
        生成数量
        <input name="quantity" type="number" min="1" max="500" defaultValue="5" />
      </label>
      <label>
        过期时间
        <input name="expiresAt" type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} suppressHydrationWarning />
      </label>
      <label>
        单码消息上限
        <input name="maxMessages" type="number" min="1" defaultValue="20" />
      </label>
      <label>
        设备绑定
        <select name="bindMode" defaultValue="browserDevice">
          <option value="browserDevice">绑定首个浏览器(browserDevice)</option>
          <option value="none">不绑定(none)</option>
        </select>
      </label>
      <button type="submit" disabled={pending}>{pending ? "生成中…" : "生成并导出 CSV"}</button>
      {status ? <p aria-live="polite">{status}</p> : null}
      {codes.length ? (
        <textarea
          readOnly
          value={codes.map((item) => item.code).join("\n")}
          aria-label="本次生成的粉丝码"
        />
      ) : null}
    </form>
  );
}

function downloadCsv(codes: GeneratedCode[]) {
  if (!codes.length) return;

  const rows = [
    ["id", "batchId", "code", "expiresAt", "maxMessages"],
    ...codes.map((item) => [item.id, item.batchId, item.code, item.expiresAt, String(item.maxMessages)]),
  ];
  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `fan-codes-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function defaultFanCodeExpiry() {
  return toDateTimeLocalValue(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
}

function escapeCsvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function toDateTimeLocalValue(value: Date) {
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}
