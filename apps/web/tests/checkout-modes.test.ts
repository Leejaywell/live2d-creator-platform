import assert from "node:assert/strict";
import test from "node:test";

import { OrderType } from "@prisma/client";

import {
  assertManualOrderAllowedForCheckout,
  checkoutModeLabel,
  manualOrderCheckoutHint,
  resolveManualOrderType,
} from "../src/lib/checkout-modes";

test("checkout mode labels describe commercial source of truth", () => {
  assert.equal(checkoutModeLabel("manual-only"), "Manual only");
  assert.match(manualOrderCheckoutHint("provider-live"), /预设套餐/);
});

test("manual checkout allows only package orders", () => {
  assert.doesNotThrow(() => assertManualOrderAllowedForCheckout("manual-only", { orderType: OrderType.plan }));
  assert.doesNotThrow(() => assertManualOrderAllowedForCheckout("manual-only", { orderType: OrderType.fan_code_pack }));
  assert.throws(
    () => assertManualOrderAllowedForCheckout("manual-only", { orderType: OrderType.quota_adjustment }),
    /quota grants/,
  );
});

test("provider checkout keeps the same package-order rule", () => {
  assert.equal(resolveManualOrderType({ planName: "Pro" }), OrderType.plan);
  assert.equal(resolveManualOrderType({}), OrderType.quota_adjustment);
  assert.doesNotThrow(() => assertManualOrderAllowedForCheckout("provider-sandbox", { orderType: OrderType.plan }));
  assert.throws(
    () => assertManualOrderAllowedForCheckout("provider-live", { orderType: OrderType.quota_adjustment }),
    /quota grants/,
  );
});
