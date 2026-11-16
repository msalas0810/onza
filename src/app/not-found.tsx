import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page">
      <h1>No encontramos esta página</h1>
      <p>Revisá el enlace o volvé a explorar.</p>
      <Link className="button primary" href="/">
        Explorar locales
      </Link>
    </div>
  );
}
