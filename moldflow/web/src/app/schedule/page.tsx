"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera, KeyRound, Lightbulb, MapPin, Phone, Printer } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, EmptyState, Spinner, StaffShell } from "@/components/ui";

type Stop = { case_id: string; time?: string; name: string; address?: string; phone?: string; service: string; concern: string; room?: string;
  notes?: string; access: string[]; talking_points: string[]; photos: number; photograph: string[]; contact_id?: string };

export default function SchedulePage() {
  const [day, setDay] = useState("");  // empty = the server's (demo) clock decides "today"
  const [stops, setStops] = useState<Stop[] | null>(null);
  useEffect(() => {
    api.get<{ day: string; stops: Stop[] }>(day ? `/schedule?day=${day}` : "/schedule").then((r) => { setStops(r.stops); if (!day) setDay(r.day); });
  }, [day]);
  return (
    <StaffShell title="Inspector day sheet" actions={<Button size="sm" variant="outline" leading={<Printer size={14} aria-hidden />} onClick={() => window.print()}>Print</Button>}>
      <label className="mb-4 inline-flex items-center gap-2 text-subtitle">Day
        <input type="date" value={day} onChange={(e) => { setStops(null); setDay(e.target.value); }} className="h-10 rounded-ds-xsm border border-kit-gray-soft px-2" />
      </label>
      {!stops ? <Spinner label="Loading…" /> : stops.length === 0 ? <Card className="p-6"><EmptyState title="No visits booked this day" /></Card> : (
        <div className="space-y-4">
          {stops.map((s, i) => (
            <Card key={s.case_id} className="p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-subheading font-semibold text-ink">{i + 1}. {s.time} · {s.name}</h2>
                <span className="text-caption uppercase text-ink-muted">{s.service}</span>
              </div>
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-subtitle text-ink-body">
                {s.address && <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden />{s.address}</span>}
                {s.phone && <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1 text-brand"><Phone size={14} aria-hidden />{s.phone}</a>}
              </p>
              <ul className="mt-3 space-y-1.5 text-subtitle text-ink">
                <li><b>Concern:</b> {s.concern || "—"}{s.room ? ` (${s.room})` : ""} · {s.photos} customer photos</li>
                {(s.notes || s.access.length > 0) && <li className="flex gap-1.5"><KeyRound size={15} className="mt-0.5 shrink-0" aria-hidden /><span><b>Access:</b> {[s.notes, ...s.access].filter(Boolean).join(" · ")}</span></li>}
                {s.talking_points.map((t, k) => <li key={k} className="flex gap-1.5"><Lightbulb size={15} className="mt-0.5 shrink-0 text-brand" aria-hidden />{t}</li>)}
                {s.photograph.length > 0 && <li className="flex gap-1.5"><Camera size={15} className="mt-0.5 shrink-0" aria-hidden /><span><b>Check what photos couldn&apos;t:</b> {s.photograph.join(" · ")}</span></li>}
              </ul>
              <div className="mt-3 flex gap-3 text-caption font-medium">
                <Link href={`/cases/${s.case_id}/inspect`} className="text-brand">Open inspection →</Link>
                {s.contact_id && <Link href={`/people/${s.contact_id}`} className="text-brand">Profile →</Link>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </StaffShell>
  );
}
