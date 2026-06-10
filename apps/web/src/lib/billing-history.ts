import { LedgerEntryType, OrderType, PaymentStatus, QuotaResource } from "@prisma/client";

export function formatOrderAmount(input: { amount: { toString(): string }; currency: string }) {
  return `${input.amount.toString()} ${input.currency}`;
}

export function orderStatusLabel(status: PaymentStatus | string) {
  switch (status) {
    case "pending":
      return "Pending payment";
    case "confirmed":
      return "Confirmed";
    case "refunded":
      return "Refunded";
    case "void":
      return "Void";
    default:
      return String(status);
  }
}

export function orderTypeLabel(type: OrderType | string) {
  switch (type) {
    case "plan":
      return "Plan";
    case "fan_code_pack":
      return "Fan-code pack";
    case "quota_adjustment":
      return "Quota adjustment";
    default:
      return String(type);
  }
}

export function paymentStatusTone(status: PaymentStatus | string): "good" | "warn" | "bad" | "neutral" {
  switch (status) {
    case "confirmed":
      return "good";
    case "pending":
      return "warn";
    case "refunded":
    case "void":
      return "bad";
    default:
      return "neutral";
  }
}

export function quotaResourceLabel(resource: QuotaResource | string) {
  switch (resource) {
    case "ai_messages":
      return "AI messages";
    case "fan_codes":
      return "Fan codes";
    case "storage_mb":
      return "Storage MB";
    case "projects":
      return "Projects";
    default:
      return String(resource);
  }
}

export function ledgerEntryTypeLabel(type: LedgerEntryType | string) {
  switch (type) {
    case "grant":
      return "Grant";
    case "consume":
      return "Consume";
    case "adjustment":
      return "Adjustment";
    case "expiration_reset":
      return "Expiration reset";
    default:
      return String(type);
  }
}

export function signedAmount(amount: number) {
  return amount > 0 ? `+${amount}` : String(amount);
}

export function manualOrderPeriodLabel(input: { periodStart?: Date | null; periodEnd?: Date | null }) {
  if (!input.periodStart && !input.periodEnd) {
    return "Default plan period";
  }

  const start = input.periodStart ? input.periodStart.toISOString().slice(0, 10) : "default start";
  const end = input.periodEnd ? input.periodEnd.toISOString().slice(0, 10) : "default end";
  return `${start} to ${end}`;
}

export function manualOrderQuotaImpactLabel(input: {
  projectQuotaDelta: number;
  aiMessageQuotaDelta: number;
  storageQuotaDeltaMb: number;
  fanCodeQuotaDelta: number;
}) {
  const parts = [
    input.projectQuotaDelta ? `${signedAmount(input.projectQuotaDelta)} projects` : "",
    input.aiMessageQuotaDelta ? `${signedAmount(input.aiMessageQuotaDelta)} AI messages` : "",
    input.storageQuotaDeltaMb ? `${signedAmount(input.storageQuotaDeltaMb)} storage MB` : "",
    input.fanCodeQuotaDelta ? `${signedAmount(input.fanCodeQuotaDelta)} fan codes` : "",
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : "No quota change";
}
