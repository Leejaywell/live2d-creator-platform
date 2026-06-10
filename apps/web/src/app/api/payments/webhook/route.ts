import { NextRequest, NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";

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
    verifyPaymentWebhookSignature(rawBody, request.headers.get("x-live2d-payment-signature"), paymentWebhookSecret());
    const payload = parsePaymentWebhookPayload(rawBody);
    const order = await assertPaymentWebhookCanConfirmOrder(payload);

    if (order.paymentStatus === PaymentStatus.confirmed) {
      return NextResponse.json({ order, idempotent: true });
    }

    const confirmedOrder = await confirmManualOrderFromPaymentProvider(payload.orderId, {
      provider: payload.provider,
      eventId: payload.eventId,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });
    return NextResponse.json({ order: confirmedOrder });
  } catch (error) {
    return jsonError(error, "Payment webhook failed");
  }
}
