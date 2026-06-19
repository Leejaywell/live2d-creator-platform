import { getTranslations } from "next-intl/server";

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

  const t = await getTranslations("admin");
  const role = session.user.role;
  const [creators, orders, runtimeSettings] = await Promise.all([
    prisma.user.findMany({ where: { role: "creator" }, include: { creatorProfile: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.manualOrder.findMany({ include: { creator: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    getPlatformRuntimeSettings(),
  ]);
  const creatorOptions = creators.map((creator) => ({
    id: creator.id,
    label: `${creator.creatorProfile?.displayName ?? creator.username ?? creator.id} · ${creator.username ?? t("notSet")}`,
  }));

  return (
    <AdminShell active="billing" user={session.user}>
      <div className={dash.pageHead}>
        <div>
          <h1>{t("billingTitle")}</h1>
          <p className={dash.pageHeadSub}>{t("billingSubtitle")}</p>
        </div>
        <Pill tone={runtimeSettings.checkoutMode === "manual-only" ? "neutral" : "amber"}>
          {checkoutModeLabel(runtimeSettings.checkoutMode)}
        </Pill>
      </div>

      <div className={dash.twoCol}>
        {hasPermission(role, "quota.grant") && (
          <details className={`${dash.panel} ${dash.disclosure}`}>
            <summary>{t("grantQuotaSummary")}</summary>
            <div className={dash.formCard}>
              <ApiForm action="/api/admin/quota-grants" submitLabel={t("grantQuota")}>
                <label>
                  {t("colCreator")}
                  <select name="creatorId" required>
                    <option value="">{t("selectCreator")}</option>
                    {creatorOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("resourceType")}
                  <select name="resource" defaultValue="fan_codes">
                    <option value="projects">{t("resourceProjects")}</option>
                    <option value="fan_codes">{t("resourceFanCodes")}</option>
                    <option value="ai_messages">{t("resourceAiMessages")}</option>
                  </select>
                </label>
                <label>
                  {t("amount")}
                  <input name="amount" type="number" min="1" defaultValue="100" required />
                </label>
                <label>
                  {t("reason")}
                  <textarea name="reason" />
                </label>
              </ApiForm>
            </div>
          </details>
        )}
        {hasPermission(role, "plans.manage") && (
          <details className={`${dash.panel} ${dash.disclosure}`}>
            <summary>{t("createOrderSummary")}</summary>
            <div className={dash.formCard}>
              <p className={dash.pageHeadSub} style={{ marginBottom: 12 }}>
                {manualOrderCheckoutHint(runtimeSettings.checkoutMode)}
              </p>
              <ApiForm action="/api/admin/orders" submitLabel={t("createOrder")}>
                <label>
                  {t("colCreator")}
                  <select name="creatorId" required>
                    <option value="">{t("selectCreator")}</option>
                    {creatorOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("paymentMethod")}
                  <select name="paymentMethod" defaultValue="alipay">
                    {manualPaymentMethods.map((method) => (
                      <option key={method} value={method}>
                        {paymentMethodLabel(method)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("planLabel")}
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
          <h2>{t("ordersPanel")}</h2>
        </div>
        <div className={dash.tableWrap}>
          <div className={`${dash.tableRow} ${dash.tableHead}`} style={{ gridTemplateColumns: ORDER_COLS }}>
            <span>{t("colCreatorAmount")}</span>
            <span>{t("colStatus")}</span>
            <span>{t("colPeriod")}</span>
            <span>{t("colQuotaImpact")}</span>
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
                    <details>
                      <summary>{t("confirm")}</summary>
                      <div className={dash.formCard}>
                        <ApiForm action={`/api/admin/orders/${order.id}/confirm`} submitLabel={t("confirmOrder")}>
                          <span className={dash.pageHeadSub}>{t("confirmOrderHint")}</span>
                        </ApiForm>
                      </div>
                    </details>
                    <details>
                      <summary>{t("void")}</summary>
                      <div className={dash.formCard}>
                        <ApiForm action={`/api/admin/orders/${order.id}/void`} submitLabel={t("voidOrder")}>
                          <span className={dash.pageHeadSub}>{t("voidOrderHint")}</span>
                        </ApiForm>
                      </div>
                    </details>
                  </>
                ) : order.paymentStatus === "confirmed" && hasPermission(role, "plans.manage") ? (
                  <details>
                    <summary>{t("refund")}</summary>
                    <div className={dash.formCard}>
                      <ApiForm action={`/api/admin/orders/${order.id}/refund`} submitLabel={t("refundOrder")}>
                        <span className={dash.pageHeadSub}>{t("refundOrderHint")}</span>
                      </ApiForm>
                    </div>
                  </details>
                ) : (
                  <span className={dash.pageHeadSub}>—</span>
                )}
              </div>
            </div>
          ))}
          {orders.length === 0 && <div className={dash.empty}>{t("emptyOrders")}</div>}
        </div>
      </section>
    </AdminShell>
  );
}
