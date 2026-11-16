import { StaffLogin } from "@/features/staff/components/login";
export default function Page() {
  return (
    <div className="page">
      <p className="eyebrow">Equipo del local</p>
      <h1>Acceso de personal</h1>
      <StaffLogin />
    </div>
  );
}
