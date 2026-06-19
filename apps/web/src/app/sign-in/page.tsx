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
      <LocaleSwitcher className={styles.langSwitch} />

      <div className={styles.card}>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.subtitle}>{t("subtitle")}</p>

        <div className={styles.tabs} role="tablist" aria-label={t("loginMethod")}>
          <span className={`${styles.tab} ${styles.tabActive}`} role="tab" aria-selected="true">
            {t("tabPassword")}
          </span>
          <span
            className={`${styles.tab} ${styles.tabDisabled}`}
            role="tab"
            aria-selected="false"
            aria-disabled="true"
            title={t("comingSoon")}
          >
            {t("tabMagic")}
          </span>
        </div>

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
              <form action="/api/auth/signin" method="post">
                <input name="username" type="hidden" value="creator" />
                <input name="password" type="hidden" value="ChangeMe123!" />
                <Button type="submit" variant="ghost" size="sm" block>
                  {tc("creator")}
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
