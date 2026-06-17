"use client";

import { FormEvent, ReactNode, useState } from "react";
import { useRouter } from "next/navigation";

type ApiFormProps = {
  action: string;
  method?: "POST" | "PATCH" | "DELETE";
  children: ReactNode;
  submitLabel: string;
};

export function ApiForm({ action, method = "POST", children, submitLabel }: ApiFormProps) {
  const [status, setStatus] = useState<string>("");
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
      normalizeDateTimeLocalFields(form, formData);
      const hasFile = Array.from(form.querySelectorAll('input[type="file"]')).some((input) => input instanceof HTMLInputElement && input.files && input.files.length > 0);
      const response = hasFile
        ? await fetch(action, {
            method,
            body: formData,
          })
        : await fetch(action, {
            method,
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(formDataToJson(formData)),
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
    <form onSubmit={submit} aria-busy={pending}>
      {children}
      <button type="submit" disabled={pending}>{pending ? "提交中…" : submitLabel}</button>
      {status ? <p aria-live="polite">{status}</p> : null}
    </form>
  );
}

function normalizeDateTimeLocalFields(form: HTMLFormElement, formData: FormData) {
  form.querySelectorAll('input[type="datetime-local"][name]').forEach((input) => {
    if (!(input instanceof HTMLInputElement) || !input.value) return;
    formData.set(input.name, new Date(input.value).toISOString());
  });
}

function formDataToJson(formData: FormData) {
  const body: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
  formData.forEach((value, key) => {
    const existing = body[key];
    if (existing === undefined) {
      body[key] = value;
      return;
    }
    body[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
  });
  return body;
}
