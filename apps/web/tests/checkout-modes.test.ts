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
  assert.match(manualOrderCheckoutHint("provider-live"), /Provider checkout/);
});

test("manual-only checkout allows plan and quota manual orders", () => {
  assert.doesNotThrow(() => assertManualOrderAllowedForCheckout("manual-only", { orderType: OrderType.plan }));
  assert.doesNotThrow(() => assertManualOrderAllowedForCheckout("manual-only", { orderType: OrderType.fan_code_pack }));
  assert.doesNotThrow(() => assertManualOrderAllowedForCheckout("manual-only", { orderType: OrderType.quota_adjustment }));
});

test("provider checkout allows only quota-adjustment manual orders", () => {
  assert.equal(resolveManualOrderType({ planName: "Pro" }), OrderType.plan);
  assert.equal(resolveManualOrderType({}), OrderType.quota_adjustment);
  assert.doesNotThrow(() => assertManualOrderAllowedForCheckout("provider-live", { orderType: OrderType.quota_adjustment }));
  assert.throws(
    () => assertManualOrderAllowedForCheckout("provider-sandbox", { orderType: OrderType.plan }),
    /checkout provider mode/,
  );
  assert.throws(
    () => assertManualOrderAllowedForCheckout("provider-live", { orderType: OrderType.fan_code_pack }),
    /checkout provider mode/,
  );
});
