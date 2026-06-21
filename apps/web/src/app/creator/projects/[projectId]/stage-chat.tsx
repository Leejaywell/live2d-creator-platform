"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useRef, useState } from "react";

import styles from "./workspace.module.css";

type Msg = { role: "user" | "assistant"; content: string };

// Compact live chat used inside the workspace persistent preview, wired to the
// project's debug viewer session so creators can test the model + AI inline.
export function StageChat({
  viewerSessionId,
  welcomeMessage,
  onEffects,
}: {
  viewerSessionId: string;
  welcomeMessage: string;
  onEffects?: (tags: string[], effects: Array<{ tag: string; params: Array<{ id: string; value: number }> }>) => void;
}) {
  const t = useTranslations("workspace");
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: welcomeMessage }]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const replyRef = useRef("");

  function scroll() {
    requestAnimationFrame(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (!content || pending) return;
    setInput("");
    setPending(true);
    const history = [...messages, { role: "user" as const, content }];
    setMessages(history);
    scroll();
    replyRef.current = "";
    let inserted = false;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          viewerSessionId,
          message: content,
          // History excludes the current message — the server appends it itself.
          recentMessages: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok || !res.body) {
        setMessages((c) => [...c, { role: "assistant", content: t("previewChatFailed") }]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data: ")) continue;
          const payload = t.slice(6);
          if (payload === "[DONE]") continue;
          const data = JSON.parse(payload);
          if (data.type === "content") {
            replyRef.current += data.content;
            setMessages((c) => {
              const next = [...c];
              if (inserted && next[next.length - 1]?.role === "assistant") {
                next[next.length - 1] = { role: "assistant", content: replyRef.current };
              } else {
                next.push({ role: "assistant", content: replyRef.current });
                inserted = true;
              }
              return next;
            });
            scroll();
          } else if (data.type === "done") {
            onEffects?.(data.tags ?? [], data.live2dEffects ?? []);
          }
        }
      }
    } catch {
      setMessages((c) => [...c, { role: "assistant", content: t("networkError") }]);
    } finally {
      setPending(false);
      scroll();
    }
  }

  return (
    <div className={styles.stageChat}>
      <div className={styles.stageChatLog} ref={logRef}>
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? styles.stageMsgUser : styles.stageMsgAi}>
            {m.content}
          </div>
        ))}
      </div>
      <form className={styles.stageComposer} onSubmit={onSubmit}>
        <input
          className={styles.stageInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("stageChatPlaceholder")}
          aria-label={t("previewChat")}
        />
        <button className={styles.stageSend} type="submit" disabled={pending || !input.trim()} aria-label={t("send")}>
          {pending ? "…" : "→"}
        </button>
      </form>
    </div>
  );
}
