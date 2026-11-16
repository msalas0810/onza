/** Design contract only. This is not a BAC API or a working integration. */
export type Money = Readonly<{ amountMinor: number; currency: 'CRC' | 'USD' }>;
export type ProviderState =
  | 'requires_action' | 'authorized' | 'capture_pending' | 'captured'
  | 'voided' | 'refunded' | 'declined' | 'unknown';
export type ProviderResult = Readonly<{
  reference?: string; // May be absent if the first response was lost.
  state: ProviderState;
  amount: Money;
  expiresAt?: string;
  action?: { type: 'redirect'; url: string };
}>;
export type OperationContext = Readonly<{
  orderId: string;
  operationId: string; // Durable operation record created before the call.
  merchantConfigRef: string; // Server-resolved, never trusted from browser.
  idempotencyKey: string;
}>;
export interface PaymentProvider {
  readonly kind: 'mock' | 'bac';
  authorize(input: OperationContext & { amount: Money }): Promise<ProviderResult>;
  capture(input: OperationContext & { reference: string; amount: Money }): Promise<ProviderResult>;
  voidAuthorization(input: OperationContext & { reference: string }): Promise<ProviderResult>;
  refund(input: OperationContext & { reference: string; amount: Money }): Promise<ProviderResult>;
  getStatus(input: Readonly<{
    merchantConfigRef: string;
    operationId: string;
    idempotencyKey: string;
    reference?: string;
  }>): Promise<ProviderResult>;
}
// Query by operation/key is a desired capability, not an assertion that BAC
// supports it. Without a usable lookup, return unknown and require controlled
// reconciliation; do not re-authorize blindly when the reference was lost.
// Provider event verification is intentionally unspecified until the assigned
// gateway manual defines its authentication, signature/hash and replay rules.
// Validate integer minor amounts, currency, actor, venue and authorization on
// the backend. A timeout is unknown, never an automatic safe-to-retry decline.
