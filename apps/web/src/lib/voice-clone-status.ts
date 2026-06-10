import { VoiceCloneStatus } from "@prisma/client";

export type VoiceCloneFulfillmentMode = "manual-review" | "provider-sandbox" | "provider-live" | "disabled";

export function initialVoiceCloneStatusForFulfillment(mode: VoiceCloneFulfillmentMode): VoiceCloneStatus {
  switch (mode) {
    case "manual-review":
      return "submitted";
    case "provider-sandbox":
    case "provider-live":
      return "reviewing";
    case "disabled":
      throw new Error("Voice cloning is disabled for this platform");
  }
}

export function voiceCloneFulfillmentLabel(mode: VoiceCloneFulfillmentMode) {
  switch (mode) {
    case "manual-review":
      return "Manual review";
    case "provider-sandbox":
      return "Provider sandbox";
    case "provider-live":
      return "Provider live";
    case "disabled":
      return "Disabled";
  }
}

export function voiceCloneStatusLabel(status: VoiceCloneStatus | string) {
  switch (status) {
    case "submitted":
      return "Submitted";
    case "reviewing":
      return "In review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "fulfilled":
      return "Fulfilled";
    default:
      return String(status);
  }
}

export function voiceCloneStatusTone(status: VoiceCloneStatus | string): "good" | "warn" | "bad" | "neutral" {
  switch (status) {
    case "approved":
    case "fulfilled":
      return "good";
    case "rejected":
      return "bad";
    case "submitted":
    case "reviewing":
      return "warn";
    default:
      return "neutral";
  }
}

export function voiceCloneNextStep(status: VoiceCloneStatus | string) {
  switch (status) {
    case "submitted":
      return "Waiting for ops review.";
    case "reviewing":
      return "Ops is checking authorization and source material.";
    case "approved":
      return "Approved for manual follow-up.";
    case "rejected":
      return "Rejected. Check notes or contact support before submitting again.";
    case "fulfilled":
      return "Fulfilled. Check voice assets for delivered clips.";
    default:
      return "Status update pending.";
  }
}
