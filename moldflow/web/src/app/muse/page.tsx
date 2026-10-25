"use client";
import { useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, Send, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, Eyebrow, StaffShell, cx } from "@/components/ui";

type Action = { type: "draft_message" | "evidence_bundle" | "open_project"; label: string; case_id: string; href?: string; status?: string; body?: string };
type Answer = { answer: string; cites: { ref: string; text: string }[]; actions: Action[] };
type Turn = { q: string; a?: Answer; err?: string };

const SUGGESTIONS = [
  "I have legal issues with case 42 from 2 years ago. Give me documentation so I can defend myself and give it to my lawyer.",
  "What's still open on Job 1 and who touched the report?",
  "Draft a follow-up to the landlord on case 43 about the estimate.",
  "Which projects have estimates viewed but not accepted?",
];

export default function Asper() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true); setQ("");
    setTurns((t) => [...t, { q: question }]);
    try {
      const a = await api.post<Answer>("/muse/ask", { question });
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, a } : x)));
    } catch (e) {
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, err: (e as Error).message } : x)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <StaffShell title="Asper">
      <p className="-mt-3 mb-5 text-subtitle font-light text-ink-body">Ask anything about any project. Asper reads every timeline, chat, message, check, estimate and approval, answers with sources, and can act: drafts go to Outreach for your OK, evidence bundles download right away.</p>
      <div className="mx-auto max-w-3xl space-y-4">
        {turns.length === 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => void ask(s)} className="rounded-ds-sm border border-kit-gray-soft bg-white p-4 text-left text-subtitle text-ink hover:border-brand">{s}</button>
            ))}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] rounded-ds-sm bg-kit-navy px-4 py-2 text-subtitle text-white">{t.q}</p>
            <Card className="p-5">
              <Eyebrow color="text-brand" className="mb-2 flex items-center gap-1.5"><Sparkles size={12} aria-hidden />Asper</Eyebrow>
              {!t.a && !t.err && <p className="text-subtitle text-ink-muted">Reading your projects…</p>}
              {t.err && <p role="alert" className="text-subtitle text-kit-red">{t.err}</p>}
              {t.a && (
                <>
                  <p className="whitespace-pre-wrap text-subtitle text-ink">{t.a.answer}</p>
                  {t.a.actions.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {t.a.actions.map((a, j) => a.type === "evidence_bundle" ? (
                        <a key={j} href={a.href} className="inline-flex h-10 items-center gap-1.5 rounded-ds-xsm bg-brand px-4 text-subtitle font-medium text-white"><Download size={15} aria-hidden />{a.label}</a>
                      ) : a.type === "open_project" ? (
                        <Link key={j} href={a.href!} className="inline-flex h-10 items-center gap-1.5 rounded-ds-xsm border border-brand px-4 text-subtitle font-medium text-brand"><ExternalLink size={15} aria-hidden />{a.label}</Link>
                      ) : (
                        <Link key={j} href={a.href ?? "/outreach"} className="inline-flex h-10 items-center gap-1.5 rounded-ds-xsm border border-kit-green px-4 text-subtitle font-medium text-kit-green">{a.label} · {a.status}</Link>
                      ))}
                    </div>
                  )}
                  {t.a.cites.length > 0 && (
                    <details className="mt-4 text-caption text-ink-body">
                      <summary className="cursor-pointer text-ink-muted">Sources ({t.a.cites.length})</summary>
                      <ul className="mt-2 space-y-1">{t.a.cites.map((c) => <li key={c.ref}><span className="font-mono text-[11px] text-ink-muted">{c.ref}</span> {c.text}</li>)}</ul>
                    </details>
                  )}
                </>
              )}
            </Card>
          </div>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); void ask(q); }} className={cx("sticky bottom-4 flex gap-2 rounded-ds-sm bg-white p-2 shadow-ds-lg")}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask Asper about any project…" aria-label="Ask Asper"
            className="h-12 min-w-0 flex-1 rounded-ds-xsm px-3 text-[16px] outline-none" />
          <Button type="submit" size="lg" state={busy ? "loading" : undefined} leading={<Send size={16} aria-hidden />}>Ask</Button>
        </form>
      </div>
    </StaffShell>
  );
}
