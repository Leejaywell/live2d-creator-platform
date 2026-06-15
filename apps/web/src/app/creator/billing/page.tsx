import styles from "@/app/dashboard.module.css";
import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { CreatorCheckoutForm } from "@/components/creator-checkout-form";
import {
  formatOrderAmount,
  ledgerEntryTypeLabel,
  manualOrderPeriodLabel,
  manualOrderQuotaImpactLabel,
  orderStatusLabel,
  orderTypeLabel,
  quotaResourceLabel,
  signedAmount,
} from "@/lib/billing-history";
import { adminOrderProducts } from "@/lib/checkout-products";
import { checkoutModeLabel, manualOrderCheckoutHint } from "@/lib/checkout-modes";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";

import { cancellableCheckoutOrder, CreatorAuthRequired, CreatorChrome, paymentStatusToneClass, resumableCheckoutPaymentLink } from "../_components";

export const dynamic = "force-dynamic";

export default async function CreatorBillingPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return <CreatorAuthRequired title="账单配额" />;
  }

  const [orders, quotaLedgerEntries, runtimeSettings] = await Promise.all([
    prisma.manualOrder.findMany({
      where: { creatorId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.quotaLedgerEntry.findMany({
      where: { creatorId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    getPlatformRuntimeSettings(),
  ]);

  return (
    <CreatorChrome active="billing" user={session.user}>
      <section className={styles.sectionHeader}>
        <div>
          <p className={styles.kicker}>BILLING</p>
          <h2>账单与配额</h2>
        </div>
        <div className={styles.sectionActions}>
          <span className={runtimeSettings.checkoutMode === "manual-only" ? styles.statusPill : `${styles.statusPill} ${styles.statusGood}`}>
            {checkoutModeLabel(runtimeSettings.checkoutMode)}
          </span>
          <details className={styles.inlineAction}>
            <summary>创建订单</summary>
            <div>
              <p className={styles.muted}>{manualOrderCheckoutHint(runtimeSettings.checkoutMode)}</p>
              <CreatorCheckoutForm products={adminOrderProducts} />
            </div>
          </details>
        </div>
      </section>

      <section className={styles.primaryPane}>
        <section className={styles.panel}>
            <h2>最近订单</h2>
            <div className={`${styles.dataTable} ${styles.cols5}`}>
              <div className={styles.dataHeader}>
                <span>订单</span>
                <span>状态</span>
                <span>金额 / 类型</span>
                <span>配额</span>
                <span>操作</span>
              </div>
              {orders.map((order) => {
                const paymentLink = resumableCheckoutPaymentLink(order, runtimeSettings.checkoutMode);
                const canCancelCheckout = cancellableCheckoutOrder(order);
                return (
                  <div className={styles.dataRow} key={order.id}>
                    <div className={styles.dataCell}>
                      <strong>{order.planName ?? orderTypeLabel(order.orderType)}</strong>
                      <small>{order.id}</small>
                    </div>
                    <div className={styles.dataCell}>
                      <span className={paymentStatusToneClass(order.paymentStatus)}>{orderStatusLabel(order.paymentStatus)}</span>
                    </div>
                    <div className={styles.dataCell}>
                      <strong>{formatOrderAmount(order)}</strong>
                      <small>
                        {orderTypeLabel(order.orderType)} · {order.createdAt.toISOString()}
                      </small>
                    </div>
                    <div className={styles.dataCell}>
                      {manualOrderQuotaImpactLabel(order)}
                      <small>{manualOrderPeriodLabel(order)}</small>
                      {order.confirmedAt ? <small>确认于 {order.confirmedAt.toISOString()}</small> : null}
                    </div>
                    <div className={`${styles.dataCell} ${styles.rowActions}`}>
                      {paymentLink ? (
                        <a className={styles.buttonLink} href={paymentLink}>
                          继续支付
                        </a>
                      ) : null}
                      {canCancelCheckout ? (
                        <details className={`${styles.collapse} ${styles.compactDetails}`}>
                          <summary>取消</summary>
                          <ApiForm action={`/api/creator/checkout/${order.id}`} method="DELETE" submitLabel="取消订单">
                            <span className={styles.muted}>取消这笔等待管理员确认的订单。</span>
                          </ApiForm>
                        </details>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {!orders.length ? <div className={styles.emptyState}>还没有订单记录。</div> : null}
            </div>
        </section>

        <section className={styles.panel}>
            <h2>配额流水</h2>
            <div className={`${styles.dataTable} ${styles.cols4}`}>
              <div className={styles.dataHeader}>
                <span>资源</span>
                <span>类型</span>
                <span>原因</span>
                <span>时间</span>
              </div>
              {quotaLedgerEntries.map((entry) => (
                <div className={styles.dataRow} key={entry.id}>
                  <div className={styles.dataCell}>
                    <strong>
                      {signedAmount(entry.amount)} {quotaResourceLabel(entry.resource)}
                    </strong>
                  </div>
                  <div className={styles.dataCell}>{ledgerEntryTypeLabel(entry.entryType)}</div>
                  <div className={styles.dataCell}>{entry.reason}</div>
                  <div className={styles.dataCell}>{entry.createdAt.toISOString()}</div>
                </div>
              ))}
              {!quotaLedgerEntries.length ? <div className={styles.emptyState}>还没有配额流水。</div> : null}
            </div>
        </section>
      </section>
    </CreatorChrome>
  );
}
