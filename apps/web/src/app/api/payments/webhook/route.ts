import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { confirmManualOrderFromPaymentProvider } from "@/lib/orders";
import {
  assertPaymentWebhookCanConfirmOrder,
  parsePaymentWebhookPayload,
  paymentWebhookSecret,
  verifyPaymentWebhookSignature,
} from "@/lib/payment-webhooks";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/request";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    verifyPaymentWebhookSignature(rawBody, request.headers.get("x-signature"), paymentWebhookSecret());
    const payload = parsePaymentWebhookPayload(rawBody);
    await assertPaymentWebhookCanConfirmOrder(payload);

    // Idempotency / replay protection: record the eventId before processing.
    // A replayed (validly signed) event will collide on the unique eventId and
    // is acknowledged without re-confirming the order.
    if (payload.eventId) {
      const eventId = payload.eventId;
      try {
        await prisma.$transaction(async (tx) => {
          await tx.processedWebhookEvent.create({
            data: { eventId, provider: payload.provider },
          });
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return NextResponse.json({ ok: true, duplicate: true });
        }
        throw error;
      }
    }

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
