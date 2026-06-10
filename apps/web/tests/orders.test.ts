import assert from "node:assert/strict";
import test from "node:test";

import { assertOrderCanBeRefunded, assertOrderCanBeVoided } from "../src/lib/order-transitions";

test("order void transition only accepts pending orders", () => {
  assert.doesNotThrow(() => assertOrderCanBeVoided({ paymentStatus: "pending" }));
  assert.throws(() => assertOrderCanBeVoided({ paymentStatus: "confirmed" }), /pending/);
  assert.throws(() => assertOrderCanBeVoided({ paymentStatus: "refunded" }), /pending/);
  assert.throws(() => assertOrderCanBeVoided({ paymentStatus: "void" }), /pending/);
});

test("order refund transition only accepts confirmed orders", () => {
  assert.doesNotThrow(() => assertOrderCanBeRefunded({ paymentStatus: "confirmed" }));
  assert.throws(() => assertOrderCanBeRefunded({ paymentStatus: "pending" }), /confirmed/);
  assert.throws(() => assertOrderCanBeRefunded({ paymentStatus: "refunded" }), /confirmed/);
  assert.throws(() => assertOrderCanBeRefunded({ paymentStatus: "void" }), /confirmed/);
});
