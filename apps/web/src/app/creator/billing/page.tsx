import { getTranslations } from "next-intl/server";

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
  const t = await getTranslations("fans");
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return <CreatorAuthRequired title={t("billingAuthTitle")} />;
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
          <h1>{t("billingHeading")}</h1>
          <p className={styles.pageHeadSub}>{t("billingSubtitle")}</p>
        </div>
        <Pill tone={runtimeSettings.checkoutMode === "manual-only" ? "neutral" : "live"}>
          {checkoutModeLabel(runtimeSettings.checkoutMode)}
        </Pill>
      </div>

      <div className={styles.billingGrid}>
        <div className={styles.planCard}>
          <div className={styles.planHead}>
            <div>
              <div className={styles.pageHeadSub}>{t("billingCurrentPlan")}</div>
              <div className={styles.planName}>{plan?.planName ?? t("billingPlanNone")}</div>
            </div>
            <LinkButton href="/creator/checkout" variant="ghost" size="sm">
              {t("billingUpgrade")}
            </LinkButton>
          </div>
          <div className={styles.planMetaRow}>
            <span>{t("billingAiUsage")}</span>
            <span>
              {plan?.usedAiMessages ?? 0} / {plan?.monthlyAiMessageLimit ?? 0}
            </span>
          </div>
          <div className={styles.planBar}>
            <span style={{ width: `${aiPct}%` }} />
          </div>
          <div className={styles.planMetaRow}>
            <span>{t("billingFanCodeQuota")}</span>
            <span>
              {plan?.usedFanCodes ?? 0} / {plan?.fanCodeQuota ?? 0}
            </span>
          </div>
          <div className={styles.planFoot}>
            {plan ? t("billingPlanFoot", { date: dateOnly(plan.expiresAt), status: plan.status }) : t("billingPlanFootNone")}
          </div>
        </div>

        <div className={styles.rulesCard}>
          <h3>{t("billingRulesTitle")}</h3>
          <ul>
            <li>{t("billingRule1")}</li>
            <li>{t("billingRule2")}</li>
            <li>{t("billingRule3")}</li>
          </ul>
        </div>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>{t("billingHistoryTitle")}</h2>
        </div>
        <div className={styles.tableWrap}>
          <div className={`${styles.tableRow} ${styles.tableHead}`} style={{ gridTemplateColumns: HIST_COLS }}>
            <span>{t("billingColDate")}</span>
            <span>{t("billingColItem")}</span>
            <span>{t("billingColAmount")}</span>
            <span>{t("billingColStatus")}</span>
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
                    <details>
                      <summary>{t("billingCancel")}</summary>
                      <div className={styles.formCard}>
                        <ApiForm action={`/api/creator/checkout/${order.id}`} method="DELETE" submitLabel={t("billingCancelOrder")} submitVariant="danger">
                          <span className={styles.pageHeadSub}>{t("billingCancelHint")}</span>
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
          {orders.length === 0 && <div className={styles.empty}>{t("billingNoOrders")}</div>}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <h2>{t("billingLedgerTitle")}</h2>
        </div>
        <div className={styles.tableWrap}>
          <div className={`${styles.tableRow} ${styles.tableHead}`} style={{ gridTemplateColumns: "1.5fr 1fr 2fr 1fr" }}>
            <span>{t("billingColResource")}</span>
            <span>{t("billingColType")}</span>
            <span>{t("billingColReason")}</span>
            <span>{t("billingColTime")}</span>
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
          {ledger.length === 0 && <div className={styles.empty}>{t("billingNoLedger")}</div>}
        </div>
      </section>
    </CreatorShell>
  );
}
