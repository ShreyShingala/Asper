"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Download, FileText, MessageSquare, Send, Upload } from "lucide-react";
import { api, type Case } from "@/lib/api";
import { AnnotatedPhoto, Button, Card, EmptyState, Spinner, StaffShell, Tag, cx } from "@/components/ui";

type Doc = { title: string; kind: string; href?: string; at?: string | null; body?: string };
type Detail = { case: Case; media: Record<string, string[]>; documents: Doc[]; evidence_href: string };
type ChatMsg = Case["chat"][number];
const TABS = ["Overview", "Media", "Timeline", "Documents", "Chat"] as const;

export default function Project() {
  const { caseId } = useParams<{ caseId: string }>();
  const [d, setD] = useState<Detail | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(() => api.get<Detail>(`/projects/${caseId}`).then(setD), [caseId]);
  useEffect(() => { void load(); }, [load]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try { await api.post(`/projects/${caseId}/chat`, { text }); setText(""); await load(); } finally { setBusy(false); }
  }

  async function importTelegram(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const r = await api.upload<{ imported: number; chat_name?: string }>(`/projects/${caseId}/import-telegram`, fd);
    setNote(`Imported ${r.imported} messages from "${r.chat_name ?? file.name}".`);
    await load();
  }

  if (!d) return <StaffShell><Spinner label="Loading project…" /></StaffShell>;
  const c = d.case;
  const photo = (id: string) => c.photos.find((p) => p.id === id);

  return (
    <StaffShell title={c.title} actions={<a href={d.evidence_href} className="inline-flex h-9 items-center gap-1.5 rounded-ds-xsm border border-brand px-3 text-subtitle font-medium text-brand"><Download size={14} aria-hidden />Evidence bundle</a>}>
      <div className="-mt-3 mb-5 flex flex-wrap items-center gap-2 text-caption text-ink-muted">
        <Tag tone="gray" soft>{c.stage.replace("_", " ")}</Tag><span>{c.customer.alias} · {c.customer.type}</span>
        {c.seeded_from === "mock" && <Tag tone="gray" soft>mock project</Tag>}
        <Link href={`/cases/${c.id}/review`} className="text-brand underline">Open review</Link>
      </div>
      <div role="tablist" className="mb-5 flex gap-6 overflow-x-auto border-b border-kit-gray-soft">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={cx("-mb-px whitespace-nowrap border-b-2 pb-2 text-subtitle font-medium", tab === t ? "border-brand text-brand" : "border-transparent text-ink-muted hover:text-ink")}>
            {t}{t === "Chat" ? ` (${c.chat.length})` : t === "Media" ? ` (${c.photos.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="text-subheading font-semibold text-ink">Concern</h2>
            <p className="mt-2 text-subtitle text-ink-body">{c.concern || "Not recorded yet."}</p>
            {c.pre_assessment && <p className="mt-3 text-subtitle text-ink"><span className="font-medium">Recommendation:</span> {c.pre_assessment.service_price_text}</p>}
            {c.tenant_pack && <p className="mt-3 text-subtitle text-ink"><span className="font-medium">Tenant pack:</span> {c.tenant_pack.status}, step {c.tenant_pack.step}, landlord {c.tenant_pack.landlord_name}</p>}
          </Card>
          <Card className="p-5">
            <h2 className="text-subheading font-semibold text-ink">Latest activity</h2>
            <ul className="mt-2 space-y-1.5 text-subtitle">{c.timeline.slice(-5).reverse().map((e, i) => <li key={i}><span className="text-ink-muted">{e.at_text}</span> · {e.step}</li>)}</ul>
          </Card>
        </div>
      )}

      {tab === "Media" && (Object.keys(d.media).length === 0 ? <EmptyState title="No photos yet" description="Photos from the live call are filed here automatically." /> : (
        <div className="space-y-6">
          {Object.entries(d.media).map(([group, ids]) => (
            <section key={group}>
              <h2 className="mb-2 text-subtitle font-semibold text-ink">{group} <span className="font-normal text-ink-muted">· {ids.length}</span></h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {ids.map((id) => photo(id) && (
                  <figure key={id}>
                    <AnnotatedPhoto caseId={c.id} photo={photo(id)!} className="aspect-square" />
                    <figcaption className="mt-1 text-[11px] text-ink-muted">{photo(id)!.caption_from_pack ?? photo(id)!.prompt_id ?? id} · {photo(id)!.source}</figcaption>
                  </figure>
                ))}
              </div>
            </section>
          ))}
        </div>
      ))}

      {tab === "Timeline" && (
        <Card className="p-5">
          <ol className="space-y-3">
            {c.timeline.map((e, i) => (
              <li key={i} className="flex gap-3 text-subtitle">
                <span className="w-36 shrink-0 text-caption text-ink-muted">{e.at_text}</span>
                <span><span className="font-medium text-ink">{e.step}</span> <span className="text-ink-muted">· {e.system}</span><br /><span className="text-ink-body">{e.what}</span></span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {tab === "Documents" && (d.documents.length === 0 ? <EmptyState title="No documents yet" /> : (
        <ul className="space-y-2">
          {d.documents.map((doc, i) => (
            <li key={i}>
              <Card className="flex items-start gap-3 p-4">
                <FileText size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                <div className="min-w-0 flex-1">
                  {doc.href ? <a href={doc.href} target="_blank" rel="noreferrer" className="text-subtitle font-medium text-brand underline">{doc.title}</a>
                    : <p className="text-subtitle font-medium text-ink">{doc.title}</p>}
                  {doc.at && <p className="text-caption text-ink-muted">{new Date(doc.at).toLocaleString()}</p>}
                  {doc.body && <details className="mt-1 text-caption text-ink-body"><summary className="cursor-pointer">Show text</summary><pre className="mt-1 whitespace-pre-wrap font-sans">{doc.body}</pre></details>}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ))}

      {tab === "Chat" && (
        <Card className="flex h-[65vh] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-kit-gray-soft px-4 py-2">
            <p className="flex items-center gap-1.5 text-caption text-ink-muted"><MessageSquare size={13} aria-hidden />Project chat · mention <b>@muse</b> to ask about this project</p>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && void importTelegram(e.target.files[0])} />
            <Button size="sm" variant="outline" leading={<Upload size={14} aria-hidden />} onClick={() => fileRef.current?.click()}>Import Telegram chat</Button>
          </div>
          {note && <p role="status" className="bg-alert-success-bg px-4 py-2 text-caption text-alert-success-title">{note} <a href="/demo/telegram-sample.json" download className="underline">Sample export</a></p>}
          <ol className="flex-1 space-y-3 overflow-y-auto p-4">
            {c.chat.map((m: ChatMsg) => (
              <li key={m.id} className={cx("max-w-[85%] rounded-ds-sm px-3 py-2 text-subtitle", m.role === "ai" ? "bg-brand-tint text-ink" : m.role === "system" ? "mx-auto bg-kit-gray-faint text-caption text-ink-body" : "bg-kit-gray-faint text-ink")}>
                <p className="text-[11px] font-semibold text-ink-muted">{m.author} · {new Date(m.at!).toLocaleString()}{m.source !== "app" ? ` · ${m.source === "telegram" ? "Telegram import" : "mock (from sample pack timeline)"}` : ""}</p>
                <p className="whitespace-pre-wrap">{m.text}</p>
              </li>
            ))}
          </ol>
          <form onSubmit={send} className="flex gap-2 border-t border-kit-gray-soft p-3">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message the team, or @muse what did we quote?" aria-label="Message"
              className="h-11 min-w-0 flex-1 rounded-ds-xsm border border-kit-gray-soft px-3 text-[16px] outline-none focus:border-brand" />
            <Button type="submit" state={busy ? "loading" : undefined} leading={<Send size={16} aria-hidden />}>Send</Button>
          </form>
        </Card>
      )}
    </StaffShell>
  );
}
