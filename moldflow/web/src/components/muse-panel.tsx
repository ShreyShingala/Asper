"use client";
import { useState } from "react";
import Link from "next/link";
import { Download, Send, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, cx } from "@/components/ui";

type Answer = { answer: string; actions: { type: string; label: string; href?: string }[] };
const ASK = ["Who do I need to follow up with?", "What's going on with the Smiths Falls client?", "I am facing legal issues with the Smiths Falls client, can you put together all the evidence in a zip file for my legal team?"];

/** Asper on the hub: ask anything about any customer or project. */
export function MusePanel() {
  const [turns, setTurns] = useState<{ q: string; a?: Answer; err?: string }[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true); setQ("");
    setTurns((t) => [...t, { q: question }]);
    const legal = /legal|lawyer|evidence|zip|court|sue|dispute/i.test(question);
    const steps = legal
      ? ["Finding the customer and their project…", "Reading every text and internal note…", "Collecting photos, findings and the estimate…",
         "Lining up the dated timeline…", "Building the ZIP with a SHA-256 manifest…"]
      : ["Reading your records…"];
    let i = 0;
    setStep(steps[0]);
    const tick = setInterval(() => { i = Math.min(i + 1, steps.length - 1); setStep(steps[i]); }, 1900);
    try {
      const [a] = await Promise.all([api.post<Answer>("/muse/ask", { question }), new Promise((r) => setTimeout(r, legal ? 9500 : 900))]);
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, a } : x)));
    } catch (e) {
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, err: (e as Error).message } : x)));
    } finally { clearInterval(tick); setBusy(false); }
  }
  return (
    <Card className="flex max-h-[calc(100dvh-9rem)] flex-col p-4 xl:sticky xl:top-28">
      <p className="flex items-center gap-1.5 text-subheading font-semibold text-ink"><Sparkles size={16} className="text-brand" aria-hidden />Asper</p>
      <p className="text-caption text-ink-muted">Knows every customer, conversation and project.</p>
      <ol className="mt-3 space-y-3 overflow-y-auto pr-1">
        {turns.length === 0 && ASK.map((s) => (
          <li key={s}><button onClick={() => void ask(s)} className="w-full rounded-ds-sm border border-kit-gray-soft p-2.5 text-left text-[13px] text-ink hover:border-brand">{s}</button></li>
        ))}
        {turns.map((t, i) => (
          <li key={i} className="space-y-1.5">
            <p className="ml-auto w-fit max-w-[90%] rounded-ds-sm bg-kit-navy px-3 py-1.5 text-caption text-white">{t.q}</p>
            <div className={cx("rounded-ds-sm bg-brand-tint/60 p-2.5 text-caption text-ink", t.err && "bg-alert-danger-bg text-kit-red")}>
              {t.err ?? (t.a ? <span className="whitespace-pre-wrap">{t.a.answer}</span> : <span className="animate-pulse">{step}</span>)}
              {t.a?.actions.filter((x) => x.href).map((x, j) => x.type === "evidence_bundle"
                ? <a key={j} href={x.href} className="mt-2 flex items-center gap-1 font-medium text-brand underline"><Download size={12} aria-hidden />{x.label}</a>
                : <Link key={j} href={x.href!} className="mt-2 block font-medium text-brand underline">{x.label}</Link>)}
            </div>
          </li>
        ))}
      </ol>
      <form onSubmit={(e) => { e.preventDefault(); void ask(q); }} className="mt-3 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask Asper…" aria-label="Ask Asper" className="h-10 min-w-0 flex-1 rounded-ds-xsm border border-kit-gray-soft px-3 text-[16px]" />
        <Button type="submit" size="sm" state={busy ? "loading" : undefined} aria-label="Ask"><Send size={14} aria-hidden /></Button>
      </form>
    </Card>
  );
}
