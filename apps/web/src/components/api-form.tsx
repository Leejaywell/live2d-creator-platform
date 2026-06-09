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
    setStatus("Submitting...");

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
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
            body: JSON.stringify(Object.fromEntries(formData)),
          });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(data.error ?? "Request failed");
        return;
      }

      setStatus("Saved");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Request failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} aria-busy={pending}>
      {children}
      <button type="submit" disabled={pending}>{pending ? "Submitting..." : submitLabel}</button>
      {status ? <p aria-live="polite">{status}</p> : null}
    </form>
  );
}
