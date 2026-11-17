import { OrderList } from "@/features/orders/components/order-list";
export default function Page() {
  return (
    <div className="page">
      <div className="page-head">
        <h1>Pedidos</h1>
      </div>
      <OrderList />
    </div>
  );
}
