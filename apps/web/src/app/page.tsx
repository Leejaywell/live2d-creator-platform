import Link from "next/link";
import type { CSSProperties } from "react";

import { listPublicCompanionProjects } from "@/lib/public-projects";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function Home() {
  const projects = await listPublicCompanionProjects();
  const featured = projects[0];

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/">
          <span className={styles.brandMark} aria-hidden />
          Live2D Creator
        </Link>
        <nav className={styles.nav} aria-label="Primary">
          <Link href="/creator">创作者工作台</Link>
          <Link href="/admin">管理后台</Link>
          <Link className={styles.navCta} href="/sign-in">
            登录
          </Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.label}>AI COMPANION · ON STAGE</p>
          <h1>
            给你的角色,
            <br />
            一座随时<em>开演</em>的舞台。
          </h1>
          <p className={styles.heroSub}>
            上传 Live2D 模型,配置语音与触发标签,发放粉丝访问码——观众凭码走进你的专属角色页,和 TA 实时聊天互动。
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryAction} href="/creator">
              进入创作者工作台
            </Link>
            {featured ? (
              <Link className={styles.secondaryAction} href={`/c/${featured.slug}`}>
                看看正在上演的角色 →
              </Link>
            ) : (
              <Link className={styles.secondaryAction} href="/sign-in">
                登录账号 →
              </Link>
            )}
          </div>
          <dl className={styles.heroFacts}>
            <div>
              <dt>粉丝码进场</dt>
              <dd>设备绑定 · 配额可控</dd>
            </div>
            <div>
              <dt>标签驱动</dt>
              <dd>表情 · 语音 · 人设片段</dd>
            </div>
            <div>
              <dt>后端代理</dt>
              <dd>密钥与配额都在云端</dd>
            </div>
          </dl>
        </div>

        <div className={styles.stagePreview} aria-label="Live2D companion preview">
          <div className={styles.previewHeader}>
            <span>{featured?.name ?? "你的下一个角色"}</span>
            <strong className={styles.liveBadge}>{projects.length} 位在演</strong>
          </div>
          <div className={styles.avatarFrame} style={{ "--theme": featured?.theme ?? "#ff6c9e" } as CSSProperties}>
            <div className={styles.spotlight} aria-hidden />
            {featured?.avatarUrl ? (
              <div className={styles.portrait} style={{ backgroundImage: `url(${featured.avatarUrl})` }} role="img" aria-label={`${featured.name} 头像`} />
            ) : (
              <div className={styles.avatarFace}>
                <span />
                <span />
              </div>
            )}
          </div>
          <div className={styles.previewChat}>
            <span>粉丝码验证通过</span>
            <p>{featured?.intro ?? "在创作者工作台发布第一个角色,这里就会亮起来。"}</p>
          </div>
        </div>
      </section>

      <section className={styles.companions} aria-labelledby="companions-title">
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.label}>NOW SHOWING</p>
            <h2 id="companions-title">正在上演</h2>
          </div>
          <Link href="/creator">管理我的角色 →</Link>
        </div>

        {projects.length ? (
          <div className={styles.projectGrid}>
            {projects.map((project) => (
              <article className={styles.projectCard} key={project.id} style={{ "--theme": project.theme } as CSSProperties}>
                <div className={styles.projectAccent} aria-hidden />
                <h3>{project.name}</h3>
                <p>{project.intro || "一位已发布的 Live2D AI 角色。"}</p>
                <div className={styles.tags}>
                  {project.triggerTags.map((tag) => (
                    <span key={tag.id}>{tag.name}</span>
                  ))}
                </div>
                <Link href={`/c/${project.slug}`}>
                  进场 <code>/c/{project.slug}</code>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <strong>还没有公开上演的角色。</strong>
            <p>从创作者工作台创建并发布第一个项目,它会出现在这里。</p>
            <Link href="/creator">去工作台开演</Link>
          </div>
        )}
      </section>

      <footer className={styles.footer}>
        <span>Live2D Creator Platform</span>
        <span>模型解密 · 配额 · AI 调用全部由后端守护</span>
      </footer>
    </main>
  );
}
