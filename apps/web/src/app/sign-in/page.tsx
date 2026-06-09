import Link from "next/link";

import styles from "@/app/dashboard.module.css";

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const error = params.error;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1>Sign in</h1>
          <p>Use an email magic link to access creator and admin workspaces.</p>
        </div>
        <nav className={styles.nav}>
          <Link href="/">Home</Link>
        </nav>
      </header>
      <section className={styles.twoColumn}>
        <div className={styles.panel}>
          <h2>Email magic link</h2>
          <form action="/api/auth/signin" method="post">
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <button type="submit">Send sign-in link</button>
          </form>
          {sent ? <p className={styles.muted}>If that email has access, a sign-in link has been sent.</p> : null}
          {error ? <p className={styles.muted}>The sign-in request could not be completed.</p> : null}
        </div>
      </section>
    </main>
  );
}
