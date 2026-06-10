import { PaymentStatus } from "@prisma/client";

export function assertOrderCanBeVoided(order: { paymentStatus: PaymentStatus | string }) {
  if (order.paymentStatus !== PaymentStatus.pending) {
    throw new Error("Only pending orders can be voided");
  }
}

export function assertOrderCanBeRefunded(order: { paymentStatus: PaymentStatus | string }) {
  if (order.paymentStatus !== PaymentStatus.confirmed) {
    throw new Error("Only confirmed orders can be refunded");
  }
}
