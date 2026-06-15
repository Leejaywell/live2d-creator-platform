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
};

export function TriggerTagTester({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<TriggerTagTestResult | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("测试中…");
    setResult(null);

    const formData = new FormData(event.currentTarget);
    const response = await fetch(`/api/creator/projects/${projectId}/tags/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData)),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.error ?? "标签测试失败");
      return;
    }

    setResult(data as TriggerTagTestResult);
    setStatus("测试完成");
  }

  return (
    <form onSubmit={submit}>
      <label>
        示例消息
        <textarea name="message" required />
      </label>
      <button type="submit">测试触发标签</button>
      {status ? <p aria-live="polite">{status}</p> : null}
      {result ? (
        <div>
          <strong>回复</strong>
          <p>{result.reply}</p>
          <strong>命中标签</strong>
          <p>{result.tags.join("、") || "无"}</p>
          <strong>Live2D 效果</strong>
          <p>{result.live2dEffects.flatMap((effect) => effect.params.map((param) => `${effect.tag}:${param.id}=${param.value}`)).join(", ") || "无"}</p>
        </div>
      ) : null}
    </form>
  );
}
