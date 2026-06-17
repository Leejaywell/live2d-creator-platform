"use client";

import Link from "next/link";
import { type CSSProperties, type FormEvent, useEffect, useRef, useState } from "react";

import { type Live2DEffect, Live2DViewer } from "@/components/live2d-viewer";

import styles from "./audience-chat.module.css";

type ChatMessage = { role: "user" | "assistant"; content: string; tags?: string[]; failed?: boolean };
type AccessNotice = { tone: "warn" | "bad"; title: string; detail: string };
type Notice = AccessNotice | null;

type Props = {
  projectSlug: string;
  projectName: string;
  intro: string;
  theme: string;
  avatarUrl: string | null;
  backgroundUrl: string | null;
  welcomeMessage: string;
  hasLive2DModel: boolean;
  tagNames: string[];
  initialViewerSessionId?: string;
};

function deviceId() {
  if (typeof window === "undefined") return "";
  let saved = window.localStorage.getItem("backstage-device-id");
  if (!saved) {
    saved = crypto.randomUUID();
    window.localStorage.setItem("backstage-device-id", saved);
  }
  return saved;
}

function describeAccessError(message: string): AccessNotice {
  const lower = message.toLowerCase();
  if (lower.includes("another device") || lower.includes("bound"))
    return { tone: "bad", title: "粉丝码已绑定其他设备", detail: "请向主播申请重置设备绑定或换发新码。" };
  if (lower.includes("expired") || lower.includes("revoked"))
    return { tone: "bad", title: "粉丝码已过期或被撤销", detail: "向主播要一个新的访问码吧。" };
  if (lower.includes("quota") || lower.includes("exhausted"))
    return { tone: "warn", title: "消息配额已用完", detail: "这个码的聊天次数已用完。" };
  if (lower.includes("not published") || lower.includes("project"))
    return { tone: "warn", title: "角色暂未开放", detail: "主播还没有发布这位角色，或暂停了访问。" };
  return { tone: "bad", title: "进场失败", detail: message };
}

export function AudienceChat({
  projectSlug,
  projectName,
  theme,
  avatarUrl,
  backgroundUrl,
  welcomeMessage,
  hasLive2DModel,
  initialViewerSessionId,
}: Props) {
  const [code, setCode] = useState("");
  const [viewerSessionId, setViewerSessionId] = useState(initialViewerSessionId ?? "");
  const [message, setMessage] = useState("");
  const [remaining, setRemaining] = useState<number | null>(initialViewerSessionId ? 9999 : null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [activeEffects, setActiveEffects] = useState<Live2DEffect[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: welcomeMessage }]);
  const transcriptRef = useRef<HTMLOListElement>(null);
  const replyRef = useRef("");

  const unlocked = Boolean(viewerSessionId);
  const quotaExhausted = unlocked && remaining === 0;
  const exprReadout = activeEffects[0];

  useEffect(() => {
    const node = transcriptRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, pending]);

  async function onValidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !code.trim()) return;
    setPending(true);
    setNotice(null);
    try {
      const response = await fetch("/api/fan-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectSlug, code: code.trim(), browserDeviceId: deviceId() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(describeAccessError(data.error ?? "Access denied"));
        return;
      }
      setViewerSessionId(data.viewerSessionId);
      setRemaining(data.remainingMessages);
    } finally {
      setPending(false);
    }
  }

  async function send(content: string, isRetry = false) {
    if (pending) return;
    setPending(true);
    setNotice(null);

    setMessages((current) => {
      if (isRetry) {
        return current.map((m) => (m.role === "user" && m.content === content ? { ...m, failed: false } : m));
      }
      return [...current, { role: "user", content }];
    });
    if (!isRetry) setMessage("");

    const recent = [...messages, { role: "user" as const, content }].slice(-10).map((m) => ({ role: m.role, content: m.content }));
    replyRef.current = "";
    let assistantInserted = false;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewerSessionId, message: content, recentMessages: recent }),
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        const next = describeAccessError(data.error ?? "Chat failed");
        setNotice(next);
        if (next.tone === "bad") setViewerSessionId("");
        setMessages((current) => current.map((m) => (m.role === "user" && m.content === content ? { ...m, failed: true } : m)));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const payloadStr = trimmed.slice(6);
          if (payloadStr === "[DONE]") continue;
          const payload = JSON.parse(payloadStr);
          if (payload.type === "content") {
            replyRef.current += payload.content;
            setMessages((current) => {
              const next = [...current];
              if (assistantInserted && next[next.length - 1]?.role === "assistant") {
                next[next.length - 1] = { ...next[next.length - 1], content: replyRef.current };
              } else {
                next.push({ role: "assistant", content: replyRef.current });
                assistantInserted = true;
              }
              return next;
            });
          } else if (payload.type === "done") {
            const tags: string[] = payload.tags ?? [];
            setMessages((current) => {
              const next = [...current];
              if (next[next.length - 1]?.role === "assistant") {
                next[next.length - 1] = { ...next[next.length - 1], content: payload.reply ?? replyRef.current, tags };
              } else {
                next.push({ role: "assistant", content: payload.reply ?? replyRef.current, tags });
              }
              return next;
            });
            setActiveTags(tags);
            setActiveEffects((payload.live2dEffects ?? []) as Live2DEffect[]);
            if (typeof payload.remainingMessages === "number") setRemaining(payload.remainingMessages);
          }
        }
      }
    } catch {
      setNotice({ tone: "bad", title: "发送失败", detail: "网络异常，请稍后重试。" });
      setMessages((current) => current.map((m) => (m.role === "user" && m.content === content ? { ...m, failed: true } : m)));
    } finally {
      setPending(false);
    }
  }

  function onCompose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = message.trim();
    if (content) send(content);
  }

  return (
    <section className={styles.stage} style={{ "--theme": theme } as CSSProperties} data-testid="audience-chat">
      <div className={styles.arena}>
        <div className={styles.canvas}>
          {backgroundUrl ? (
            <>
              <div className={styles.backdrop} style={{ backgroundImage: `url(${backgroundUrl})` }} aria-hidden />
              <div className={styles.backdropVeil} aria-hidden />
            </>
          ) : null}
          <div className={styles.floor} aria-hidden />

          <div className={styles.nameTag}>
            <Link
              href="/"
              className={styles.nameAvatar}
              aria-label="返回首页"
              style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
            />
            <div>
              <div className={styles.nameTitle}>{projectName}</div>
              {unlocked ? (
                <div className={styles.liveLabel}>
                  <span aria-hidden />
                  在演中
                </div>
              ) : null}
            </div>
          </div>

          {unlocked && hasLive2DModel ? (
            <div className={styles.viewerHost}>
              <Live2DViewer
                projectSlug={projectSlug}
                viewerSessionId={viewerSessionId}
                activeTags={activeTags}
                activeEffects={activeEffects}
                isSpeaking={pending}
              />
            </div>
          ) : avatarUrl ? (
            <div className={styles.placeholder}>
              <div className={styles.portrait} style={{ backgroundImage: `url(${avatarUrl})` }} role="img" aria-label={projectName} />
            </div>
          ) : (
            <div className={styles.placeholder}>
              <div className={styles.silhouette} aria-hidden>
                LIVE2D
                <br />
                模型渲染区
              </div>
            </div>
          )}

          {unlocked && (activeTags.length > 0 || pending) ? (
            <div className={styles.readouts} aria-label="实时动作">
              {activeTags.length > 0 ? (
                <div className={styles.readoutExpr}>
                  触发 #{activeTags[0]}
                  {exprReadout?.params?.[0] ? ` → ${exprReadout.params[0].id} ${exprReadout.params[0].value}` : ""}
                </div>
              ) : null}
              {pending ? (
                <div className={styles.readoutVoice}>
                  <span className={styles.voiceBars} aria-hidden>
                    <i />
                    <i />
                    <i />
                  </span>
                  语音播放中
                </div>
              ) : null}
            </div>
          ) : null}

          {!unlocked ? (
            <div className={styles.gate}>
              <div className={styles.gateCard}>
                <div className={styles.gateIcon} aria-hidden>
                  🔒
                </div>
                <h2>凭粉丝码进场</h2>
                <p>输入{projectName}发放的访问码，即可实时对话。</p>
                <form onSubmit={onValidate} data-testid="fan-code-form">
                  <input
                    data-testid="fan-code-input"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="L2D-XXXX-XXXX-XX"
                    aria-label="粉丝访问码"
                  />
                  <div className={styles.gateHints} aria-hidden>
                    <span>📱 绑定到此设备</span>
                    <span>⚡ 配额内畅聊</span>
                  </div>
                  {notice ? <p className={styles.gateError}>{notice.detail}</p> : null}
                  <button data-testid="fan-code-submit" type="submit" disabled={pending || !code.trim()}>
                    {pending ? "检票中…" : "进场 →"}
                  </button>
                </form>
              </div>
            </div>
          ) : null}

          {quotaExhausted ? (
            <div className={styles.boundary}>
              <div className={styles.boundaryIcon} aria-hidden>
                ⌛
              </div>
              <h2>额度已用完</h2>
              <p>这个访问码的聊天次数已经用完，向{projectName}申请新码或补充配额。</p>
              <Link href="/" className={styles.boundaryLink}>
                返回角色广场
              </Link>
            </div>
          ) : null}
        </div>

        <aside className={styles.dock}>
          <div className={styles.dockHead}>
            <span className={styles.dockTitle}>对话</span>
            <span className={styles.dockRemaining} data-testid="remaining-messages">
              {remaining === null ? "待检票" : `剩余 ${remaining} 条`}
            </span>
          </div>

          {notice && unlocked ? (
            <div className={`${styles.notice} ${notice.tone === "bad" ? styles.noticeBad : styles.noticeWarn}`} aria-live="polite">
              <strong>{notice.title}</strong>
              <p>{notice.detail}</p>
            </div>
          ) : null}

          <ol className={styles.transcript} ref={transcriptRef} data-testid="chat-transcript">
            {messages.map((item, index) => (
              <li className={item.role === "user" ? styles.msgUser : styles.msgAssistant} data-role={item.role} key={`${item.role}-${index}`}>
                <div className={styles.bubble}>
                  <p>{item.content}</p>
                  {item.tags?.length ? (
                    <span className={styles.bubbleTags}>
                      {item.tags.map((tag) => (
                        <span key={tag}>#{tag}</span>
                      ))}
                      🔊 已朗读
                    </span>
                  ) : null}
                  {item.failed ? (
                    <button type="button" className={styles.retry} onClick={() => send(item.content, true)} disabled={pending}>
                      ⚠️ 发送失败，点击重试
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
            {pending && unlocked ? (
              <li className={styles.typing} aria-hidden>
                <i />
                <i />
                <i />
              </li>
            ) : null}
          </ol>

          {unlocked ? (
            <form className={styles.composer} onSubmit={onCompose} data-testid="chat-form">
              <input
                data-testid="chat-message-input"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={`对${projectName}说点什么…`}
                aria-label="聊天消息"
              />
              <button
                className={styles.sendBtn}
                data-testid="chat-submit"
                type="submit"
                disabled={pending || !message.trim() || remaining === 0}
                aria-label="发送"
              >
                {remaining === 0 ? "用尽" : pending ? "…" : "→"}
              </button>
            </form>
          ) : (
            <p className={styles.composerHint}>检票通过后即可开始聊天</p>
          )}
        </aside>
      </div>
    </section>
  );
}
