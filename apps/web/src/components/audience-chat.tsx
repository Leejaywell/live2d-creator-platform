"use client";

import { FormEvent, useState } from "react";

import { type Live2DEffect, Live2DViewer } from "@/components/live2d-viewer";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  tags?: string[];
};

type TriggeredVoiceAsset = {
  id: string;
  name: string;
  url: string;
  tag: string;
};

export function AudienceChat({
  projectSlug,
  welcomeMessage,
  hasLive2DModel,
}: {
  projectSlug: string;
  welcomeMessage: string;
  hasLive2DModel: boolean;
}) {
  const [code, setCode] = useState("");
  const [viewerSessionId, setViewerSessionId] = useState("");
  const [message, setMessage] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [activeEffects, setActiveEffects] = useState<Live2DEffect[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: welcomeMessage, tags: [] }]);

  async function validateCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Validating code...");
    const response = await fetch("/api/fan-codes/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectSlug, code, browserDeviceId: getOrCreateDeviceId() }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error ?? "Access denied");
      return;
    }
    setViewerSessionId(data.viewerSessionId);
    setRemaining(data.remainingMessages);
    setStatus("Access granted");
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!viewerSessionId || !message.trim()) return;

    const userMessage: ChatMessage = { role: "user", content: message.trim() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setMessage("");
    setStatus("Thinking...");

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        viewerSessionId,
        message: userMessage.content,
        recentMessages: nextMessages.slice(-10).map(({ role, content }) => ({ role, content })),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error ?? "Chat failed");
      return;
    }

    setMessages((current) => [...current, { role: "assistant", content: data.reply, tags: data.tags }]);
    setActiveTags(data.tags ?? []);
    setActiveEffects((data.live2dEffects ?? []) as Live2DEffect[]);
    if (typeof data.remainingMessages === "number") {
      setRemaining(data.remainingMessages);
    } else {
      setRemaining((current) => (typeof current === "number" ? Math.max(0, current - 1) : current));
    }
    const voiceAssets = (data.voiceAssets ?? []) as TriggeredVoiceAsset[];
    playTriggeredVoices(voiceAssets);
    setStatus(voiceAssets.length ? `Triggered: ${data.tags.join(", ")} · playing ${voiceAssets.length} voice clip(s)` : data.tags?.length ? `Triggered: ${data.tags.join(", ")}` : "Reply received");
  }

  return (
    <section data-testid="audience-chat">
      {viewerSessionId && hasLive2DModel ? <Live2DViewer projectSlug={projectSlug} viewerSessionId={viewerSessionId} activeTags={activeTags} activeEffects={activeEffects} /> : null}

      {!viewerSessionId ? (
        <form onSubmit={validateCode} data-testid="fan-code-form">
          <label>
            Fan access code
            <input data-testid="fan-code-input" value={code} onChange={(event) => setCode(event.target.value)} placeholder="L2D-XXXX-XXXX-XX" />
          </label>
          <button data-testid="fan-code-submit" type="submit">
            Enter
          </button>
        </form>
      ) : (
        <form onSubmit={sendMessage} data-testid="chat-form">
          <label>
            Message
            <input data-testid="chat-message-input" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Say something..." />
          </label>
          <button data-testid="chat-submit" type="submit">Send</button>
        </form>
      )}

      <div>
        <strong data-testid="remaining-messages">{remaining === null ? "No active session" : `${remaining} messages remaining`}</strong>
        {status ? <p data-testid="audience-status" aria-live="polite">{status}</p> : null}
      </div>

      <ol data-testid="chat-transcript">
        {messages.map((item, index) => (
          <li key={`${item.role}-${index}`}>
            <strong>{item.role}</strong>
            <span>{item.tags?.length ? ` [${item.tags.join(", ")}] ` : " "}</span>
            {item.content}
          </li>
        ))}
      </ol>
    </section>
  );
}

function playTriggeredVoices(voiceAssets: TriggeredVoiceAsset[]) {
  voiceAssets.slice(0, 3).forEach((voice, index) => {
    window.setTimeout(() => {
      const audio = new Audio(voice.url);
      audio.preload = "auto";
      audio.play().catch(() => undefined);
    }, index * 180);
  });
}

function getOrCreateDeviceId() {
  if (typeof window === "undefined") return "";
  let saved = window.localStorage.getItem("live2d-device-id");
  if (!saved) {
    saved = crypto.randomUUID();
    window.localStorage.setItem("live2d-device-id", saved);
  }
  return saved;
}
