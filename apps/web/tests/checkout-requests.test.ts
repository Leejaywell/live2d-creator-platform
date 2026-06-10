import assert from "node:assert/strict";
import test from "node:test";

import { PaymentMethod } from "@prisma/client";

import {
  assertCheckoutRequestAllowed,
  assertCheckoutUrlTemplate,
  buildCheckoutUrl,
  checkoutOrderPeriod,
  checkoutProductForSku,
  checkoutSkuFromOrderNotes,
} from "../src/lib/checkout-products";

test("checkout products expose payable quota impact", () => {
  const product = checkoutProductForSku("pro-monthly");

  assert.equal(product?.amount, "399.00");
  assert.equal(product?.currency, "CNY");
  assert.equal(product?.paymentMethods.includes(PaymentMethod.wechat), true);
  assert.equal(product?.projectQuotaDelta, 3);
  assert.equal(product?.aiMessageQuotaDelta, 10000);
});

test("checkout request mode rejects manual-only commercial flow", () => {
  assert.throws(() => assertCheckoutRequestAllowed("manual-only"), /manual-only/);
  assert.doesNotThrow(() => assertCheckoutRequestAllowed("provider-sandbox"));
  assert.doesNotThrow(() => assertCheckoutRequestAllowed("provider-live"));
});

test("checkout order period uses whole UTC days for subscription products", () => {
  const product = checkoutProductForSku("starter-monthly");
  assert.ok(product);

  const period = checkoutOrderPeriod(product, new Date("2026-06-10T12:00:00.000Z"));

  assert.equal(period.periodStart?.toISOString(), "2026-06-10T12:00:00.000Z");
  assert.equal(period.periodEnd?.toISOString(), "2026-07-10T12:00:00.000Z");
});

test("checkout URL template substitutes order id when configured", () => {
  const previous = process.env.PAYMENT_CHECKOUT_URL_TEMPLATE;
  process.env.PAYMENT_CHECKOUT_URL_TEMPLATE = "https://pay.example/checkout?order={orderId}";

  try {
    assert.equal(buildCheckoutUrl("order 1"), "https://pay.example/checkout?order=order%201");
  } finally {
    if (previous === undefined) {
      delete process.env.PAYMENT_CHECKOUT_URL_TEMPLATE;
    } else {
      process.env.PAYMENT_CHECKOUT_URL_TEMPLATE = previous;
    }
  }
});

test("checkout URL template requires HTTPS and order interpolation", () => {
  assert.doesNotThrow(() => assertCheckoutUrlTemplate("https://pay.example/checkout?order={orderId}"));
  assert.throws(() => assertCheckoutUrlTemplate("http://pay.example/checkout?order={orderId}"), /HTTPS/);
  assert.throws(() => assertCheckoutUrlTemplate("https://pay.example/checkout"), /orderId/);
  assert.throws(() => assertCheckoutUrlTemplate("not-a-url-{orderId}"), /valid absolute URL/);
});

test("checkout SKU is recovered only from supported checkout order notes", () => {
  assert.equal(checkoutSkuFromOrderNotes("Checkout request: pro-monthly"), "pro-monthly");
  assert.equal(checkoutSkuFromOrderNotes("Checkout request: unknown"), undefined);
  assert.equal(checkoutSkuFromOrderNotes("Manual order from support"), undefined);
});
