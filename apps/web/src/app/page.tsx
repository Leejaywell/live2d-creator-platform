import { getTranslations } from "next-intl/server";

import { LandingDemo } from "@/components/landing-demo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Brand, Eyebrow, LinkButton, Stat } from "@/components/ui";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const t = await getTranslations("landing");

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <Brand />
          <nav className={styles.nav} aria-label={t("mainNav")}>
            <LocaleSwitcher />
            <LinkButton href="/sign-in" size="sm" aria-label={t("signInCta")} title={t("signInCta")}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </LinkButton>
          </nav>
        </header>

        <section className={styles.hero}>
          <div>
            <Eyebrow>{t("eyebrow")}</Eyebrow>
            <h1 className={styles.title}>
              {t("titleLine1")}
              <br />
              {t("titleLine2Before")}<em>{t("titleLine2Em")}</em>{t("titleLine2After")}
            </h1>
            <p className={styles.lede}>
              {t("lede")}
            </p>
            <div className={styles.heroCtas}>
              <LinkButton href="/sign-in" size="lg">
                {t("createCharacterCta")}
              </LinkButton>
            </div>
            <div className={styles.stats}>
              <Stat value={t("stat1Value")} label={t("stat1Label")} />
              <div className={styles.statDivider} aria-hidden />
              <Stat value={t("stat2Value")} label={t("stat2Label")} />
              <div className={styles.statDivider} aria-hidden />
              <Stat value={t("stat3Value")} label={t("stat3Label")} />
            </div>
          </div>

          <div className={styles.stageCard} id="demo">
            <div className={styles.stageGlow} aria-hidden />
            <div className={styles.stageFloor} aria-hidden />
            <LandingDemo />
          </div>
        </section>
      </div>
    </main>
  );
}
