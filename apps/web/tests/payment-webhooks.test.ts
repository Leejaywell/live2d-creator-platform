import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { Prisma } from "@prisma/client";

import {
  assertPaymentWebhookMatchesOrder,
  parsePaymentWebhookPayload,
  verifyPaymentWebhookSignature,
} from "../src/lib/payment-webhooks";

test("verifyPaymentWebhookSignature accepts valid HMAC signatures", () => {
  const rawBody = JSON.stringify({ orderId: "order_1" });
  const secret = "payment-webhook-secret-value";
  const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  assert.doesNotThrow(() => verifyPaymentWebhookSignature(rawBody, `sha256=${signature}`, secret));
});

test("verifyPaymentWebhookSignature rejects missing or invalid signatures", () => {
  const rawBody = JSON.stringify({ orderId: "order_1" });
  const secret = "payment-webhook-secret-value";

  assert.throws(() => verifyPaymentWebhookSignature(rawBody, null, secret), /Missing/);
  assert.throws(() => verifyPaymentWebhookSignature(rawBody, "not-a-signature", secret), /format/);
  assert.throws(() => verifyPaymentWebhookSignature(rawBody, "0".repeat(64), secret), /Invalid payment webhook signature/);
});

test("parsePaymentWebhookPayload accepts confirmed payment events", () => {
  assert.deepEqual(
    parsePaymentWebhookPayload(
      JSON.stringify({
        provider: "alipay",
        eventId: "evt_1",
        orderId: "order_1",
        paymentStatus: "confirmed",
        amount: "399.00",
        currency: "cny",
      }),
    ),
    {
      provider: "alipay",
      eventId: "evt_1",
      orderId: "order_1",
      paymentStatus: "confirmed",
      amount: "399.00",
      currency: "CNY",
    },
  );
});

test("parsePaymentWebhookPayload rejects incomplete or non-confirmed events", () => {
  assert.throws(() => parsePaymentWebhookPayload(JSON.stringify({ orderId: "order_1" })), /missing/);
  assert.throws(
    () =>
      parsePaymentWebhookPayload(
        JSON.stringify({
          provider: "alipay",
          orderId: "order_1",
          paymentStatus: "pending",
          amount: "399.00",
          currency: "CNY",
        }),
      ),
    /not confirmable/,
  );
});

test("assertPaymentWebhookMatchesOrder checks amount, currency, and provider for idempotent webhooks", () => {
  const payload = {
    provider: "alipay",
    orderId: "order_1",
    paymentStatus: "confirmed",
    amount: "399.00",
    currency: "CNY",
  };
  const order = {
    amount: new Prisma.Decimal("399"),
    currency: "cny",
    paymentMethod: "alipay",
  };

  assert.doesNotThrow(() => assertPaymentWebhookMatchesOrder(payload, order));
  assert.throws(() => assertPaymentWebhookMatchesOrder({ ...payload, amount: "398.99" }, order), /amount/);
  assert.throws(() => assertPaymentWebhookMatchesOrder({ ...payload, currency: "USD" }, order), /currency/);
  assert.throws(() => assertPaymentWebhookMatchesOrder({ ...payload, provider: "other" }, order), /provider/);
});
