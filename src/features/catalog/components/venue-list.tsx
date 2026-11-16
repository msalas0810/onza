"use client";
import { useState } from "react";
import type { Venue } from "../server/queries";
import { TextField, EmptyState } from "@/components/ui/primitives";
import { CartDock } from "@/features/orders/components/cart-dock";
import { VenueCard } from "./venue-card";
export function VenueList({ venues }: { venues: Venue[] }) {
  const [search, setSearch] = useState("");
  const visible = venues.filter((v) =>
    v.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <>
      <div className="stack">
        <TextField
          label="Buscar local"
          placeholder="Nombre del local"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="venue-list">
        {visible.map((v, index) => (
          <VenueCard key={v.id} venue={v} eager={index < 2} />
        ))}
      </div>
      {!visible.length && (
        <EmptyState title="Sin resultados">Probá con otro nombre.</EmptyState>
      )}
      <CartDock />
    </>
  );
}
