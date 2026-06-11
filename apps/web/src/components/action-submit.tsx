"use client";

import { useFormStatus } from "react-dom";

// Submit button for a Server Action <form>, showing pending state via
// useFormStatus (must live inside the form it submits).
export function ActionSubmit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "处理中…" : children}
    </button>
  );
}
