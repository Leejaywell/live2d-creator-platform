import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { LinkButton, Pill, type Tone } from "@/components/ui";
import {
  formatOrderAmount,
  ledgerEntryTypeLabel,
  manualOrderQuotaImpactLabel,
  orderStatusLabel,
  orderTypeLabel,
  paymentStatusTone,
  quotaResourceLabel,
  signedAmount,
} from "@/lib/billing-history";
import { checkoutModeLabel } from "@/lib/checkout-modes";
import { ensureCreatorPlan } from "@/lib/creator-onboarding";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";

import { CreatorAuthRequired, CreatorShell, creatorStyles as styles } from "../_components";

export const dynamic = "force-dynamic";

const toneMap: Record<string, Tone> = { good: "live", warn: "amber", bad: "danger", neutral: "neutral" };
const HIST_COLS = "1.3fr 2fr 1fr 1fr auto";

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function CreatorBillingPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return <CreatorAuthRequired title="账单配额" />;
  }

  const [plan, orders, ledger, runtimeSettings] = await Promise.all([
    ensureCreatorPlan(session.user.id),
    prisma.manualOrder.findMany({ where: { creatorId: session.user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.quotaLedgerEntry.findMany({ where: { creatorId: session.user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    getPlatformRuntimeSettings(),
  ]);

  const aiPct =
    plan && plan.monthlyAiMessageLimit > 0
      ? Math.min(100, Math.round((plan.usedAiMessages / plan.monthlyAiMessageLimit) * 100))
      : 0;

  return (
    <CreatorShell active="billing" user={session.user} planName={plan?.planName}>
      <div className={styles.pageHead}>
        <div>
          <h1>账单与用量</h1>
          <p className={styles.pageHeadSub}>套餐配额、订单与流水</p>
        </div>
        <Pill tone={runtimeSettings.checkoutMode === "manual-only" ? "neutral" : "live"}>
          {checkoutModeLabel(runtimeSettings.checkoutMode)}
        </Pill>
      </div>

      <div className={styles.billingGrid}>
        <div className={styles.planCard}>
          <div className={styles.planHead}>
            <div>
              <div className={styles.pageHeadSub}>当前套餐</div>
              <div className={styles.planName}>{plan?.planName ?? "未开通"}</div>
            </div>
            <LinkButton href="/creator/checkout" variant="ghost" size="sm">
              升级套餐
            </LinkButton>
          </div>
          <div className={styles.planMetaRow}>
            <span>AI 消息用量</span>
            <span>
              {plan?.usedAiMessages ?? 0} / {plan?.monthlyAiMessageLimit ?? 0}
            </span>
          </div>
          <div className={styles.planBar}>
            <span style={{ width: `${aiPct}%` }} />
          </div>
          <div className={styles.planMetaRow}>
            <span>粉丝码配额</span>
            <span>
              {plan?.usedFanCodes ?? 0} / {plan?.fanCodeQuota ?? 0}
            </span>
          </div>
          <div className={styles.planFoot}>
            {plan ? `${dateOnly(plan.expiresAt)} 到期 · 状态 ${plan.status}` : "联系管理员开通套餐"}
          </div>
        </div>

        <div className={styles.rulesCard}>
          <h3>套餐规则</h3>
          <ul>
            <li>Trial 仅限少量项目，到期后转为只读</li>
            <li>超出配额需由管理员补充或升级套餐</li>
            <li>升级即时生效，由管理员手动确认订单</li>
          </ul>
        </div>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>账单历史</h2>
        </div>
        <div className={styles.tableWrap}>
          <div className={`${styles.tableRow} ${styles.tableHead}`} style={{ gridTemplateColumns: HIST_COLS }}>
            <span>日期</span>
            <span>项目</span>
            <span>金额</span>
            <span>状态</span>
            <span />
          </div>
          {orders.map((order) => {
            const tone = toneMap[paymentStatusTone(order.paymentStatus)] ?? "neutral";
            const canCancel = order.paymentStatus === "pending";
            return (
              <div key={order.id} className={styles.tableRow} style={{ gridTemplateColumns: HIST_COLS }}>
                <span className={styles.mono}>{dateOnly(order.createdAt)}</span>
                <div className={styles.cellMain}>
                  <strong>{order.planName ?? orderTypeLabel(order.orderType)}</strong>
                  <small>
                    {orderTypeLabel(order.orderType)} · {manualOrderQuotaImpactLabel(order)}
                  </small>
                </div>
                <span className={styles.mono}>{formatOrderAmount(order)}</span>
                <Pill tone={tone}>{orderStatusLabel(order.paymentStatus)}</Pill>
                <div className={styles.rowActions}>
                  {canCancel ? (
                    <details className={styles.disclosure}>
                      <summary>取消</summary>
                      <div className={styles.formCard}>
                        <ApiForm action={`/api/creator/checkout/${order.id}`} method="DELETE" submitLabel="取消订单">
                          <span className={styles.pageHeadSub}>取消这笔等待管理员确认的订单。</span>
                        </ApiForm>
                      </div>
                    </details>
                  ) : (
                    <span className={styles.pageHeadSub}>—</span>
                  )}
                </div>
              </div>
            );
          })}
          {orders.length === 0 && <div className={styles.empty}>还没有订单记录。</div>}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>配额流水</h2>
        </div>
        <div className={styles.tableWrap}>
          <div className={`${styles.tableRow} ${styles.tableHead}`} style={{ gridTemplateColumns: "1.5fr 1fr 2fr 1fr" }}>
            <span>资源</span>
            <span>类型</span>
            <span>原因</span>
            <span>时间</span>
          </div>
          {ledger.map((entry) => (
            <div key={entry.id} className={styles.tableRow} style={{ gridTemplateColumns: "1.5fr 1fr 2fr 1fr" }}>
              <strong className={styles.mono}>
                {signedAmount(entry.amount)} {quotaResourceLabel(entry.resource)}
              </strong>
              <span>{ledgerEntryTypeLabel(entry.entryType)}</span>
              <span className={styles.pageHeadSub}>{entry.reason}</span>
              <span className={styles.mono}>{dateOnly(entry.createdAt)}</span>
            </div>
          ))}
          {ledger.length === 0 && <div className={styles.empty}>还没有配额流水。</div>}
        </div>
      </section>
    </CreatorShell>
  );
}
