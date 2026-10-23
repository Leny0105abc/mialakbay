import { AppError } from './security';
// A provider adapter must validate signed webhook events against the original raw body,
// match currency/amount/booking server-side, and deduplicate provider event IDs before
// writing the verified ledger. Browser redirects must never write payment receipts.
export interface CardPaymentProvider {
  createCheckout(input: {
    bookingId: string;
    amountCentavos: number;
    currency: 'PHP';
    idempotencyKey: string;
  }): Promise<{ url: string }>;
  verifyWebhook(
    rawBody: Uint8Array,
    signature: string,
  ): Promise<{
    eventId: string;
    bookingId: string;
    amountCentavos: number;
    currency: 'PHP';
    paid: boolean;
  }>;
}
export function getCardProvider(): CardPaymentProvider {
  throw new AppError(
    'Online card payments are disabled. No payment provider adapter is configured.',
    503,
  );
}
