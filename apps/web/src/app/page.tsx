import { LandingDemo } from "@/components/landing-demo";
import { Brand, Eyebrow, LinkButton, Stat } from "@/components/ui";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <Brand />
          <nav className={styles.nav} aria-label="主导航">
            <LinkButton href="/sign-in" size="sm">
              登录 / 开演
            </LinkButton>
          </nav>
        </header>

        <section className={styles.hero}>
          <div>
            <Eyebrow>实时 · AI 驱动 · LIVE2D</Eyebrow>
            <h1 className={styles.title}>
              给你的角色，
              <br />
              一座随时<em>开演</em>的舞台
            </h1>
            <p className={styles.lede}>
              上传 Live2D 模型，配置语音与触发标签，发放粉丝访问码。观众凭码进场，与 AI 驱动的角色实时对话——表情、参数、声音，皆随对话起伏。
            </p>
            <div className={styles.heroCtas}>
              <LinkButton href="/sign-in" size="lg">
                创建你的角色 →
              </LinkButton>
            </div>
            <div className={styles.stats}>
              <Stat value="凭码进场" label="粉丝访问码 · 设备绑定 · 配额可控" />
              <div className={styles.statDivider} aria-hidden />
              <Stat value="标签驱动" label="文本命中 → 表情 / 参数" />
              <div className={styles.statDivider} aria-hidden />
              <Stat value="后端代理" label="密钥不落地 · 安全转发" />
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
