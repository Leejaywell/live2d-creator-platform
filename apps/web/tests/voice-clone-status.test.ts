import assert from "node:assert/strict";
import test from "node:test";

import {
  initialVoiceCloneStatusForFulfillment,
  voiceCloneFulfillmentLabel,
  voiceCloneNextStep,
  voiceCloneStatusLabel,
  voiceCloneStatusTone,
} from "../src/lib/voice-clone-status";

test("voice clone status labels cover the request lifecycle", () => {
  assert.equal(voiceCloneStatusLabel("submitted"), "Submitted");
  assert.equal(voiceCloneStatusLabel("reviewing"), "In review");
  assert.equal(voiceCloneStatusLabel("approved"), "Approved");
  assert.equal(voiceCloneStatusLabel("rejected"), "Rejected");
  assert.equal(voiceCloneStatusLabel("fulfilled"), "Fulfilled");
});

test("voice clone status tone maps statuses to dashboard states", () => {
  assert.equal(voiceCloneStatusTone("submitted"), "warn");
  assert.equal(voiceCloneStatusTone("reviewing"), "warn");
  assert.equal(voiceCloneStatusTone("approved"), "good");
  assert.equal(voiceCloneStatusTone("fulfilled"), "good");
  assert.equal(voiceCloneStatusTone("rejected"), "bad");
});

test("voiceCloneNextStep gives creators a clear status explanation", () => {
  assert.match(voiceCloneNextStep("submitted"), /Waiting/);
  assert.match(voiceCloneNextStep("reviewing"), /Ops/);
  assert.match(voiceCloneNextStep("fulfilled"), /voice assets/);
});

test("voice clone fulfillment modes map to request behavior", () => {
  assert.equal(initialVoiceCloneStatusForFulfillment("manual-review"), "submitted");
  assert.equal(initialVoiceCloneStatusForFulfillment("provider-sandbox"), "reviewing");
  assert.equal(initialVoiceCloneStatusForFulfillment("provider-live"), "reviewing");
  assert.throws(() => initialVoiceCloneStatusForFulfillment("disabled"), /disabled/);
  assert.equal(voiceCloneFulfillmentLabel("provider-live"), "Provider live");
});
