import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { Brand, Button } from "@/components/ui";

import styles from "./auth.module.css";

export const metadata = { title: "登录" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const hasError = params.error === "invalid-credentials";
  const showDevShortcuts = process.env.NODE_ENV !== "production";
  const t = await getTranslations("signin");
  const tc = await getTranslations("common");

  return (
    <main className={styles.shell}>
      <Link href="/" className={styles.brand} aria-label={tc("backHome")}>
        <Brand small />
      </Link>
      {/* Wrapper owns the absolute top-right placement; the switcher's own
          .root is position:relative and would otherwise win the cascade. */}
      <div className={styles.langSwitch}>
        <LocaleSwitcher />
      </div>

      <div className={styles.card}>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.subtitle}>{t("subtitle")}</p>

        {/* Magic-link (email) login removed for now — to be reconsidered later.
            The i18n keys (tabMagic / comingSoon) are kept so it can be restored. */}

        <form className={styles.form} action="/api/auth/signin" method="post">
          <label className={styles.label} htmlFor="username">
            {t("usernameLabel")}
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            placeholder="creator01"
            className={`${styles.input} ${hasError ? styles.inputError : ""}`}
            required
          />
          <label className={styles.label} htmlFor="password">
            {t("passwordLabel")}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className={`${styles.input} ${hasError ? styles.inputError : ""}`}
            required
          />
          {hasError && (
            <div className={styles.error}>
              <span className={styles.errorMark} aria-hidden>
                !
              </span>
              {t("invalid")}
            </div>
          )}
          <div className={styles.forgot}>
            <a href="#" title={t("forgotHint")}>
              {t("forgot")}
            </a>
          </div>
          <Button type="submit" block size="lg">
            {t("submit")}
          </Button>
        </form>

        <p className={styles.foot}>
          {t("noAccount")}
          <a href="#" title={t("contactHint")}>
            {t("contactToOpen")}
          </a>
        </p>

        {showDevShortcuts && (
          <div className={styles.devBox}>
            <p className={styles.devLabel}>{t("devEntry")}</p>
            <div className={styles.devButtons}>
              <form action="/api/auth/signin" method="post">
                <input name="username" type="hidden" value="admin" />
                <input name="password" type="hidden" value="ChangeMe123!" />
                <Button type="submit" variant="ghost" size="sm" block>
                  {tc("admin")}
                </Button>
              </form>
              {/* Creator quick-login: pick which seeded creator account to enter.
                  Both demo accounts share the default password. */}
              <form action="/api/auth/signin" method="post" className={styles.devCreatorForm}>
                <input name="password" type="hidden" value="ChangeMe123!" />
                <select name="username" className={styles.devSelect} defaultValue="creator" aria-label={tc("creator")}>
                  <option value="creator">创作者 · 爱宕</option>
                  <option value="azurlane">创作者 · 碧蓝航线馆</option>
                </select>
                <Button type="submit" variant="ghost" size="sm">
                  {t("submit")}
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
