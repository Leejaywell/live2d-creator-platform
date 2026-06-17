import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { Pill } from "@/components/ui";
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

import { AdminAuthRequired, AdminShell, paymentStatusPillTone, dash } from "../_components";

export const dynamic = "force-dynamic";

const ORDER_COLS = "1.3fr 1fr 1.1fr 1.2fr auto";

export default async function AdminBillingPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || !isAdminRole(session.user.role)) {
    return <AdminAuthRequired />;
  }

  const role = session.user.role;
  const [creators, orders, runtimeSettings] = await Promise.all([
    prisma.user.findMany({ where: { role: "creator" }, include: { creatorProfile: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.manualOrder.findMany({ include: { creator: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    getPlatformRuntimeSettings(),
  ]);
  const creatorOptions = creators.map((creator) => ({
    id: creator.id,
    label: `${creator.creatorProfile?.displayName ?? creator.username ?? creator.id} · ${creator.username ?? "未设置"}`,
  }));

  return (
    <AdminShell active="billing" user={session.user}>
      <div className={dash.pageHead}>
        <div>
          <h1>订单与配额</h1>
          <p className={dash.pageHeadSub}>手动收款、配额台账与订单状态流转</p>
        </div>
        <Pill tone={runtimeSettings.checkoutMode === "manual-only" ? "neutral" : "amber"}>
          {checkoutModeLabel(runtimeSettings.checkoutMode)}
        </Pill>
      </div>

      <div className={dash.twoCol}>
        {hasPermission(role, "quota.grant") && (
          <details className={`${dash.panel} ${dash.disclosure}`}>
            <summary>+ 赠送配额</summary>
            <div className={dash.formCard}>
              <ApiForm action="/api/admin/quota-grants" submitLabel="赠送配额">
                <label>
                  创作者
                  <select name="creatorId" required>
                    <option value="">选择创作者</option>
                    {creatorOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  资源类型
                  <select name="resource" defaultValue="fan_codes">
                    <option value="projects">项目数</option>
                    <option value="fan_codes">粉丝码</option>
                    <option value="ai_messages">AI 消息</option>
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
        )}
        {hasPermission(role, "plans.manage") && (
          <details className={`${dash.panel} ${dash.disclosure}`}>
            <summary>+ 创建订单</summary>
            <div className={dash.formCard}>
              <p className={dash.pageHeadSub} style={{ marginBottom: 12 }}>
                {manualOrderCheckoutHint(runtimeSettings.checkoutMode)}
              </p>
              <ApiForm action="/api/admin/orders" submitLabel="创建订单">
                <label>
                  创作者
                  <select name="creatorId" required>
                    <option value="">选择创作者</option>
                    {creatorOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  支付方式
                  <select name="paymentMethod" defaultValue="alipay">
                    {manualPaymentMethods.map((method) => (
                      <option key={method} value={method}>
                        {paymentMethodLabel(method)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  套餐
                  <select name="sku" defaultValue={adminOrderProducts[0]?.sku}>
                    {adminOrderProducts.map((product) => (
                      <option key={product.sku} value={product.sku}>
                        {product.label} · ¥{product.amount}
                      </option>
                    ))}
                  </select>
                </label>
              </ApiForm>
            </div>
          </details>
        )}
      </div>

      <section className={dash.panel}>
        <div className={dash.panelHead}>
          <h2>订单</h2>
        </div>
        <div className={dash.tableWrap}>
          <div className={`${dash.tableRow} ${dash.tableHead}`} style={{ gridTemplateColumns: ORDER_COLS }}>
            <span>创作者 / 金额</span>
            <span>状态</span>
            <span>周期</span>
            <span>配额影响</span>
            <span />
          </div>
          {orders.map((order) => (
            <div key={order.id} className={dash.tableRow} style={{ gridTemplateColumns: ORDER_COLS }}>
              <div className={dash.cellMain}>
                <strong>{order.creator.username ?? order.creator.id}</strong>
                <small>
                  {formatOrderAmount(order)} · {order.planName ?? orderTypeLabel(order.orderType)}
                </small>
              </div>
              <Pill tone={paymentStatusPillTone(order.paymentStatus)}>{orderStatusLabel(order.paymentStatus)}</Pill>
              <span className={dash.mono}>{manualOrderPeriodLabel(order)}</span>
              <span className={dash.mono}>{manualOrderQuotaImpactLabel(order)}</span>
              <div className={dash.rowActions}>
                {order.paymentStatus === "pending" && hasPermission(role, "plans.manage") ? (
                  <>
                    <details className={dash.disclosure}>
                      <summary>确认</summary>
                      <div className={dash.formCard}>
                        <ApiForm action={`/api/admin/orders/${order.id}/confirm`} submitLabel="确认订单">
                          <span className={dash.pageHeadSub}>将写入套餐配额与台账流水。</span>
                        </ApiForm>
                      </div>
                    </details>
                    <details className={dash.disclosure}>
                      <summary>作废</summary>
                      <div className={dash.formCard}>
                        <ApiForm action={`/api/admin/orders/${order.id}/void`} submitLabel="作废订单">
                          <span className={dash.pageHeadSub}>确认收不到该笔款项时使用。</span>
                        </ApiForm>
                      </div>
                    </details>
                  </>
                ) : order.paymentStatus === "confirmed" && hasPermission(role, "plans.manage") ? (
                  <details className={dash.disclosure}>
                    <summary>退款</summary>
                    <div className={dash.formCard}>
                      <ApiForm action={`/api/admin/orders/${order.id}/refund`} submitLabel="退款订单">
                        <span className={dash.pageHeadSub}>回滚此订单写入的配额。</span>
                      </ApiForm>
                    </div>
                  </details>
                ) : (
                  <span className={dash.pageHeadSub}>—</span>
                )}
              </div>
            </div>
          ))}
          {orders.length === 0 && <div className={dash.empty}>还没有订单。</div>}
        </div>
      </section>
    </AdminShell>
  );
}
