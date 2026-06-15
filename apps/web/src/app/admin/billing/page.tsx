import styles from "@/app/dashboard.module.css";
import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import {
  formatOrderAmount,
  manualOrderPeriodLabel,
  manualOrderQuotaImpactLabel,
  orderStatusLabel,
  orderTypeLabel,
} from "@/lib/billing-history";
import { adminOrderProducts, manualPaymentMethods, paymentMethodLabel } from "@/lib/checkout-products";
import { checkoutModeLabel, manualOrderCheckoutHint } from "@/lib/checkout-modes";
import { hasPermission, isAdminRole } from "@/lib/permissions";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";

import { AdminAuthRequired, AdminChrome, paymentStatusToneClass } from "../_components";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || !isAdminRole(session.user.role)) {
    return <AdminAuthRequired />;
  }

  const [creators, orders, runtimeSettings] = await Promise.all([
    prisma.user.findMany({
      where: { role: "creator" },
      include: { creatorProfile: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.manualOrder.findMany({
      include: { creator: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    getPlatformRuntimeSettings(),
  ]);
  const creatorOptions = creators.map((creator) => ({
    id: creator.id,
    label: `${creator.creatorProfile?.displayName ?? creator.username ?? creator.id} · ${creator.username ?? "未设置登录名"}`,
  }));
  const checkoutProviderMode = runtimeSettings.checkoutMode !== "manual-only";

  return (
    <AdminChrome active="billing" user={session.user}>
      <section className={styles.sectionHeader}>
        <div>
          <p className={styles.kicker}>BILLING</p>
          <h2>订单与配额</h2>
        </div>
        <div className={styles.sectionActions}>
          <span className={checkoutProviderMode ? `${styles.statusPill} ${styles.statusWarn}` : styles.statusPill}>{checkoutModeLabel(runtimeSettings.checkoutMode)}</span>
          {hasPermission(session.user.role, "quota.grant") ? (
            <details className={styles.inlineAction}>
              <summary>赠送配额</summary>
              <div>
                <p className={styles.muted}>用于补偿、活动或人工加量,不创建订单。</p>
                <ApiForm action="/api/admin/quota-grants" submitLabel="赠送配额">
                  <label>
                    创作者
                    <select name="creatorId" required>
                      <option value="">选择创作者</option>
                      {creatorOptions.map((creator) => (
                        <option key={creator.id} value={creator.id}>
                          {creator.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    资源类型
                    <select name="resource" defaultValue="fan_codes">
                      <option value="projects">项目数(projects)</option>
                      <option value="fan_codes">粉丝码(fan_codes)</option>
                      <option value="ai_messages">AI 消息(ai_messages)</option>
                    </select>
                  </label>
                  <label>
                    数量
                    <input name="amount" type="number" min="1" defaultValue="100" required />
                  </label>
                  <label>
                    原因
                    <textarea name="reason" />
                  </label>
                </ApiForm>
              </div>
            </details>
          ) : null}
          {hasPermission(session.user.role, "plans.manage") ? (
            <details className={styles.inlineAction}>
              <summary>创建订单</summary>
              <div>
                <p className={styles.muted}>{manualOrderCheckoutHint(runtimeSettings.checkoutMode)}</p>
                <ApiForm action="/api/admin/orders" submitLabel="创建订单">
                  <label>
                    创作者
                    <select name="creatorId" required>
                      <option value="">选择创作者</option>
                      {creatorOptions.map((creator) => (
                        <option key={creator.id} value={creator.id}>
                          {creator.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    支付方式
                    <select name="paymentMethod" defaultValue="alipay">
                      {manualPaymentMethods.map((method) => (
                        <option key={method} value={method}>
                          {paymentMethodLabel(method)}({method})
                        </option>
                      ))}
                    </select>
                  </label>
                  <fieldset className={styles.optionGrid}>
                    <legend>套餐</legend>
                    {adminOrderProducts.map((product, index) => (
                      <label className={styles.optionCard} key={product.sku}>
                        <input name="sku" type="radio" value={product.sku} defaultChecked={index === 0} />
                        <span>
                          <strong>{product.label}</strong>
                          <small>
                            ¥{product.amount} · {product.periodDays ?? 0} 天 · {product.projectQuotaDelta} 项目
                          </small>
                          <small>
                            AI {product.aiMessageQuotaDelta} · 粉丝码 {product.fanCodeQuotaDelta}
                          </small>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                </ApiForm>
              </div>
            </details>
          ) : null}
        </div>
      </section>

      <section className={styles.panel}>
        <h2>订单</h2>
        <div className={`${styles.dataTable} ${styles.cols6}`}>
          <div className={styles.dataHeader}>
            <span>创作者</span>
            <span>状态</span>
            <span>金额</span>
            <span>周期</span>
            <span>配额影响</span>
            <span>操作</span>
          </div>
          {orders.map((order) => (
            <div className={styles.dataRow} key={order.id}>
              <div className={styles.dataCell}>
                <strong>{order.creator.username ?? order.creator.id}</strong>
                <small>{order.id}</small>
              </div>
              <div className={styles.dataCell}>
                <span className={paymentStatusToneClass(order.paymentStatus)}>{orderStatusLabel(order.paymentStatus)}</span>
              </div>
              <div className={styles.dataCell}>
                <strong>{formatOrderAmount(order)}</strong>
                <small>
                  {order.planName ?? orderTypeLabel(order.orderType)} · {paymentMethodLabel(order.paymentMethod)}
                </small>
              </div>
              <div className={styles.dataCell}>{manualOrderPeriodLabel(order)}</div>
              <div className={styles.dataCell}>{manualOrderQuotaImpactLabel(order)}</div>
              <div className={`${styles.dataCell} ${styles.rowActions}`}>
                {order.paymentStatus === "pending" ? (
                  <>
                    <details className={`${styles.collapse} ${styles.compactDetails}`}>
                      <summary>确认</summary>
                      <ApiForm action={`/api/admin/orders/${order.id}/confirm`} submitLabel="确认订单">
                        <span className={styles.muted}>将写入套餐配额与台账流水。</span>
                      </ApiForm>
                    </details>
                    <details className={`${styles.collapse} ${styles.compactDetails}`}>
                      <summary>作废</summary>
                      <ApiForm action={`/api/admin/orders/${order.id}/void`} submitLabel="作废订单">
                        <span className={styles.muted}>用于确认不会收到该笔款项时。</span>
                      </ApiForm>
                    </details>
                  </>
                ) : null}
                {order.paymentStatus === "confirmed" ? (
                  <details className={`${styles.collapse} ${styles.compactDetails}`}>
                    <summary>退款</summary>
                    <ApiForm action={`/api/admin/orders/${order.id}/refund`} submitLabel="确认退款">
                      <span className={styles.muted}>回收该订单未使用的配额并写入台账流水。</span>
                    </ApiForm>
                  </details>
                ) : null}
                {hasPermission(session.user.role, "plans.manage") ? (
                  <details className={`${styles.collapse} ${styles.compactDetails}`}>
                    <summary>删除</summary>
                    <ApiForm action={`/api/admin/orders/${order.id}`} method="DELETE" submitLabel="确认删除订单">
                      <span className={styles.muted}>删除订单记录。已产生的配额流水会保留,但会解除与该订单的关联。</span>
                    </ApiForm>
                  </details>
                ) : null}
              </div>
            </div>
          ))}
          {!orders.length ? <div className={styles.emptyState}>还没有订单。</div> : null}
        </div>
      </section>
    </AdminChrome>
  );
}
