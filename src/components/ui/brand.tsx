/**
 * Lockup único de Onza: vasito rojo, wordmark y punto rojo, con los SVG oficiales como máscara (el wordmark toma el color
 * del texto; vasito y punto, el rojo de marca). El SVG vigente no trae punto: se agrega acá, en un solo lugar.
 * - hero: acceso de clientes y equipo (vasito arriba, más grande). El contenedor fija --logo-word/--logo-shot/--logo-gap.
 * - header: cabeceras de cliente, equipo y administración (horizontal y compacto).
 */
export function OnzaLogo({
  size = "header",
  className = "",
  label = "Onza",
}: {
  size?: "hero" | "header";
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={`onza-logo onza-logo-${size} ${className}`.trim()}
      role="img"
      aria-label={label}
    >
      <span className="onza-logo-shot" aria-hidden="true" />
      <span className="onza-logo-word" aria-hidden="true">
        <span className="onza-logo-wordmark" />
        <span className="onza-logo-dot" />
      </span>
    </span>
  );
}
