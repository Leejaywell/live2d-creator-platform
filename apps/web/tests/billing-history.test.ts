import assert from "node:assert/strict";
import test from "node:test";

import {
  formatOrderAmount,
  ledgerEntryTypeLabel,
  manualOrderPeriodLabel,
  manualOrderQuotaImpactLabel,
  orderStatusLabel,
  orderTypeLabel,
  paymentStatusTone,
  quotaResourceLabel,
  signedAmount,
} from "../src/lib/billing-history";

test("billing labels describe manual order states", () => {
  assert.equal(orderStatusLabel("pending"), "Pending payment");
  assert.equal(orderStatusLabel("confirmed"), "Confirmed");
  assert.equal(orderTypeLabel("fan_code_pack"), "Fan-code pack");
  assert.equal(paymentStatusTone("confirmed"), "good");
  assert.equal(paymentStatusTone("pending"), "warn");
});

test("quota ledger labels describe resource and entry type", () => {
  assert.equal(quotaResourceLabel("ai_messages"), "AI messages");
  assert.equal(quotaResourceLabel("storage_mb"), "storage_mb");
  assert.equal(ledgerEntryTypeLabel("consume"), "Consume");
  assert.equal(ledgerEntryTypeLabel("expiration_reset"), "Expiration reset");
});

test("format helpers display money and signed quota amounts", () => {
  assert.equal(formatOrderAmount({ amount: { toString: () => "399.00" }, currency: "CNY" }), "399.00 CNY");
  assert.equal(signedAmount(100), "+100");
  assert.equal(signedAmount(-1), "-1");
  assert.equal(signedAmount(0), "0");
});

test("manual order helpers describe period and quota impact", () => {
  assert.equal(manualOrderPeriodLabel({}), "Default plan period");
  assert.equal(
    manualOrderPeriodLabel({
      periodStart: new Date("2026-06-01T00:00:00.000Z"),
      periodEnd: new Date("2026-07-01T00:00:00.000Z"),
    }),
    "2026-06-01 to 2026-07-01",
  );
  assert.equal(
    manualOrderQuotaImpactLabel({
      projectQuotaDelta: 1,
      aiMessageQuotaDelta: 500,
      storageQuotaDeltaMb: 0,
      fanCodeQuotaDelta: -2,
    }),
    "+1 projects · +500 AI messages · -2 fan codes",
  );
  assert.equal(
    manualOrderQuotaImpactLabel({
      projectQuotaDelta: 0,
      aiMessageQuotaDelta: 0,
      storageQuotaDeltaMb: 0,
      fanCodeQuotaDelta: 0,
    }),
    "No quota change",
  );
});
