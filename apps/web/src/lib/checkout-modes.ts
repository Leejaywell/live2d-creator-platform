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
  mode: CheckoutMode,
  input: { orderType?: OrderType | string; planName?: string | null },
) {
  const orderType = resolveManualOrderType(input);
  if (mode === "manual-only" || orderType === OrderType.quota_adjustment) {
    return;
  }

  throw new Error("Manual plan and fan-code orders are disabled while checkout provider mode is active");
}

export function manualOrderCheckoutHint(mode: CheckoutMode) {
  if (mode === "manual-only") {
    return "Manual orders are the commercial source of truth.";
  }
  return "Provider checkout is the commercial source of truth; use manual orders only for quota adjustments.";
}
