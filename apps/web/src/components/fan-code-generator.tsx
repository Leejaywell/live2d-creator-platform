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
    setStatus("Submitting...");

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const response = await fetch("/api/creator/fan-codes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(Object.fromEntries(formData)),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(data.error ?? "Request failed");
        return;
      }

      const generated = (data.codes ?? []) as GeneratedCode[];
      setCodes(generated);
      setStatus(`Generated ${generated.length} codes`);
      downloadCsv(generated);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Request failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} aria-busy={pending}>
      <input type="hidden" name="projectId" value={projectId} />
      <label>
        Quantity
        <input name="quantity" type="number" min="1" max="500" defaultValue="5" />
      </label>
      <label>
        Expires at
        <input name="expiresAt" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} suppressHydrationWarning />
      </label>
      <label>
        Max messages
        <input name="maxMessages" type="number" min="1" defaultValue="20" />
      </label>
      <label>
        Bind mode
        <select name="bindMode" defaultValue="browserDevice">
          <option value="browserDevice">browserDevice</option>
          <option value="none">none</option>
        </select>
      </label>
      <button type="submit" disabled={pending}>{pending ? "Generating..." : "Generate and export CSV"}</button>
      {status ? <p aria-live="polite">{status}</p> : null}
      {codes.length ? (
        <textarea
          readOnly
          value={codes.map((item) => item.code).join("\n")}
          aria-label="Generated fan codes"
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
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

function escapeCsvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
