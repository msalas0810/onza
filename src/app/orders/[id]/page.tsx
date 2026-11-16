import { OrderDetail } from "@/features/orders/components/order-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="page">
      <OrderDetail id={id} />
    </div>
  );
}
