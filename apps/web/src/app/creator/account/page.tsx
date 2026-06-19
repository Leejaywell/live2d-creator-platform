import { getTranslations } from "next-intl/server";

import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button, Pill } from "@/components/ui";

import { CreatorAuthRequired, CreatorShell, creatorStyles as styles } from "../_components";

export const dynamic = "force-dynamic";

function IdentityRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 13,
        color: "var(--text-dim)",
        padding: "10px 0",
        borderBottom: last ? "none" : "1px solid var(--hairline)",
      }}
    >
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default async function CreatorAccountPage() {
  const t = await getTranslations("fans");
  const tc = await getTranslations("common");
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return <CreatorAuthRequired title={t("accountTitle")} />;
  }

  const username = session.user.username ?? "creator";

  return (
    <CreatorShell active="account" user={session.user}>
      <div className={styles.pageHead}>
        <div>
          <h1>{t("accountTitle")}</h1>
          <p className={styles.pageHeadSub}>{t("accountSubtitle")}</p>
        </div>
      </div>

      <div className={styles.accountGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>{t("accountProfile")}</h2>
          </div>
          <div className={styles.avatarRow}>
            <div className={styles.avatarBig} aria-hidden />
            <Button variant="ghost" size="sm" disabled title={t("accountComingSoon")}>
              {t("accountChangeAvatar")}
            </Button>
          </div>
          <div className={styles.formCard}>
            <form>
              <label>
                {t("accountUsername")}
                <input value={username} readOnly />
              </label>
            </form>
          </div>
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2>{t("accountChangePassword")}</h2>
            </div>
            <div className={styles.formCard}>
              <ApiForm action="/api/account/password" submitLabel={t("accountUpdatePassword")}>
                <label>
                  {t("accountCurrentPassword")}
                  <input name="currentPassword" type="password" autoComplete="current-password" required />
                </label>
                <label>
                  {t("accountNewPassword")}
                  <input name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
                </label>
              </ApiForm>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2>{tc("language")}</h2>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("accountLanguageHint")}</span>
              <LocaleSwitcher />
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2>{t("accountIdentity")}</h2>
              <Pill tone="neutral">{t("accountUnverified")}</Pill>
            </div>
            <IdentityRow label={t("accountStatusLabel")} value={session.user.status === "active" ? t("accountStatusActive") : session.user.status} />
            <IdentityRow label={t("accountEntityType")} value={t("accountEntityIndividual")} />
            <IdentityRow label={t("accountRealName")} value={t("accountRealNameValue")} last />
          </section>
        </div>
      </div>
    </CreatorShell>
  );
}
