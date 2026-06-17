import Link from "next/link";

import { Brand, Eyebrow, LinkButton, Pill, Stat } from "@/components/ui";
import { listPublicCompanionProjects } from "@/lib/public-projects";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const cardAccents = [
  "rgba(255,108,158,0.28)",
  "rgba(111,231,218,0.26)",
  "rgba(242,193,78,0.24)",
  "rgba(155,140,255,0.26)",
];

function cardArtStyle(index: number) {
  const accent = cardAccents[index % cardAccents.length];
  return {
    background: `radial-gradient(60% 60% at 50% 30%, ${accent}, transparent 70%), repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 8px, transparent 8px 16px)`,
  };
}

export default async function LandingPage() {
  const projects = await listPublicCompanionProjects();
  const featured = projects[0];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <Brand />
          <nav className={styles.nav} aria-label="主导航">
            <a href="#live">在演角色</a>
            <Link href="/creator">创作者工作台</Link>
            <Link href="/admin">管理后台</Link>
            <a href="#live">定价</a>
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
              <LinkButton href="#live" variant="ghost" size="lg">
                进入观众席
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

          <div className={styles.stageCard}>
            <div className={styles.stageGlow} aria-hidden />
            <div className={styles.stageFloor} aria-hidden />
            <div className={styles.stageBadge}>
              <Pill tone="live" mono dot>
                {projects.length} 位在演
              </Pill>
            </div>
            <div className={styles.modelSlot} aria-hidden>
              LIVE2D
              <br />
              模型渲染区
            </div>
            <div className={styles.stageMeta}>
              <div>
                <div className={styles.stageName}>{featured ? featured.name : "星野 · Hoshino"}</div>
                <div className={styles.stageSub}>
                  {featured?.intro ? featured.intro.slice(0, 24) : "虚拟主播 · 治愈系 · 中文 / 日文"}
                </div>
              </div>
              {featured ? (
                <LinkButton href={`/c/${featured.slug}`} variant="tintPink" size="sm">
                  进场 →
                </LinkButton>
              ) : (
                <LinkButton href="/sign-in" variant="tintPink" size="sm">
                  进场 →
                </LinkButton>
              )}
            </div>
          </div>
        </section>

        <section className={styles.grid} id="live">
          <div className={styles.gridHead}>
            <h2>此刻在演</h2>
            <span className={styles.gridLink}>共 {projects.length} 位角色</span>
          </div>
          <div className={styles.cards}>
            {projects.length === 0 && (
              <div className={styles.empty}>暂无公开在演的角色。创作者发布项目后将出现在这里。</div>
            )}
            {projects.map((project, index) => (
              <Link key={project.id} href={`/c/${project.slug}`} className={styles.card}>
                <div className={styles.cardArt} style={cardArtStyle(index)}>
                  <span className={styles.cardArtBadge}>
                    <Pill tone="live" mono dot>
                      在演
                    </Pill>
                  </span>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardName}>{project.name}</div>
                  <div className={styles.cardTags}>
                    {project.triggerTags.length === 0 ? (
                      <span className={styles.cardTag}>AI 角色</span>
                    ) : (
                      project.triggerTags.map((tag) => (
                        <span key={tag.id} className={styles.cardTag}>
                          {tag.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <footer className={styles.footer}>
          <div className={styles.footerBrand}>
            <Brand small />
            <span>© 2026 · 让每个角色都有舞台</span>
          </div>
          <div className={styles.footerLinks}>
            <a href="#live">条款</a>
            <a href="#live">隐私</a>
            <a href="#live">联系</a>
          </div>
        </footer>
      </div>
    </main>
  );
}
