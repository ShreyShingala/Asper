"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { CalendarClock, MapPin, MessageSquare, Phone, Sparkles } from "lucide-react";
import { photoUrl } from "@/lib/api";
import { Card, Eyebrow, Spinner, StaffShell, Tag, cx } from "@/components/ui";
import { Conversation, Learned, type Person } from "@/components/people";

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
    const W = 720, H = 520;
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
    <StaffShell>
      <header className="mb-5">
        <Eyebrow color="text-brand">Customer map</Eyebrow>
        <h1 className="mt-1 text-[24px] font-semibold leading-tight text-ink">Where every customer is</h1>
        <p className="mt-1 max-w-2xl text-subtitle font-light text-ink-body">Pins sit at each customer&apos;s postal-code area. Click one to read the conversation and what the agent has learned about them.</p>
      </header>
      {!people || !view ? <Spinner label="Loading the map…" /> : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="min-w-0 space-y-4">
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
            <p className="absolute bottom-1 right-2 rounded bg-white/80 px-1 text-[11px] text-ink-muted">© OpenStreetMap contributors · pins at the postal-code area, not the exact address</p>
            </div>
            {person && (
              <Card className="space-y-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/people/${person.id}`} className="text-subheading font-semibold text-ink hover:underline">{person.name}</Link>
                  <Tag tone="gray" soft>{person.type.replace("_", " ")}</Tag><Tag tone="gray" soft>{person.language === "fr" ? "Français" : "English"}</Tag>
                  {person.drafts > 0 && <Tag tone="brand" soft>{person.drafts} reply to approve</Tag>}
                </div>
                <p className="flex flex-wrap gap-3 text-caption text-ink-muted"><span className="flex items-center gap-1"><MapPin size={12} aria-hidden />{person.address} · {person.postal}</span>
                  <span className="flex items-center gap-1"><Phone size={12} aria-hidden />{person.phone}</span></p>
                {person.case && (
                  <div className="text-subtitle">
                    <p className="font-medium text-ink"><Link href={`/projects/${person.case.id}`} className="hover:underline">#{person.case.project_no ?? person.case.id} · {person.case.title}</Link> <span className="text-caption text-ink-muted">{person.case.stage.replace("_", " ")}</span></p>
                    <p className="mt-1 text-caption text-ink-body">{person.case.concern}</p>
                    <p className="mt-1 text-caption text-ink-body">{[person.case.visit && `Visit: ${person.case.visit}`, person.case.estimate && `Estimate: ${person.case.estimate}`, person.case.service && `Recommended: ${person.case.service}`, `${person.case.photo_count} photos · ${person.case.findings} findings`].filter(Boolean).join(" · ")}</p>
                    <div className="mt-2 flex gap-1.5 overflow-x-auto">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {person.case.photos.map((id) => <img key={id} src={photoUrl(person.case!.id, id)} alt="" className="h-16 w-16 shrink-0 rounded-ds-xsm object-cover" />)}
                    </div>
                  </div>
                )}
                <div>
                  <p className="mb-1 flex items-center gap-1 text-caption font-semibold text-ink"><CalendarClock size={13} aria-hidden />Follow-ups</p>
                  <ul className="space-y-1">{person.followups.map((f) => <li key={f.id} className={cx("text-caption", f.status === "upcoming" ? "text-ink" : "text-ink-muted line-through")}>{f.due} · {f.reason}</li>)}</ul>
                </div>
              </Card>
            )}
          </div>
          {person && (
            <aside className="space-y-4 xl:sticky xl:top-28 xl:self-start">
              <Card className="p-5">
                <p className="mb-2 flex items-center gap-1.5 text-subtitle font-semibold text-ink"><MessageSquare size={14} aria-hidden />Conversation · {person.name.split(" (")[0]}</p>
                <Conversation p={person} tall />
              </Card>
              <Card className="p-5">
                <p className="mb-2 flex items-center gap-1.5 text-subtitle font-semibold text-ink"><Sparkles size={14} aria-hidden />What we&apos;ve learned ({person.facts.length})</p>
                <Learned p={person} />
              </Card>
            </aside>
          )}
        </div>
      )}
    </StaffShell>
  );
}
