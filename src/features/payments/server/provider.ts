import "server-only";
import type {
  PaymentProvider,
  OperationContext,
  Money,
  ProviderResult,
} from "../../../../contracts/payment-provider";
export function assertMockPayments() {
  if (
    process.env.PAYMENT_PROVIDER !== "mock" ||
    process.env.REAL_PAYMENTS_ENABLED !== "false" ||
    process.env.DEMO_MODE !== "true"
  )
    throw new Error("PROVIDER_NOT_CONFIGURED");
}
/** Simulated payment outcomes exist for automated tests only (ENABLE_PAYMENT_SCENARIOS=true). */
export function scenariosEnabled() {
  return process.env.ENABLE_PAYMENT_SCENARIOS === "true";
}
/** Durable mock operations are implemented by private.payment_operations inside onza_command.
 * No in-memory ledger is used and no bank calls are made. */
export class BacPaymentProvider implements PaymentProvider {
  readonly kind = "bac" as const;
  private unavailable(): Promise<ProviderResult> {
    return Promise.reject(new Error("PROVIDER_NOT_CONFIGURED"));
  }
  authorize(_input: OperationContext & { amount: Money }) {
    void _input;
    return this.unavailable();
  }
  capture(_input: OperationContext & { reference: string; amount: Money }) {
    void _input;
    return this.unavailable();
  }
  voidAuthorization(_input: OperationContext & { reference: string }) {
    void _input;
    return this.unavailable();
  }
  refund(_input: OperationContext & { reference: string; amount: Money }) {
    void _input;
    return this.unavailable();
  }
  getStatus(_input: {
    merchantConfigRef: string;
    operationId: string;
    idempotencyKey: string;
    reference?: string;
  }) {
    void _input;
    return this.unavailable();
  }
}
