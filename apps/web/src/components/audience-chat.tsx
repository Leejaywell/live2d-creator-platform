"use client";

import Link from "next/link";
import { CSSProperties, FormEvent, useEffect, useRef, useState } from "react";

import { type Live2DEffect, Live2DViewer } from "@/components/live2d-viewer";

import styles from "./stage.module.css";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  tags?: string[];
  failed?: boolean;
};

type AudienceNotice = {
  tone: "neutral" | "good" | "warn" | "bad";
  title: string;
  detail: string;
};

export function AudienceChat({
  projectSlug,
  projectName,
  intro,
  theme,
  avatarUrl,
  backgroundUrl,
  welcomeMessage,
  hasLive2DModel,
  tagNames,
  initialViewerSessionId,
}: {
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
}) {
  const [code, setCode] = useState("");
  const [viewerSessionId, setViewerSessionId] = useState(initialViewerSessionId ?? "");
  const [message, setMessage] = useState("");
  const [remaining, setRemaining] = useState<number | null>(initialViewerSessionId ? 9999 : null);
  const [notice, setNotice] = useState<AudienceNotice>(
    initialViewerSessionId
      ? { tone: "good", title: "调试预览模式", detail: "调试模式已启动，你可以无需粉丝码直接测试聊天与动作效果。" }
      : {
          tone: "warn",
          title: "需要粉丝码",
          detail: "输入主播分享给你的访问码,解锁这位角色。",
        }
  );
  const [pending, setPending] = useState(false);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [activeEffects, setActiveEffects] = useState<Live2DEffect[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: welcomeMessage, tags: [] }]);
  const transcriptRef = useRef<HTMLOListElement>(null);
  const replyTextRef = useRef("");

  const [isOffline, setIsOffline] = useState(typeof window !== "undefined" ? !window.navigator.onLine : false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) {
      transcript.scrollTop = transcript.scrollHeight;
    }
  }, [messages, pending]);

  async function validateCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !code.trim()) return;
    setPending(true);
    setNotice({ tone: "neutral", title: "正在检票", detail: "校验粉丝码与当前浏览器设备。" });
    try {
      const response = await fetch("/api/fan-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectSlug, code: code.trim(), browserDeviceId: getOrCreateDeviceId() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setNotice(accessNotice(data.error ?? "Access denied"));
        return;
      }
      setViewerSessionId(data.viewerSessionId);
      setRemaining(data.remainingMessages);
      setNotice({ tone: "good", title: "进场成功", detail: "在剩余配额内畅聊,命中的标签会触发表情。" });
    } finally {
      setPending(false);
    }
  }

  async function submitMessage(content: string, isRetry = false) {
    if (pending) return;

    if (isOffline) {
      let nextMessages = [...messages];
      if (!isRetry) {
        nextMessages = [...messages, { role: "user", content }];
      }
      setMessages(
        nextMessages.map((msg) =>
          msg.role === "user" && msg.content === content ? { ...msg, failed: true } : msg
        )
      );
      if (!isRetry) setMessage("");
      setPending(false);
      setNotice({
        tone: "bad",
        title: "已离线",
        detail: "当前处于离线状态，发送的消息将缓存并允许点击重试。",
      });
      return;
    }

    setPending(true);
    let nextMessages = [...messages];
    if (isRetry) {
      nextMessages = nextMessages.map((msg) =>
        msg.role === "user" && msg.content === content ? { ...msg, failed: false } : msg
      );
      setMessages(nextMessages);
    } else {
      nextMessages = [...messages, { role: "user", content }];
      setMessages(nextMessages);
      setMessage("");
    }

    setNotice({ tone: "neutral", title: "对方正在输入…", detail: "角色正在准备回应。" });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          viewerSessionId,
          message: content,
          recentMessages: nextMessages.slice(-10).map(({ role, content: c }) => ({ role, content: c })),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const nextNotice = accessNotice(data.error ?? "Chat failed");
        setNotice(nextNotice);
        if (nextNotice.tone === "bad" || /expired|revoked/i.test(nextNotice.detail)) {
          setViewerSessionId("");
        }

        setMessages((current) =>
          current.map((msg) =>
            msg.role === "user" && msg.content === content ? { ...msg, failed: true } : msg
          )
        );
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body reader");
      }

      const decoder = new TextDecoder("utf-8");
      replyTextRef.current = "";

      // Pre-insert an empty assistant message which we'll update in-place
      setMessages((current) => [...current, { role: "assistant", content: "" }]);

      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith("data: ")) {
            const dataStr = trimmed.slice(6);
            if (dataStr === "[DONE]") {
              break;
            }
            try {
              const payload = JSON.parse(dataStr);
              if (payload.type === "content") {
                replyTextRef.current += payload.content;
                setMessages((current) => {
                  const next = [...current];
                  if (next.length > 0 && next[next.length - 1].role === "assistant") {
                    next[next.length - 1] = {
                      ...next[next.length - 1],
                      content: replyTextRef.current,
                    };
                  }
                  return next;
                });
              } else if (payload.type === "done") {
                const tags = payload.tags ?? [];
                const live2dEffects = (payload.live2dEffects ?? []) as Live2DEffect[];

                setMessages((current) => {
                  const next = [...current];
                  if (next.length > 0 && next[next.length - 1].role === "assistant") {
                    next[next.length - 1] = {
                      ...next[next.length - 1],
                      content: replyTextRef.current,
                      tags,
                    };
                  }
                  return next;
                });

                setActiveTags(tags);
                setActiveEffects(live2dEffects);
                if (typeof payload.remainingMessages === "number") {
                  setRemaining(payload.remainingMessages);
                }
                setNotice({
                  tone: "good",
                  title: "已收到回复",
                  detail: tags.length
                      ? `触发了 ${tags.join("、")}。`
                      : "本次回复没有命中触发标签。",
                });
              }
            } catch (err) {
              console.error("Error parsing stream payload", err);
            }
          }
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error(err);

      const isTimeout = err instanceof Error && err.name === "AbortError";
      setNotice({
        tone: "bad",
        title: isTimeout ? "请求超时" : "发送失败",
        detail: isTimeout ? "AI 响应超时(15秒),请重试。" : "网络连接失败,请检查网络后重试。",
      });

      setMessages((current) => {
        const next = [...current];
        if (next.length > 0 && next[next.length - 1].role === "assistant" && next[next.length - 1].content === "") {
          next.pop();
        }
        return next.map((msg) =>
          msg.role === "user" && msg.content === content ? { ...msg, failed: true } : msg
        );
      });
    } finally {
      setPending(false);
    }
  }

  const handleComposerSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = message.trim();
    if (!content) return;
    submitMessage(content);
  }

  const unlocked = Boolean(viewerSessionId);

  return (
    <section className={styles.stage} style={{ "--theme": theme } as CSSProperties} data-testid="audience-chat">
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/">
          ← Live2D Creator
        </Link>
        <div className={styles.title}>
          <h1>{projectName}</h1>
          {intro ? <p>{intro}</p> : null}
        </div>
        <div className={styles.access}>
          <strong className={styles.remaining} data-testid="remaining-messages">
            {remaining === null ? "未检票" : `剩余 ${remaining} 条 · ${remaining} messages remaining`}
          </strong>
          <span className={unlocked ? `${styles.pill} ${styles.pillOn}` : `${styles.pill} ${styles.pillWait}`}>
            {unlocked ? "进场中" : "待检票"}
          </span>
        </div>
      </header>

      <div className={styles.arena}>
        <div className={backgroundUrl ? `${styles.canvasZone} ${styles.canvasZoneCustom}` : styles.canvasZone}>
          {backgroundUrl ? (
            <>
              <div className={styles.customBackdrop} style={{ backgroundImage: `url(${backgroundUrl})` }} aria-hidden />
              <div className={styles.backdropVeil} aria-hidden />
            </>
          ) : null}
          <div className={styles.floor} aria-hidden />
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
          ) : (
            <div className={styles.placeholder}>
              {avatarUrl ? (
                <div className={styles.portrait} style={{ backgroundImage: `url(${avatarUrl})` }} role="img" aria-label={`${projectName} 头像`} />
              ) : (
                <div className={styles.silhouette} aria-hidden />
              )}
              <strong>{projectName}</strong>
              <span>{hasLive2DModel ? "检票后,角色会在聚光灯下登场。" : "模型还在准备中,聊天不受影响。"}</span>
            </div>
          )}
          {activeTags.length ? (
            <div className={styles.activeTagRibbon} aria-label="已触发的标签">
              {activeTags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          ) : null}

          {!unlocked ? (
            <div className={styles.gate}>
              <div className={styles.gateCard}>
                <p className={styles.gateKicker}>STAGE PASS</p>
                <h2>凭粉丝码进场</h2>
                <p>访问码由主播发放,可能绑定首个使用的浏览器设备。</p>
                <form onSubmit={validateCode} data-testid="fan-code-form">
                  <input
                    data-testid="fan-code-input"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="L2D-XXXX-XXXX-XX"
                    aria-label="粉丝访问码"
                  />
                  <button data-testid="fan-code-submit" type="submit" disabled={pending || !code.trim()}>
                    {pending ? "检票中…" : "进场"}
                  </button>
                </form>
              </div>
            </div>
          ) : null}
        </div>

        <aside className={styles.dock}>
          <div className={styles.dockHead}>
            <AudienceStatusNotice
              notice={
                isOffline
                  ? { tone: "warn", title: "网络连接已断开", detail: "当前处于离线状态，发送的消息将尝试缓存或重试。" }
                  : notice
              }
            />
            {tagNames.length ? (
              <div className={styles.tagChips} aria-label="可触发的标签">
                {tagNames.map((name) => (
                  <span key={name}>{name}</span>
                ))}
              </div>
            ) : null}
          </div>

          <ol className={styles.transcript} ref={transcriptRef} data-testid="chat-transcript">
            {messages.map((item, index) => (
              <li className={item.role === "user" ? styles.msgUser : styles.msgAssistant} data-role={item.role} key={`${item.role}-${index}`}>
                <div className={styles.bubble}>
                  <strong>{item.role === "user" ? "你" : projectName}</strong>
                  <p>{item.content}</p>
                  {item.tags?.length ? (
                    <span className={styles.bubbleTags}>
                      {item.tags.map((tag) => (
                        <small key={tag}>{tag}</small>
                      ))}
                    </span>
                  ) : null}
                  {item.failed ? (
                    <button
                      type="button"
                      className={styles.retryBtn}
                      onClick={() => submitMessage(item.content, true)}
                      disabled={pending}
                    >
                      ⚠️ 发送失败，点击重试
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
            {pending && unlocked ? (
              <li className={styles.msgAssistant} aria-hidden>
                <span className={styles.typing}>
                  <i />
                  <i />
                  <i />
                </span>
              </li>
            ) : null}
          </ol>

          {unlocked ? (
            <form className={styles.composer} onSubmit={handleComposerSubmit} data-testid="chat-form">
              <input
                data-testid="chat-message-input"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="说点什么…"
                aria-label="聊天消息"
              />
              <button data-testid="chat-submit" type="submit" disabled={pending || !message.trim() || remaining === 0}>
                {remaining === 0 ? "配额用尽" : pending ? "发送中…" : "发送"}
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

function AudienceStatusNotice({ notice }: { notice: AudienceNotice }) {
  const toneClass =
    notice.tone === "good"
      ? styles.noticeGood
      : notice.tone === "bad"
        ? styles.noticeBad
        : notice.tone === "warn"
          ? styles.noticeWarn
          : "";

  return (
    <div className={`${styles.notice} ${toneClass}`} data-testid="audience-status" aria-live="polite">
      <strong>{notice.title}</strong>
      <p>{notice.detail}</p>
    </div>
  );
}

function accessNotice(message: string): AudienceNotice {
  const normalized = message.toLowerCase();
  if (normalized.includes("another device") || normalized.includes("bound")) {
    return {
      tone: "bad",
      title: "粉丝码已绑定其他设备",
      detail: "这个访问码已经绑定在另一台浏览器上。请主播重置设备绑定,或为你发新码。",
    };
  }
  if (normalized.includes("expired") || normalized.includes("revoked")) {
    return {
      tone: "bad",
      title: "粉丝码已过期或被撤销",
      detail: "这个码已经无法进场了,向主播要一个新的访问码吧。(expired/revoked)",
    };
  }
  if (normalized.includes("quota") || normalized.includes("exhausted")) {
    return {
      tone: "warn",
      title: "消息配额已用完",
      detail: "这个码的聊天次数已经用完。向主播申请新码或补充配额。",
    };
  }
  if (normalized.includes("not published") || normalized.includes("project")) {
    return {
      tone: "warn",
      title: "角色暂未开放",
      detail: "主播还没有发布这位角色,或暂停了访问。",
    };
  }
  return {
    tone: "bad",
    title: "进场失败",
    detail: message,
  };
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
