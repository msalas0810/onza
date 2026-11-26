"use client";
import { groupSpots, type Spot } from "../types";

/** Con pocos lugares, botones grandes agrupados por zona; con muchos, una lista desplegable por zona. */
const CHIP_LIMIT = 16;

export function SpotPicker({
  spots,
  noun,
  value,
  onChange,
  name = "spot",
}: {
  spots: Spot[];
  noun: string;
  value: string | null;
  onChange: (spotId: string) => void;
  name?: string;
}) {
  const groups = groupSpots(spots.filter((spot) => spot.enabled));
  const total = groups.reduce((n, g) => n + g.spots.length, 0);
  if (!total)
    return (
      <p className="muted t-label" role="status">
        Este local todavía no tiene lugares habilitados.
      </p>
    );
  if (total > CHIP_LIMIT)
    return (
      <label className="field">
        <span>{noun}</span>
        <select
          name={name}
          value={value ?? ""}
          onChange={(e) => e.target.value && onChange(e.target.value)}
        >
          <option value="">Elegí tu {noun.toLowerCase()}</option>
          {groups.map((group) =>
            group.area ? (
              <optgroup key={group.area} label={group.area}>
                {group.spots.map((spot) => (
                  <option key={spot.id} value={spot.id}>
                    {spot.label}
                  </option>
                ))}
              </optgroup>
            ) : (
              group.spots.map((spot) => (
                <option key={spot.id} value={spot.id}>
                  {spot.label}
                </option>
              ))
            ),
          )}
        </select>
      </label>
    );
  return (
    <div className="spot-groups">
      {groups.map((group) => (
        <fieldset className="spot-group" key={group.area || "_"}>
          <legend className="t-label">{group.area || noun}</legend>
          <div className="spot-grid">
            {group.spots.map((spot) => (
              <label className="spot" key={spot.id}>
                <input
                  type="radio"
                  name={name}
                  value={spot.id}
                  checked={value === spot.id}
                  onChange={() => onChange(spot.id)}
                />
                <span>{spot.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
