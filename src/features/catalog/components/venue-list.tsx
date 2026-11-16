"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Venue } from "../server/queries";
import { TextField, StatusBadge, EmptyState } from "@/components/ui/primitives";
import { CartDock } from "@/features/orders/components/cart-dock";
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
        {visible.map((v) => (
          <Link className="venue-link" key={v.id} href={`/v/${v.slug}`}>
            <div className="venue-art">
              <Image
                unoptimized
                src="/brand/onza-shot.svg"
                width={48}
                height={64}
                alt=""
              />
            </div>
            <div className="row between">
              <h2>{v.name}</h2>
              <StatusBadge
                tone={
                  v.open_state === "open" && !v.paused ? "success" : "neutral"
                }
              >
                {v.open_state === "closed"
                  ? "Cerrado"
                  : v.paused
                    ? "Pausado"
                    : "Abierto"}
              </StatusBadge>
            </div>
            <p className="muted">
              {v.zone} · {v.pickup_label}
            </p>
            <span className="link-button">Ver menú →</span>
          </Link>
        ))}
      </div>
      {!visible.length && (
        <EmptyState title="Sin resultados">Probá con otro nombre.</EmptyState>
      )}
      <CartDock />
    </>
  );
}
