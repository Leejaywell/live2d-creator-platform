import Link from "next/link";

import styles from "@/app/dashboard.module.css";
import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { CreatorCheckoutForm } from "@/components/creator-checkout-form";
import { ProjectCreateForm } from "@/components/project-create-form";
import { ShareLinkCopyButton } from "@/components/share-link-copy-button";
import {
  formatOrderAmount,
  ledgerEntryTypeLabel,
  manualOrderPeriodLabel,
  manualOrderQuotaImpactLabel,
  orderStatusLabel,
  orderTypeLabel,
  paymentStatusTone,
  quotaResourceLabel,
  signedAmount,
} from "@/lib/billing-history";
import { checkoutModeLabel, manualOrderCheckoutHint } from "@/lib/checkout-modes";
import { buildCheckoutUrl, checkoutSkuFromOrderNotes } from "@/lib/checkout-products";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";
import { summarizeUsageAnalytics, usageWindowStart } from "@/lib/usage-analytics";

export const dynamic = "force-dynamic";

export default async function CreatorPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return <AuthRequired title="创作者工作台" />;
  }

  const usageDays = 7;
  const [plan, projects, usageRecords, orders, quotaLedgerEntries, runtimeSettings] = await Promise.all([
    prisma.creatorPlan.findUnique({ where: { creatorId: session.user.id } }),
    prisma.project.findMany({
      where: { creatorId: session.user.id },
      include: {
        triggerTags: {
          include: {
            voiceAssets: {
              select: { id: true },
            },
          },
        },
        voiceAssets: true,
        fanAccessCodes: true,
        voiceCloneRequests: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.chatUsage.findMany({
      where: {
        creatorId: session.user.id,
        createdAt: { gte: usageWindowStart(usageDays) },
      },
      include: {
        project: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.manualOrder.findMany({
      where: { creatorId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.quotaLedgerEntry.findMany({
      where: { creatorId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    getPlatformRuntimeSettings(),
  ]);
  const usage = summarizeUsageAnalytics(
    usageRecords.map((record) => ({
      projectId: record.projectId,
      projectName: record.project.name,
      messageCount: record.messageCount,
      tokenEstimate: record.tokenEstimate,
      createdAt: record.createdAt,
    })),
    { days: usageDays },
  );

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>BACKSTAGE</p>
          <h1>创作者工作台</h1>
          <p>{session.user.email}</p>
        </div>
        <nav className={styles.nav}>
          <Link href="/admin">管理后台</Link>
          <Link href="/">首页</Link>
          <Link href="/api/auth/signout">退出登录</Link>
        </nav>
      </header>

      <section className={styles.grid}>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>当前套餐</span>
          <strong>{plan?.planName ?? "未开通"}</strong>
          <p className={styles.muted}>{plan ? `${plan.expiresAt.toISOString().slice(0, 10)} 到期` : "联系管理员开通套餐。"}</p>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>AI 消息</span>
          <strong>{plan ? `${plan.usedAiMessages}/${plan.monthlyAiMessageLimit}` : "0/0"}</strong>
          <UsageBar used={plan?.usedAiMessages ?? 0} limit={plan?.monthlyAiMessageLimit ?? 0} />
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>粉丝码</span>
          <strong>{plan ? `${plan.usedFanCodes}/${plan.fanCodeQuota}` : "0/0"}</strong>
          <UsageBar used={plan?.usedFanCodes ?? 0} limit={plan?.fanCodeQuota ?? 0} />
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>存储</span>
          <strong>{plan ? `${plan.usedStorageMb}/${plan.storageLimitMb} MB` : "0/0 MB"}</strong>
          <UsageBar used={plan?.usedStorageMb ?? 0} limit={plan?.storageLimitMb ?? 0} />
        </div>
      </section>

      <section className={styles.sectionHeader}>
        <div>
          <p className={styles.kicker}>ANALYTICS</p>
          <h2>近 {usageDays} 天用量</h2>
        </div>
        <span className={styles.statusPill}>{usage.activeProjects} 个活跃项目</span>
      </section>

      <section className={styles.grid}>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>消息数</span>
          <strong>{usage.totalMessages}</strong>
          <p className={styles.muted}>成功回复粉丝的消息。</p>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>Token 估算</span>
          <strong>{usage.totalTokens}</strong>
          <p className={styles.muted}>平均每条 {usage.averageTokensPerMessage}。</p>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>最活跃项目</span>
          <strong>{usage.topProjects[0]?.projectName ?? "暂无"}</strong>
          <p className={styles.muted}>{usage.topProjects[0] ? `${usage.topProjects[0].messages} 条消息` : "还没有聊天记录。"}</p>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>今日</span>
          <strong>{usage.daily.at(-1)?.messages ?? 0}</strong>
          <p className={styles.muted}>UTC 零点以来的消息数。</p>
        </div>
      </section>

      <section className={styles.twoColumn}>
        <div className={styles.panel}>
          <h2>我的角色项目</h2>
          <ul className={styles.list}>
            {projects.map((project) => (
              <li className={styles.row} key={project.id}>
                <strong>{project.name}</strong>
                <span className={project.status === "published" ? `${styles.statusPill} ${styles.statusGood}` : project.status === "paused" ? `${styles.statusPill} ${styles.statusBad}` : `${styles.statusPill} ${styles.statusWarn}`}>
                  {projectStatusLabel(project.status)}
                </span>
                <span>
                  /c/{project.slug} · {project.triggerTags.length} 个标签 · {project.voiceAssets.length} 条语音 · {project.fanAccessCodes.length} 个粉丝码
                </span>
                <span>{project.intro || nextProjectStep(project)}</span>
                <div className={styles.nav}>
                  <Link href={`/creator/projects/${project.id}`}>管理</Link>
                  <Link href={`/c/${project.slug}`}>观众页</Link>
                  <ShareLinkCopyButton path={`/c/${project.slug}`} label="复制链接" />
                </div>
              </li>
            ))}
            {!projects.length ? <li className={styles.row}>还没有项目,从右侧「创建项目」开始。</li> : null}
          </ul>
        </div>

        <div className={styles.forms}>
          <section className={styles.panel}>
            <h2>创建项目</h2>
            <ProjectCreateForm />
          </section>

          <section className={styles.panel}>
            <h2>账单与配额</h2>
            <div className={styles.billingMode}>
              <span className={runtimeSettings.checkoutMode === "manual-only" ? styles.statusPill : `${styles.statusPill} ${styles.statusGood}`}>
                {checkoutModeLabel(runtimeSettings.checkoutMode)}
              </span>
              <p className={styles.muted}>{manualOrderCheckoutHint(runtimeSettings.checkoutMode)}</p>
            </div>
            <h3>购买 / 补充配额</h3>
            {runtimeSettings.checkoutMode === "manual-only" ? (
              <p className={styles.muted}>自助购买暂未开放,套餐变更或粉丝码补充请联系平台运营。</p>
            ) : (
              <CreatorCheckoutForm />
            )}
            <h3>最近订单</h3>
            <ul className={styles.list}>
              {orders.map((order) => {
                const paymentLink = resumableCheckoutPaymentLink(order, runtimeSettings.checkoutMode);
                const canCancelCheckout = cancellableCheckoutOrder(order, runtimeSettings.checkoutMode);
                return (
                  <li className={styles.row} key={order.id}>
                    <strong>{order.planName ?? orderTypeLabel(order.orderType)}</strong>
                    <span className={statusToneClass(order.paymentStatus)}>
                      {orderStatusLabel(order.paymentStatus)}
                    </span>
                    <span>
                      {formatOrderAmount(order)} · {orderTypeLabel(order.orderType)} · 创建于 {order.createdAt.toISOString()}
                    </span>
                    <span>{manualOrderPeriodLabel(order)}</span>
                    <span>{manualOrderQuotaImpactLabel(order)}</span>
                    {order.confirmedAt ? <span className={styles.muted}>确认于 {order.confirmedAt.toISOString()}</span> : null}
                    {paymentLink ? (
                      <a className={styles.buttonLink} href={paymentLink}>
                        继续支付
                      </a>
                    ) : null}
                    {canCancelCheckout ? (
                      <ApiForm action={`/api/creator/checkout/${order.id}`} method="DELETE" submitLabel="取消订单">
                        <span className={styles.muted}>取消这笔待支付的自助订单。</span>
                      </ApiForm>
                    ) : null}
                  </li>
                );
              })}
              {!orders.length ? <li className={styles.row}>还没有订单记录。</li> : null}
            </ul>
            <h3>配额流水</h3>
            <ul className={styles.list}>
              {quotaLedgerEntries.map((entry) => (
                <li className={styles.row} key={entry.id}>
                  <strong>
                    {signedAmount(entry.amount)} {quotaResourceLabel(entry.resource)}
                  </strong>
                  <span>
                    {ledgerEntryTypeLabel(entry.entryType)} · {entry.createdAt.toISOString()}
                  </span>
                  <span className={styles.muted}>{entry.reason}</span>
                </li>
              ))}
              {!quotaLedgerEntries.length ? <li className={styles.row}>还没有配额流水。</li> : null}
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>用量趋势</h2>
            <UsageTrend daily={usage.daily} />
            <h3>项目排行</h3>
            <ul className={styles.list}>
              {usage.topProjects.map((project) => (
                <li className={styles.row} key={project.projectId}>
                  <strong>{project.projectName}</strong>
                  <span>
                    {project.messages} 条消息 · {project.tokens} token 估算
                  </span>
                </li>
              ))}
              {!usage.topProjects.length ? <li className={styles.row}>该时间段内没有观众聊天记录。</li> : null}
            </ul>
          </section>
        </div>
      </section>
    </main>
  );
}

function projectStatusLabel(status: string) {
  if (status === "published") return "上演中";
  if (status === "paused") return "已暂停";
  return "草稿";
}

function statusToneClass(status: string) {
  const tone = paymentStatusTone(status);
  if (tone === "good") return `${styles.statusPill} ${styles.statusGood}`;
  if (tone === "bad") return `${styles.statusPill} ${styles.statusBad}`;
  if (tone === "warn") return `${styles.statusPill} ${styles.statusWarn}`;
  return styles.statusPill;
}

function resumableCheckoutPaymentLink(
  order: {
    id: string;
    notes?: string | null;
    paymentStatus: string;
  },
  checkoutMode: string,
) {
  if (checkoutMode === "manual-only" || order.paymentStatus !== "pending") {
    return undefined;
  }
  return checkoutSkuFromOrderNotes(order.notes) ? buildCheckoutUrl(order.id) : undefined;
}

function cancellableCheckoutOrder(
  order: {
    notes?: string | null;
    paymentStatus: string;
  },
  checkoutMode: string,
) {
  return checkoutMode !== "manual-only" && order.paymentStatus === "pending" && Boolean(checkoutSkuFromOrderNotes(order.notes));
}

function UsageTrend({ daily }: { daily: Array<{ date: string; messages: number; tokens: number }> }) {
  const maxMessages = Math.max(1, ...daily.map((day) => day.messages));
  return (
    <ol className={styles.trendList}>
      {daily.map((day) => (
        <li key={day.date}>
          <span>{day.date.slice(5)}</span>
          <div className={styles.progress} aria-label={`${day.date} 有 ${day.messages} 条消息`}>
            <span style={{ width: `${Math.round((day.messages / maxMessages) * 100)}%` }} />
          </div>
          <strong>{day.messages}</strong>
        </li>
      ))}
    </ol>
  );
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className={styles.progress} aria-label={`已使用 ${pct}%`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

function nextProjectStep(project: {
  status: string;
  triggerTags: unknown[];
  voiceAssets: unknown[];
  fanAccessCodes: unknown[];
}) {
  if (!project.triggerTags.length) return "下一步:创建触发标签,绑定表情、人设片段和语音。";
  if (!project.voiceAssets.length) return "下一步:上传预置语音,让标签回应更生动。";
  if (!project.fanAccessCodes.length) return "下一步:生成粉丝访问码再分享。";
  if (project.status !== "published") return "下一步:模型就绪后发布项目。";
  return "已就绪,随时可以分享给粉丝。";
}

function AuthRequired({ title }: { title: string }) {
  return (
    <main className={styles.authShell}>
      <div className={styles.authCard}>
        <p className={styles.kicker}>STAGE DOOR</p>
        <h1>{title}</h1>
        <p>请使用有效的创作者账号登录后继续。</p>
        <div className={styles.authActions}>
          <Link href="/sign-in">去登录</Link>
          <Link href="/">回首页</Link>
        </div>
      </div>
    </main>
  );
}
