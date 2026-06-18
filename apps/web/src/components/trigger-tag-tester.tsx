"use client";

import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui";

type TestResult = {
  reply: string;
  tags: string[];
  tokenEstimate: number;
  live2dEffects: Array<{ tag: string; params: Array<{ id: string; value: number }> }>;
};

export function TriggerTagTester({ projectId }: { projectId: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !message.trim()) return;
    setPending(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch(`/api/creator/projects/${projectId}/tags/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "测试失败");
        return;
      }
      setResult(data as TestResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "测试失败");
    } finally {
      setPending(false);
    }
  }

  const effectText = result?.live2dEffects
    .flatMap((effect) => effect.params.map((param) => `${param.id} ${param.value}`))
    .join(" · ");

  return (
    <form onSubmit={onSubmit}>
      <label>
        示例消息
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="你今天好可爱呀，我好喜欢你"
          required
        />
      </label>
      <Button type="submit" disabled={pending || !message.trim()}>
        {pending ? "测试中…" : "测试"}
      </Button>
      {error ? <p aria-live="polite">{error}</p> : null}
      {result ? (
        <p aria-live="polite">
          命中：{result.tags.length ? result.tags.map((tag) => `#${tag}`).join(" ") : "无"}
          {effectText ? ` → ${effectText}` : ""}
        </p>
      ) : null}
    </form>
  );
}
