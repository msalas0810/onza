import { Checkout } from "@/features/orders/components/checkout";
import { accountsRequired, guestsAllowed } from "@/lib/access-policy";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <div className="page">
      <Checkout accounts={accountsRequired()} guests={guestsAllowed()} />
    </div>
  );
}
