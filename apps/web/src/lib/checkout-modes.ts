import { OrderType } from "@prisma/client";

export type CheckoutMode = "manual-only" | "provider-sandbox" | "provider-live";

export function checkoutModeLabel(mode: CheckoutMode) {
  switch (mode) {
    case "manual-only":
      return "Manual only";
    case "provider-sandbox":
      return "Provider sandbox";
    case "provider-live":
      return "Provider live";
  }
}

export function resolveManualOrderType(input: { orderType?: OrderType | string; planName?: string | null }) {
  return input.orderType ?? (input.planName ? OrderType.plan : OrderType.quota_adjustment);
}

export function assertManualOrderAllowedForCheckout(
  _mode: CheckoutMode,
  input: { orderType?: OrderType | string; planName?: string | null },
) {
  const orderType = resolveManualOrderType(input);
  if (orderType === OrderType.quota_adjustment) {
    throw new Error("Manual quota adjustment orders are disabled; use quota grants instead");
  }
}

export function manualOrderCheckoutHint(mode: CheckoutMode) {
  if (mode === "manual-only") {
    return "订单只使用预设套餐; 额外加量请使用赠送配额。";
  }
  return "支付服务商模式下,后台订单仍只使用预设套餐; 额外加量请使用赠送配额。";
}
