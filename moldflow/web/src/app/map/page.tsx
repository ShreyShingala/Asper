"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Spinner, StaffShell, cx } from "@/components/ui";
import { PersonPanel, type Person } from "@/components/people";

const TILE = 256;
const project = (lat: number, lon: number, z: number) => {
  const n = 2 ** z * TILE, r = (lat * Math.PI) / 180;
  return { x: ((lon + 180) / 360) * n, y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n };
};

/** Where every customer is (by postal code area), on OpenStreetMap tiles. Click a pin for everything about them. */
export default function MapPage() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { api.get<{ people: Person[] }>("/people/overview").then((d) => { setPeople(d.people); setSel(d.people[0]?.id ?? null); }); }, []);

  const view = useMemo(() => {
    const pts = (people ?? []).filter((p) => p.lat != null && p.lon != null);
    if (!pts.length) return null;
    const lats = pts.map((p) => p.lat!), lons = pts.map((p) => p.lon!);
    const W = 960, H = 560;
    let z = 13;
    while (z > 3) {
      const a = project(Math.max(...lats), Math.min(...lons), z), b = project(Math.min(...lats), Math.max(...lons), z);
      if (b.x - a.x < W * 0.75 && b.y - a.y < H * 0.75) break;
      z--;
    }
    const c = project((Math.max(...lats) + Math.min(...lats)) / 2, (Math.max(...lons) + Math.min(...lons)) / 2, z);
    const ox = c.x - W / 2, oy = c.y - H / 2;
    const tiles = [];
    for (let tx = Math.floor(ox / TILE); tx <= Math.floor((ox + W) / TILE); tx++)
      for (let ty = Math.floor(oy / TILE); ty <= Math.floor((oy + H) / TILE); ty++) tiles.push({ tx, ty, left: tx * TILE - ox, top: ty * TILE - oy });
    const pins = pts.map((p) => { const q = project(p.lat!, p.lon!, z); return { p, left: q.x - ox, top: q.y - oy }; });
    return { z, W, H, tiles, pins };
  }, [people]);

  const person = people?.find((p) => p.id === sel);
  return (
    <StaffShell title="Customer map">
      {!people || !view ? <Spinner label="Loading the map…" /> : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="relative overflow-hidden rounded-ds-sm bg-kit-gray-soft shadow-ds-sm" style={{ height: view.H, maxWidth: view.W }}>
            {view.tiles.map((t) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${t.tx}-${t.ty}`} src={`https://tile.openstreetmap.org/${view.z}/${t.tx}/${t.ty}.png`} alt="" width={TILE} height={TILE}
                className="pointer-events-none absolute select-none" style={{ left: t.left, top: t.top }} />
            ))}
            {view.pins.map(({ p, left, top }) => (
              <button key={p.id} type="button" onClick={() => setSel(p.id)} aria-label={`${p.name}, ${p.address}`} aria-pressed={sel === p.id}
                className="group absolute -translate-x-1/2 -translate-y-full" style={{ left, top }}>
                <span className={cx("block whitespace-nowrap rounded-full px-2.5 py-1 text-caption font-semibold shadow-ds-normal transition",
                  sel === p.id ? "bg-brand text-white" : "bg-white text-ink group-hover:bg-brand-tint")}>
                  {p.name.split(" (")[0]}{p.drafts ? ` · ${p.drafts}` : ""}
                </span>
                <span className={cx("mx-auto block h-3 w-3 -translate-y-0.5 rotate-45", sel === p.id ? "bg-brand" : "bg-white")} />
              </button>
            ))}
            <p className="absolute bottom-1 right-2 rounded bg-white/80 px-1 text-[10px] text-ink-muted">© OpenStreetMap contributors · pins at the postal-code area, not the exact address</p>
          </div>
          {person && <PersonPanel p={person} compact />}
        </div>
      )}
    </StaffShell>
  );
}
