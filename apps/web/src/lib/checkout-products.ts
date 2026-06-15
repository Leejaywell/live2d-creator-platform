import { OrderType, PaymentMethod } from "@prisma/client";

export type CheckoutSku = "starter-monthly" | "pro-monthly" | "fan-code-pack-500";

export type CheckoutProduct = {
  sku: CheckoutSku;
  label: string;
  description: string;
  amount: string;
  currency: string;
  orderType: OrderType;
  paymentMethods: PaymentMethod[];
  planName?: string;
  periodDays?: number;
  projectQuotaDelta: number;
  aiMessageQuotaDelta: number;
  storageQuotaDeltaMb: number;
  fanCodeQuotaDelta: number;
};

export const manualPaymentMethods = [PaymentMethod.wechat, PaymentMethod.alipay, PaymentMethod.other] as const;

export const checkoutProducts: readonly CheckoutProduct[] = [
  {
    sku: "starter-monthly",
    label: "Starter Monthly",
    description: "1 project, 1,000 AI messages, and 100 fan codes.",
    amount: "99.00",
    currency: "CNY",
    orderType: OrderType.plan,
    paymentMethods: [...manualPaymentMethods],
    planName: "Starter",
    periodDays: 30,
    projectQuotaDelta: 1,
    aiMessageQuotaDelta: 1000,
    storageQuotaDeltaMb: 0,
    fanCodeQuotaDelta: 100,
  },
  {
    sku: "pro-monthly",
    label: "Pro Monthly",
    description: "3 projects, 10,000 AI messages, and 1,000 fan codes.",
    amount: "399.00",
    currency: "CNY",
    orderType: OrderType.plan,
    paymentMethods: [...manualPaymentMethods],
    planName: "Pro",
    periodDays: 30,
    projectQuotaDelta: 3,
    aiMessageQuotaDelta: 10000,
    storageQuotaDeltaMb: 0,
    fanCodeQuotaDelta: 1000,
  },
  {
    sku: "fan-code-pack-500",
    label: "Fan Code Pack 500",
    description: "Adds 500 fan-code quota to the current creator plan.",
    amount: "59.00",
    currency: "CNY",
    orderType: OrderType.fan_code_pack,
    paymentMethods: [...manualPaymentMethods],
    projectQuotaDelta: 0,
    aiMessageQuotaDelta: 0,
    storageQuotaDeltaMb: 0,
    fanCodeQuotaDelta: 500,
  },
];

export const adminOrderProducts = checkoutProducts.filter((product) => product.orderType === OrderType.plan);

export function checkoutProductForSku(sku: string) {
  return checkoutProducts.find((product) => product.sku === sku);
}

export function adminOrderProductForSku(sku: string) {
  return adminOrderProducts.find((product) => product.sku === sku);
}

export function paymentMethodLabel(method: string) {
  switch (method) {
    case "wechat":
      return "微信";
    case "alipay":
      return "支付宝";
    case "bank_transfer":
      return "银行转账";
    default:
      return "其他";
  }
}

export function checkoutSkuFromOrderNotes(notes?: string | null) {
  const match = notes?.match(/^(?:Checkout request|Creator package request): ([a-z0-9-]+)$/);
  return match && checkoutProductForSku(match[1]) ? match[1] : undefined;
}

export function assertCheckoutRequestAllowed(mode: "manual-only" | "provider-sandbox" | "provider-live") {
  if (mode === "manual-only") {
    throw new Error("Self-service checkout is disabled while checkout is manual-only");
  }
}

export function checkoutOrderPeriod(product: CheckoutProduct, now = new Date()) {
  if (!product.periodDays) {
    return {};
  }
  const startsAt = new Date(now);
  const expiresAt = new Date(now);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + product.periodDays);
  return { periodStart: startsAt, periodEnd: expiresAt };
}

export function buildCheckoutUrl(orderId: string) {
  const template = process.env.PAYMENT_CHECKOUT_URL_TEMPLATE;
  if (!template) return undefined;
  assertCheckoutUrlTemplate(template);
  return template.replaceAll("{orderId}", encodeURIComponent(orderId));
}

export function assertCheckoutUrlTemplate(template: string) {
  if (!template.includes("{orderId}")) {
    throw new Error("PAYMENT_CHECKOUT_URL_TEMPLATE must include {orderId}");
  }

  const exampleUrl = template.replaceAll("{orderId}", "order_example");
  let parsed: URL;
  try {
    parsed = new URL(exampleUrl);
  } catch {
    throw new Error("PAYMENT_CHECKOUT_URL_TEMPLATE must be a valid absolute URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("PAYMENT_CHECKOUT_URL_TEMPLATE must be HTTPS");
  }
}
