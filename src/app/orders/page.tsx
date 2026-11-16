import { OrderList } from "@/features/orders/components/order-list";
export default function Page() {
  return (
    <div className="page">
      <h1>Mis pedidos</h1>
      <OrderList />
    </div>
  );
}
