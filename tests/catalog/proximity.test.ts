import { expect, it } from "vitest";
import { rankVenues, distanceKm } from "@/features/catalog/proximity";
const venues = [
  {
    id: "closed",
    name: "A",
    open_state: "closed",
    paused: false,
    latitude: 9.93,
    longitude: -84.08,
  },
  {
    id: "far",
    name: "B",
    open_state: "open",
    paused: false,
    latitude: 10.5,
    longitude: -84,
  },
  {
    id: "unknown",
    name: "C",
    open_state: "open",
    paused: false,
    latitude: null,
    longitude: null,
  },
  {
    id: "near",
    name: "Z",
    open_state: "open",
    paused: false,
    latitude: 9.931,
    longitude: -84.081,
  },
  {
    id: "paused",
    name: "D",
    open_state: "open",
    paused: true,
    latitude: 9.93,
    longitude: -84.08,
  },
];
it("ranks available venues by distance before name, closed last; unknown distances remain honest", () => {
  const ranked = rankVenues(venues, { latitude: 9.93, longitude: -84.08 });
  expect(ranked.map((x) => x.venue.id)).toEqual([
    "near",
    "far",
    "unknown",
    "paused",
    "closed",
  ]);
  expect(ranked[2].distance).toBeNull();
  expect(ranked[0].distance).toBeLessThan(1);
});
it("manual browsing works without coordinates and distances are never invented", () => {
  const ranked = rankVenues(venues, null);
  expect(ranked.map((x) => x.venue.id)).toEqual([
    "far",
    "unknown",
    "near",
    "paused",
    "closed",
  ]);
  expect(ranked.every((x) => x.distance === null)).toBe(true);
  expect(
    distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }),
  ).toBeCloseTo(111.2, 0);
});
