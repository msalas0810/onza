import { getPresence } from "../server/game-service";
import { AvatarView } from "./avatar-view";
import styles from "./game.module.css";

/**
 * «Quién está en el bar»: avatares de quienes marcaron «Estoy acá», activaron compartir y permiten que los vea esta persona.
 * Se oculta sola para cuentas que no participan (invitado, equipo, sin perfil) y ante cualquier error: nunca bloquea el menú.
 */
export async function PresenceStrip({ venueId }: { venueId: string }) {
  let presence;
  try {
    presence = await getPresence(venueId);
  } catch {
    return null;
  }
  if (presence.people.length === 0 && presence.total_active === null) return null;
  return (
    <section className="stack tight" aria-label="Quién está en el bar">
      <h2 className={styles.muted} style={{ margin: 0, fontSize: "1rem" }}>
        Quién está acá{presence.total_active !== null && ` · ${presence.total_active} personas`}
      </h2>
      {presence.people.length > 0 ? (
        <ul className={styles.row} style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {presence.people.map((person) => (
            <li key={person.user_id} title={`@${person.username}`}>
              <AvatarView card={person} size={48} label={`Avatar de @${person.username}`} />
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>Tus amistades que compartan que están acá van a aparecer en este lugar.</p>
      )}
    </section>
  );
}
