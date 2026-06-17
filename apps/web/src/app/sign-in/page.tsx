import Link from "next/link";

import { Brand, Button } from "@/components/ui";

import styles from "./auth.module.css";

export const metadata = { title: "登录" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const hasError = params.error === "invalid-credentials";
  const showDevShortcuts = process.env.NODE_ENV !== "production";

  return (
    <main className={styles.shell}>
      <Link href="/" className={styles.brand} aria-label="返回首页">
        <Brand small />
      </Link>

      <div className={styles.card}>
        <h1 className={styles.title}>回到后台</h1>
        <p className={styles.subtitle}>登录以管理你的角色与舞台</p>

        <div className={styles.tabs} role="tablist" aria-label="登录方式">
          <span className={`${styles.tab} ${styles.tabActive}`} role="tab" aria-selected="true">
            密码登录
          </span>
          <span
            className={`${styles.tab} ${styles.tabDisabled}`}
            role="tab"
            aria-selected="false"
            aria-disabled="true"
            title="即将推出"
          >
            魔法链接
          </span>
        </div>

        <form className={styles.form} action="/api/auth/signin" method="post">
          <label className={styles.label} htmlFor="username">
            账号 / 邮箱
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
            密码
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
              账号或密码不正确，请重试
            </div>
          )}
          <div className={styles.forgot}>
            <a href="#" title="请联系平台管理员">
              忘记密码？
            </a>
          </div>
          <Button type="submit" block size="lg">
            登录
          </Button>
        </form>

        <p className={styles.foot}>
          还没有账号？<a href="#" title="MVP 阶段由管理员开通账号">联系开通创作者账号</a>
        </p>

        {showDevShortcuts && (
          <div className={styles.devBox}>
            <p className={styles.devLabel}>本地测试入口</p>
            <div className={styles.devButtons}>
              <form action="/api/auth/signin" method="post">
                <input name="username" type="hidden" value="admin" />
                <input name="password" type="hidden" value="ChangeMe123!" />
                <Button type="submit" variant="ghost" size="sm" block>
                  管理员
                </Button>
              </form>
              <form action="/api/auth/signin" method="post">
                <input name="username" type="hidden" value="creator" />
                <input name="password" type="hidden" value="ChangeMe123!" />
                <Button type="submit" variant="ghost" size="sm" block>
                  创作者
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
