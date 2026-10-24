"use client";
import { useEffect, useState } from "react";
import { BookOpen, ExternalLink, FlaskConical } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, KitTextarea, Spinner, StaffShell } from "@/components/ui";

type Topic = { name: string; summary: string; where: string; moisture: string; sources: [string, string][] };
type Brief = { found: string[]; brief: string; sources: { title: string; url: string }[] };

export default function ResearchPage() {
  const [topics, setTopics] = useState<Record<string, Topic> | null>(null);
  const [lab, setLab] = useState("Tape lift, upstairs bathroom drywall: Stachybotrys chartarum detected. ERMI 13.2");
  const [brief, setBrief] = useState<Brief | null>(null);
  useEffect(() => { api.get<{ topics: Record<string, Topic> }>("/research/topics").then((r) => setTopics(r.topics)); }, []);
  return (
    <StaffShell title="Mould research">
      <Card className="mb-6 p-5">
        <h2 className="flex items-center gap-2 text-subheading font-semibold text-ink"><FlaskConical size={18} aria-hidden />Explain a lab result</h2>
        <p className="mt-1 text-caption text-ink-muted">Paste what the lab report says. MoldFlow explains it in plain words from reviewed, cited sources. It never names a mould from a photo:
          only a lab can. Health Canada notes that in most cases the species doesn&apos;t change what to do: find and fix the moisture.</p>
        <KitTextarea aria-label="Lab result text" value={lab} onChange={(e) => setLab(e.target.value)} rows={2} className="mt-3" />
        <Button size="sm" className="mt-2" onClick={async () => setBrief(await api.post<Brief>("/research/brief", { lab_text: lab }))}>Explain</Button>
        {brief && (
          <div className="mt-4 rounded-ds-sm bg-kit-gray-faint p-4">
            {brief.found.length > 0 && <p className="text-caption font-medium uppercase tracking-wide text-ink-muted">Found: {brief.found.join(", ")}</p>}
            <p className="mt-2 whitespace-pre-line text-subtitle text-ink">{brief.brief}</p>
            <ul className="mt-3 space-y-1">{brief.sources.map((s) => (
              <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-caption font-medium text-brand hover:underline">{s.title}<ExternalLink size={11} aria-hidden /></a></li>
            ))}</ul>
          </div>
        )}
      </Card>
      {!topics ? <Spinner label="Loading…" /> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(topics).map(([k, t]) => (
            <Card key={k} className="p-5">
              <h3 className="flex items-center gap-2 text-subheading font-semibold text-ink"><BookOpen size={16} aria-hidden />{t.name}</h3>
              <p className="mt-1 text-subtitle text-ink">{t.summary}</p>
              <p className="mt-2 text-caption text-ink-body"><b>Where:</b> {t.where}</p>
              <p className="mt-1 text-caption text-ink-body"><b>What it says about moisture:</b> {t.moisture}</p>
              <p className="mt-2 text-[11px] text-ink-muted">Sources: {t.sources.map((s) => s[0]).join(" · ")}</p>
            </Card>
          ))}
        </div>
      )}
    </StaffShell>
  );
}
