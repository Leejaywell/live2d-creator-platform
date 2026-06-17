import { NextRequest, NextResponse } from "next/server";

import { confirmManualOrderFromPaymentProvider } from "@/lib/orders";
import {
  assertPaymentWebhookCanConfirmOrder,
  parsePaymentWebhookPayload,
  paymentWebhookSecret,
  verifyPaymentWebhookSignature,
} from "@/lib/payment-webhooks";
import { jsonError } from "@/lib/request";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    verifyPaymentWebhookSignature(rawBody, request.headers.get("x-signature"), paymentWebhookSecret());
    const payload = parsePaymentWebhookPayload(rawBody);
    await assertPaymentWebhookCanConfirmOrder(payload);
    const order = await confirmManualOrderFromPaymentProvider(payload.orderId, {
      provider: payload.provider,
      eventId: payload.eventId,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    return jsonError(error, "Webhook processing failed");
  }
}
