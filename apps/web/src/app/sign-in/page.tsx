import Link from "next/link";

import { getPlatformRuntimeSettings } from "@/lib/platform-settings";
import { wechatLoginHint, wechatLoginLabel } from "@/lib/wechat-auth";

import styles from "./auth.module.css";

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const settings = await getPlatformRuntimeSettings();
  const sent = params.sent === "1";
  const error = params.error;
  const wechat = params.wechat;

  return (
    <main className={styles.shell}>
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
              凭邮箱进场。
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
              <h2>邮箱魔法链接</h2>
            </div>
            <form action="/api/auth/signin" method="post">
              <label>
                Email
                <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
              </label>
              <button type="submit">发送登录链接</button>
            </form>
            {sent ? <p className={styles.noticeOk}>如果该邮箱拥有访问权限,登录链接已发出,请查收。</p> : null}
            {error ? <p className={styles.noticeErr}>登录请求未能完成,请稍后重试。</p> : null}
          </section>

          <section className={`${styles.door} ${styles.doorAlt}`}>
            <div className={styles.doorTitle}>
              <h2>微信登录</h2>
              <span className={settings.wechatLogin === "enabled" ? `${styles.statusPill} ${styles.statusOn}` : styles.statusPill}>
                {wechatLoginLabel(settings.wechatLogin)}
              </span>
            </div>
            <p className={styles.hint}>{wechatLoginHint(settings.wechatLogin)}</p>
            {settings.wechatLogin === "enabled" ? (
              <form action="/api/auth/wechat" method="get">
                <button type="submit">使用微信继续</button>
              </form>
            ) : null}
            {settings.wechatLogin === "sandbox" ? (
              <form action="/api/auth/wechat" method="post">
                <label>
                  已绑定的微信 OpenID
                  <input name="openId" required />
                </label>
                <button type="submit">使用沙箱 OpenID 登录</button>
              </form>
            ) : null}
            {wechat === "failed" ? <p className={styles.noticeErr}>微信登录失败,或没有已关联的有效账号。</p> : null}
            {wechat === "unavailable" ? <p className={styles.noticeErr}>微信登录当前不可用。</p> : null}
          </section>
        </div>
      </div>
    </main>
  );
}
