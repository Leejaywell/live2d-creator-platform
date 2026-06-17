"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";

type ApiFormProps = {
  action: string;
  method?: "POST" | "PATCH" | "DELETE";
  submitLabel: string;
  children?: ReactNode;
};

// Generic progressive form: serializes fields to JSON (or multipart when a file
// input is present), surfaces status text, and refreshes server data on success.
export function ApiForm({ action, method = "POST", submitLabel, children }: ApiFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setStatus("提交中…");

    const form = event.currentTarget;
    const formData = new FormData(form);
    form.querySelectorAll<HTMLInputElement>('input[type="datetime-local"][name]').forEach((input) => {
      if (input.value) formData.set(input.name, new Date(input.value).toISOString());
    });
    const hasFile = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="file"]')).some(
      (input) => input.files && input.files.length > 0,
    );

    try {
      const response = hasFile
        ? await fetch(action, { method, body: formData })
        : await fetch(action, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(toJson(formData)),
          });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(data.error ?? "请求失败");
        return;
      }
      setStatus("已保存");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "请求失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} aria-busy={pending}>
      {children}
      <button type="submit" disabled={pending}>
        {pending ? "提交中…" : submitLabel}
      </button>
      {status ? <p aria-live="polite">{status}</p> : null}
    </form>
  );
}

function toJson(formData: FormData) {
  const out: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
  formData.forEach((value, key) => {
    const existing = out[key];
    if (existing === undefined) out[key] = value;
    else out[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
  });
  return out;
}
