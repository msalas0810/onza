export default function Loading() {
  return (
    <div className="page wide" role="status" aria-busy="true" aria-label="Cargando">
      <div className="sk" style={{ height: 38, width: 180 }} />
      <div className="vgrid three" style={{ marginTop: 32 }}>
        {[1, 2, 3].map((n) => (
          <div className="stack" style={{ gap: 12 }} key={n}>
            <div className="sk ratio-16x9" style={{ borderRadius: 16 }} />
            <div className="sk" style={{ height: 22, width: "60%" }} />
            <div className="sk" style={{ height: 14, width: "80%" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
