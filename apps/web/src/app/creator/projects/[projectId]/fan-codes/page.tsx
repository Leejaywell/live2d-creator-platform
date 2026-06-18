import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { FanCodeGenerator } from "@/components/fan-code-generator";
import { Pill, type Tone } from "@/components/ui";
import { fanCodeDisplayStatus } from "@/lib/fan-code-status";
import { prisma } from "@/lib/prisma";

import { CreatorAuthRequired, CreatorShell, creatorStyles as styles } from "../../../_components";

export const dynamic = "force-dynamic";

const CODE_COLS = "1.4fr 1fr 1.2fr 1fr auto";

const statusTone: Record<string, Tone> = {
  unused: "neutral",
  bound: "teal",
  "used up": "amber",
  expired: "danger",
  revoked: "danger",
};
const statusLabel: Record<string, string> = {
  unused: "未用",
  bound: "已绑定",
  "used up": "已用尽",
  expired: "已过期",
  revoked: "已停用",
};

export default async function FanCodesPage({ params }: PageProps<"/creator/projects/[projectId]/fan-codes">) {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return <CreatorAuthRequired title="粉丝码" />;
  }

  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, creatorId: session.user.id },
    include: { fanAccessCodes: { orderBy: { createdAt: "desc" }, take: 60 } },
  });
  if (!project) notFound();

  const codes = project.fanAccessCodes.map((code) => ({
    id: code.id,
    batchId: code.batchId,
    status: fanCodeDisplayStatus(code),
    usedMessages: code.usedMessages,
    maxMessages: code.maxMessages,
  }));
  const dispatched = codes.length;
  const bound = codes.filter((c) => c.status === "bound").length;
  const unused = codes.filter((c) => c.status === "unused").length;
  const revoked = codes.filter((c) => c.status === "revoked").length;

  return (
    <CreatorShell active="fancodes" user={session.user}>
      <div className={styles.pageHead}>
        <div>
          <h1>粉丝码 · {project.name}</h1>
          <p className={styles.pageHeadSub}>
            生成访问码并发放给粉丝 · 已发放 {dispatched} · 已绑定 {bound}
          </p>
        </div>
        <Link href={`/creator/projects/${project.id}`} className={styles.panelMeta}>
          ← 返回工作区
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 26, alignItems: "start" }}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>⊞ 生成新批次</h2>
          </div>
          <div className={styles.formCard}>
            <FanCodeGenerator projectId={project.id} />
          </div>
        </section>

        <div>
          <div className={styles.toolbar} style={{ marginBottom: 14, flexWrap: "wrap" }}>
            <Pill tone="pink">全部 {dispatched}</Pill>
            <Pill tone="neutral">未用 {unused}</Pill>
            <Pill tone="teal">已绑定 {bound}</Pill>
            <Pill tone="neutral">已停用 {revoked}</Pill>
          </div>
          <div className={styles.tableWrap}>
            <div className={`${styles.tableRow} ${styles.tableHead}`} style={{ gridTemplateColumns: CODE_COLS }}>
              <span>访问码</span>
              <span>批次</span>
              <span>状态</span>
              <span>用量</span>
              <span />
            </div>
            {codes.map((code) => (
              <div key={code.id} className={styles.tableRow} style={{ gridTemplateColumns: CODE_COLS }}>
                <span className={styles.mono}>#{code.id.slice(0, 8)}</span>
                <span className={styles.pageHeadSub}>{code.batchId.slice(0, 6)}</span>
                <Pill tone={statusTone[code.status] ?? "neutral"} dot={code.status === "bound"}>
                  {statusLabel[code.status] ?? code.status}
                </Pill>
                <span className={styles.mono}>
                  {code.status === "unused" ? "—" : `${code.usedMessages}/${code.maxMessages}`}
                </span>
                <div className={styles.rowActions}>
                  {code.status === "revoked" ? (
                    <span className={styles.pageHeadSub}>—</span>
                  ) : (
                    <details className={styles.disclosure}>
                      <summary>停用</summary>
                      <div className={styles.formCard}>
                        <ApiForm action={`/api/creator/fan-codes/${code.id}`} method="DELETE" submitLabel="确认停用" submitVariant="danger">
                          <span className={styles.pageHeadSub}>停用后该码无法再进场。</span>
                        </ApiForm>
                      </div>
                    </details>
                  )}
                </div>
              </div>
            ))}
            {codes.length === 0 && <div className={styles.empty}>还没有生成过粉丝码，使用左侧生成新批次。</div>}
          </div>
        </div>
      </div>
    </CreatorShell>
  );
}
