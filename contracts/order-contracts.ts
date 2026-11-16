/** Proposed application contracts. IDs are opaque UUID strings at runtime. */
export type ActorContext = Readonly<{
  userId: string;
  staffSessionId?: string;
}>; // Backend resolves permissions, never trusts browser-supplied roles.
export type OrderStatus = 'pending_authorization' | 'queued' | 'preparing' |
  'ready' | 'delivered' | 'canceled' | 'expired' | 'uncollected';
export type PaymentStatus = 'authorizing' | 'authorized' | 'capture_pending' |
  'captured' | 'void_pending' | 'voided' | 'failed' | 'unknown' |
  'refund_pending' | 'refunded';
export type CreateOrderInput = Readonly<{
  venueId: string;
  items: readonly { productId: string; quantity: number; expectedProductVersion: number }[];
  idempotencyKey: string;
  termsVersion: string;
  privacyVersion: string;
}>;
export type OrderView = Readonly<{
  id: string;
  venueId: string;
  status: OrderStatus;
  totalMinor: number;
  currency: 'CRC' | 'USD';
  version: number;
  paymentState: PaymentStatus;
}>;
export type StateCommand = Readonly<{
  orderId: string;
  expectedVersion: number;
  idempotencyKey: string;
}>;
// Implement in server-only services; declarations here document boundaries.
export interface OrderService {
  createOrder(actor: ActorContext, input: CreateOrderInput): Promise<OrderView>;
  acceptOrder(actor: ActorContext, input: StateCommand): Promise<OrderView>;
  readyOrder(actor: ActorContext, input: StateCommand): Promise<OrderView>;
  cancelOrder(actor: ActorContext, input: StateCommand & { reason: string }): Promise<OrderView>;
}
