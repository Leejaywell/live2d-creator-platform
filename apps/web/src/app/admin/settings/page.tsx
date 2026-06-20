import { getTranslations } from "next-intl/server";

import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { Pill } from "@/components/ui";
import { isAdminRole } from "@/lib/permissions";
import { listPlatformSettings, type PlatformSettingView } from "@/lib/platform-settings";

import { AdminAuthRequired, AdminShell, dash } from "../_components";
import { AiProviderConfig } from "./ai-provider-config";

export const dynamic = "force-dynamic";

function SettingValueField({ setting }: { setting: PlatformSettingView }) {
  const value = String(setting.value);
  if (setting.valueType === "enum") {
    return (
      <select name="value" defaultValue={value}>
        {setting.options?.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  if (setting.valueType === "boolean") {
    return (
      <select name="value" defaultValue={value}>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  if (setting.valueType === "number") {
    return <input name="value" type="number" min="1" max="10000" defaultValue={value} />;
  }
  return <input name="value" defaultValue={value} />;
}

export default async function AdminSettingsPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || !isAdminRole(session.user.role)) {
    return <AdminAuthRequired />;
  }

  const t = await getTranslations("admin");
  const settings = await listPlatformSettings();

  // The AI connection (provider / base URL / API key / model) is handled by the
  // dedicated card below; everything else renders in the generic table. The API
  // key value is never sent to the client — only whether one is configured.
  const find = (key: string) => settings.find((s) => s.key === key);
  const aiProvider = String(find("ai.provider")?.value ?? "openai-compatible") === "disabled" ? "disabled" : "openai-compatible";
  const aiBaseUrl = String(find("ai.baseUrl")?.value ?? "");
  const aiModel = String(find("ai.chatModel")?.value ?? "");
  const aiApiKeySet = find("ai.apiKey")?.source === "database";
  const genericSettings = settings.filter((s) => !s.key.startsWith("ai."));

  // Maps each setting key to its i18n id under admin.settingItem. Values (right-side
  // badge + enum options) stay literal — only labels/descriptions are translated.
  const SETTING_I18N: Record<string, string> = {
    "storage.deliveryMode": "assetDelivery",
    "security.contentModeration": "contentModeration",
    "security.maxFanMessageLength": "maxFanMessageLength",
  };

  return (
    <AdminShell active="settings" user={session.user}>
      <div className={dash.pageHead}>
        <div>
          <h1>{t("settingsTitle")}</h1>
          <p className={dash.pageHeadSub}>{t("settingsSubtitle")}</p>
        </div>
      </div>

      <AiProviderConfig
        initialProvider={aiProvider}
        initialBaseUrl={aiBaseUrl}
        initialModel={aiModel}
        apiKeySet={aiApiKeySet}
      />

      <section className={dash.panel}>
        <div className={dash.panelHead}>
          <h2>{t("platformParams")}</h2>
        </div>
        <div className={dash.table}>
          {genericSettings.map((setting) => {
            const i18nId = SETTING_I18N[setting.key];
            const label = i18nId ? t(`settingItem.${i18nId}.label`) : setting.label;
            const description = i18nId ? t(`settingItem.${i18nId}.description`) : setting.description;
            return (
            <div
              key={setting.key}
              className={dash.tableRow}
              style={{ gridTemplateColumns: "1.4fr 1.8fr 150px 60px", alignItems: "center" }}
            >
              <div className={dash.cellMain}>
                <strong>{label}</strong>
                <small>
                  {t(`settingCategory.${setting.category}`)} · {t(`settingSource.${setting.source}`)}
                  {setting.updatedAt ? ` · ${t("updatedOn", { date: setting.updatedAt.toISOString().slice(0, 10) })}` : ""}
                </small>
              </div>
              <span className={dash.pageHeadSub}>{description}</span>
              <span style={{ justifySelf: "end" }}>
                <Pill tone="neutral" mono>
                  {String(setting.value)}
                </Pill>
              </span>
              <div className={dash.rowActions}>
                <details>
                  <summary>{t("edit")}</summary>
                  <div className={dash.formCard}>
                    <ApiForm action="/api/admin/platform-settings" submitLabel={t("saveSettings")}>
                      <input type="hidden" name="key" value={setting.key} />
                      <label>
                        {t("valueLabel")}
                        <SettingValueField setting={setting} />
                      </label>
                    </ApiForm>
                  </div>
                </details>
              </div>
            </div>
            );
          })}
        </div>
      </section>
    </AdminShell>
  );
}
