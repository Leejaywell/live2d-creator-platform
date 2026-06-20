"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui";
import { AI_PROVIDER_PRESETS, aiProviderPresetById, aiProviderPresetForBaseUrl } from "@/lib/ai-providers";

import dash from "../admin.module.css";
import styles from "./ai-provider-config.module.css";

type Props = {
  initialProvider: "openai-compatible" | "disabled";
  initialBaseUrl: string;
  initialModel: string;
  apiKeySet: boolean;
};

export function AiProviderConfig({ initialProvider, initialBaseUrl, initialModel, apiKeySet }: Props) {
  const t = useTranslations("admin");
  const router = useRouter();

  const [presetId, setPresetId] = useState(aiProviderPresetForBaseUrl(initialBaseUrl)?.id ?? "custom");
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl);
  const [model, setModel] = useState(initialModel);
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(initialProvider !== "disabled");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  const cnPresets = AI_PROVIDER_PRESETS.filter((p) => p.region === "cn");
  const intlPresets = AI_PROVIDER_PRESETS.filter((p) => p.region === "intl");
  const customPresets = AI_PROVIDER_PRESETS.filter((p) => p.region === "custom");
  const currentPreset = aiProviderPresetById(presetId);
  const modelOptions = currentPreset?.models ?? [];

  // Close the model dropdown on outside click.
  useEffect(() => {
    if (!modelMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setModelMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [modelMenuOpen]);

  function onPreset(id: string) {
    setPresetId(id);
    const preset = aiProviderPresetById(id);
    if (preset && preset.region !== "custom") {
      setBaseUrl(preset.baseUrl);
      setModel(preset.models[0] ?? "");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setStatus(t("aiProvider.saving"));
    try {
      const response = await fetch("/api/admin/ai-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: enabled ? "openai-compatible" : "disabled",
          baseUrl,
          chatModel: model,
          apiKey: apiKey || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(data.error ?? t("aiProvider.failed"));
        return;
      }
      setStatus(t("aiProvider.saved"));
      setApiKey("");
      router.refresh();
    } catch {
      setStatus(t("aiProvider.failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={dash.panel}>
      <div className={dash.panelHead}>
        <h2>{t("aiProvider.title")}</h2>
      </div>
      {/* autoComplete="off" + a decoy keeps Chrome's saved-login autofill off the fields. */}
      <form className={styles.form} onSubmit={onSubmit} autoComplete="off">
        <input type="text" name="_decoy" autoComplete="off" tabIndex={-1} aria-hidden style={{ display: "none" }} />
        <p className={styles.subtitle}>{t("aiProvider.subtitle")}</p>

        <div className={styles.field}>
          <span className={styles.label}>{t("aiProvider.presetLabel")}</span>
          <select className={styles.select} value={presetId} onChange={(e) => onPreset(e.target.value)}>
            <optgroup label={t("aiProvider.groupCn")}>
              {cnPresets.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
            <optgroup label={t("aiProvider.groupIntl")}>
              {intlPresets.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
            <optgroup label={t("aiProvider.groupCustom")}>
              {customPresets.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>{t("aiProvider.baseUrlLabel")}</span>
          <input
            className={styles.input}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com/v1"
            spellCheck={false}
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>{t("aiProvider.modelLabel")}</span>
          <div ref={comboRef} className={`${styles.combo} ${modelMenuOpen ? styles.comboOpen : ""}`}>
            <input
              className={`${styles.input} ${styles.comboInput}`}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              onFocus={() => modelOptions.length > 0 && setModelMenuOpen(true)}
              placeholder={t("aiProvider.modelPlaceholder")}
              spellCheck={false}
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore
            />
            <button
              type="button"
              className={styles.comboToggle}
              aria-label={t("aiProvider.modelLabel")}
              onClick={() => setModelMenuOpen((v) => !v)}
            >
              <svg className={styles.comboCaret} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {modelMenuOpen ? (
              <div className={styles.menu}>
                {modelOptions.length > 0 ? (
                  modelOptions.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`${styles.menuItem} ${m === model ? styles.menuItemActive : ""}`}
                      onClick={() => {
                        setModel(m);
                        setModelMenuOpen(false);
                      }}
                    >
                      {m}
                    </button>
                  ))
                ) : (
                  <span className={styles.menuEmpty}>{t("aiProvider.modelPlaceholder")}</span>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>{t("aiProvider.apiKeyLabel")}</span>
          <input
            className={styles.input}
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={apiKeySet ? t("aiProvider.apiKeyPlaceholderSet") : t("aiProvider.apiKeyPlaceholderUnset")}
            autoComplete="new-password"
            data-lpignore="true"
            data-1p-ignore
            spellCheck={false}
          />
        </div>

        {currentPreset?.consoleUrl ? (
          <a href={currentPreset.consoleUrl} target="_blank" rel="noreferrer" className={styles.link}>
            {t("aiProvider.getKey")}
          </a>
        ) : null}

        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>{t("aiProvider.enableLabel")}</span>
        </label>

        <div className={styles.actions}>
          <Button type="submit" disabled={pending}>{t("aiProvider.save")}</Button>
          {status ? <span className={styles.status}>{status}</span> : null}
        </div>
      </form>
    </section>
  );
}
