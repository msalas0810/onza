import { Checkout } from "@/features/orders/components/checkout";
import { accountsRequired } from "@/lib/access-policy";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <div className="page">
      <Checkout accounts={accountsRequired()} />
    </div>
  );
}
