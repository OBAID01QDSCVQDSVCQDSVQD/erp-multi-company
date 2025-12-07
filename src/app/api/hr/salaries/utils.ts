export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'owing' | 'cancelled';

export function determinePaymentStatus(netSalary: number, advances: number): PaymentStatus {
  if (netSalary < 0) {
    return 'owing';
  }

  if (netSalary === 0) {
    return 'paid';
  }

  if (advances > 0) {
    return 'partial';
  }

  return 'pending';
}






