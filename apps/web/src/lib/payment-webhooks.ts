import crypto from "node:crypto";
import { PaymentStatus, Prisma } from "@prisma/client";

export type PaymentWebhookPayload = {
  provider: string;
  eventId?: string;
  orderId: string;
  paymentStatus: PaymentStatus | string;
  amount: string;
  currency: string;
};

export type PaymentWebhookOrderSnapshot = {
  amount: { equals(value: Prisma.Decimal): boolean };
  currency: string;
  paymentMethod: string;
};

export function paymentWebhookSecret() {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("PAYMENT_WEBHOOK_SECRET must be configured with at least 24 characters");
  }
  return secret;
}

export function verifyPaymentWebhookSignature(rawBody: string, signatureHeader: string | null, secret: string) {
  if (!signatureHeader) {
    throw new Error("Missing payment webhook signature");
  }

  const signature = signatureHeader.startsWith("sha256=") ? signatureHeader.slice("sha256=".length) : signatureHeader;
  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    throw new Error("Invalid payment webhook signature format");
  }

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new Error("Invalid payment webhook signature");
  }
}

export function parsePaymentWebhookPayload(rawBody: string): PaymentWebhookPayload {
  const payload = JSON.parse(rawBody) as Partial<PaymentWebhookPayload>;
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid payment webhook payload");
  }
  if (!payload.provider || !payload.orderId || !payload.paymentStatus || !payload.amount || !payload.currency) {
    throw new Error("Payment webhook payload is missing required fields");
  }
  if (payload.paymentStatus !== PaymentStatus.confirmed) {
    throw new Error("Payment webhook status is not confirmable");
  }
  return {
    provider: String(payload.provider),
    eventId: payload.eventId ? String(payload.eventId) : undefined,
    orderId: String(payload.orderId),
    paymentStatus: payload.paymentStatus,
    amount: String(payload.amount),
    currency: String(payload.currency).toUpperCase(),
  };
}

export async function assertPaymentWebhookCanConfirmOrder(payload: PaymentWebhookPayload) {
  const [{ getPlatformRuntimeSettings }, { prisma }] = await Promise.all([
    import("@/lib/platform-settings"),
    import("@/lib/prisma"),
  ]);
  const settings = await getPlatformRuntimeSettings();
  if (settings.checkoutMode === "manual-only") {
    throw new Error("Payment webhooks are disabled while checkout is manual-only");
  }

  const order = await prisma.manualOrder.findUniqueOrThrow({
    where: { id: payload.orderId },
  });
  assertPaymentWebhookMatchesOrder(payload, order);
  return order;
}

export function assertPaymentWebhookMatchesOrder(payload: PaymentWebhookPayload, order: PaymentWebhookOrderSnapshot) {
  if (!order.amount.equals(new Prisma.Decimal(payload.amount))) {
    throw new Error("Payment webhook amount does not match the order");
  }
  if (order.currency.toUpperCase() !== payload.currency) {
    throw new Error("Payment webhook currency does not match the order");
  }
  if (order.paymentMethod !== payload.provider) {
    throw new Error("Payment webhook provider does not match the order payment method");
  }
}
