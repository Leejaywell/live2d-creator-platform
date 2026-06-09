"use client";

import { FormEvent, useState } from "react";

type TriggerTagTestResult = {
  reply: string;
  tags: string[];
  tokenEstimate: number;
  live2dEffects: Array<{
    tag: string;
    params: Array<{ id: string; value: number }>;
  }>;
  voiceAssets: Array<{
    id: string;
    name: string;
    tag: string;
  }>;
};

export function TriggerTagTester({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<TriggerTagTestResult | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Testing...");
    setResult(null);

    const formData = new FormData(event.currentTarget);
    const response = await fetch(`/api/creator/projects/${projectId}/tags/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.error ?? "Trigger test failed");
      return;
    }

    setResult(data as TriggerTagTestResult);
    setStatus("Test complete");
  }

  return (
    <form onSubmit={submit}>
      <label>
        Sample message
        <textarea name="message" required />
      </label>
      <button type="submit">Test trigger tags</button>
      {status ? <p aria-live="polite">{status}</p> : null}
      {result ? (
        <div>
          <strong>Reply</strong>
          <p>{result.reply}</p>
          <strong>Triggered tags</strong>
          <p>{result.tags.join(", ") || "none"}</p>
          <strong>Live2D effects</strong>
          <p>{result.live2dEffects.flatMap((effect) => effect.params.map((param) => `${effect.tag}:${param.id}=${param.value}`)).join(", ") || "none"}</p>
          <strong>Voice assets</strong>
          <p>{result.voiceAssets.map((voice) => `${voice.tag}:${voice.name}`).join(", ") || "none"}</p>
        </div>
      ) : null}
    </form>
  );
}
