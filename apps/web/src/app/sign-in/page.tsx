import Link from "next/link";

import { StageBackdrop } from "@/components/ui/glass";

import styles from "./auth.module.css";

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const error = params.error;
  const showLocalShortcuts = process.env.NODE_ENV !== "production";

  return (
    <main className={styles.shell}>
      <StageBackdrop />
      <Link className={styles.backLink} href="/">
        ← Live2D Creator
      </Link>

      <div className={styles.card}>
        <aside className={styles.poster}>
          <div>
            <p className={styles.posterKicker}>STAGE DOOR</p>
            <h1>
              后台入口,
              <br />
              凭账号进场。
            </h1>
          </div>
          <div className={styles.posterFoot}>
            <strong>创作者与管理员通道</strong>
            <span>观众请走角色页 /c/:slug 粉丝码检票</span>
          </div>
        </aside>

        <div className={styles.doors}>
          <section className={styles.door}>
            <div className={styles.doorTitle}>
              <h2>账号密码登录</h2>
            </div>
            <form action="/api/auth/signin" method="post">
              <label>
                账号名
                <input name="username" autoComplete="username" placeholder="creator01" required />
              </label>
              <label>
                密码
                <input name="password" type="password" autoComplete="current-password" required />
              </label>
              <button type="submit">登录</button>
            </form>
            {error ? <p className={styles.noticeErr}>账号名或密码错误,或账号已停用。</p> : null}
            {showLocalShortcuts ? (
              <div className={styles.quickLogin}>
                <span>本地测试入口</span>
                <div className={styles.quickLoginButtons}>
                  <form action="/api/auth/signin" method="post">
                    <input name="username" type="hidden" value="admin" />
                    <input name="password" type="hidden" value="ChangeMe123!" />
                    <button type="submit">管理员测试登录</button>
                  </form>
                  <form action="/api/auth/signin" method="post">
                    <input name="username" type="hidden" value="creator" />
                    <input name="password" type="hidden" value="ChangeMe123!" />
                    <button type="submit">创作者测试登录</button>
                  </form>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
