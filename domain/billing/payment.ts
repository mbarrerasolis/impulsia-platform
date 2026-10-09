export type PaymentStatus = "pending" | "approved" | "rejected" | "refunded" | "cancelled";

const transitions: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ["approved", "rejected", "cancelled"],
  approved: ["refunded"],
  rejected: ["pending", "cancelled"],
  refunded: [],
  cancelled: []
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus) {
  return from === to || transitions[from].includes(to);
}

export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus) {
  if (!canTransitionPayment(from, to)) {
    throw new Error(`Transición de pago inválida: ${from} -> ${to}`);
  }
}
