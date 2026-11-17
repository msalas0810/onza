import Link from "next/link";
import { buttonClass } from "@/components/ui/primitives";
export default function NotFound() {
  return (
    <div className="page">
      <div className="state">
        <h1 className="t-title">No encontramos esta página</h1>
        <p>Revisá el enlace o volvé a explorar.</p>
        <Link className={buttonClass()} href="/">
          Explorar locales
        </Link>
      </div>
    </div>
  );
}
