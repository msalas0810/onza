type Searchable = { name: string; zone: string };
export type Suggestion = {
  kind: "venue" | "zone";
  value: string;
  hint: string;
};
/** Minúsculas y sin tildes: «escalante» encuentra «Barrio Escalante» y «cafe» encuentra «Café». */
export const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-CR")
    .trim();
/** Un local coincide si cada palabra buscada aparece en su nombre o su barrio/ciudad. */
export function matchesQuery(venue: Searchable, query: string) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = normalize(`${venue.name} ${venue.zone}`);
  return words.every((word) => haystack.includes(word));
}
/** Sugerencias debajo del buscador: locales por nombre primero, después barrios o ciudades con su cantidad de locales. */
export function suggestVenues<T extends Searchable>(
  venues: T[],
  draft: string,
  limit = 6,
): Suggestion[] {
  const term = normalize(draft);
  if (!term) return [];
  const starts = (text: string) =>
    normalize(text)
      .split(/\s+/)
      .some((word) => word.startsWith(term)) || normalize(text).startsWith(term);
  const byName = venues
    .filter((v) => normalize(v.name).includes(term))
    .sort(
      (a, b) =>
        Number(starts(b.name)) - Number(starts(a.name)) ||
        a.name.localeCompare(b.name, "es"),
    )
    .map((v) => ({ kind: "venue" as const, value: v.name, hint: v.zone.trim() }));
  const zones = new Map<string, number>();
  for (const v of venues) {
    const zone = v.zone.trim();
    if (zone && normalize(zone).includes(term))
      zones.set(zone, (zones.get(zone) ?? 0) + 1);
  }
  const byZone = [...zones.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .map(([zone, count]) => ({
      kind: "zone" as const,
      value: zone,
      hint: count === 1 ? "1 local" : `${count} locales`,
    }));
  return [...byName, ...byZone].slice(0, limit);
}
