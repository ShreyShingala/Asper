"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Camera, ImageUp, Info, FileDown, CalendarCheck, Mail, Phone, CreditCard, MapPin, Check, HeartPulse } from "lucide-react";
import { api, resizeImage, type Case, type CaseOut, type IntakeTurn, type Photo } from "@/lib/api";
import { STRINGS } from "@/lib/i18n";
import { AnnotatedPhoto, Button, Card, LangToggle, Logo, ProvenancePill, Spinner, cx } from "@/components/ui";

export default function Assess() {
  const { caseId } = useParams<{ caseId: string }>();
  const [data, setData] = useState<CaseOut | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null); // local preview URL while analysing
  const [busy, setBusy] = useState<"photo" | "assess" | "answer" | null>(null);
  const [tick, setTick] = useState(0);
  const lang = data?.case.language ?? "en";
  const t = STRINGS[lang];

  const load = useCallback(async () => {
    try {
      setData(await api.get<CaseOut>(`/cases/${caseId}`));
      localStorage.setItem("moldflow_case", caseId);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [caseId]);
  useEffect(() => {
    let on = true;
    api.get<CaseOut>(`/cases/${caseId}`)
      .then((o) => { if (on) { setData(o); localStorage.setItem("moldflow_case", caseId); } })
      .catch((e: Error) => on && setErr(e.message));
    return () => { on = false; };
  }, [caseId]);
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setTick((x) => x + 1), 1400);
    return () => clearInterval(id);
  }, [busy]);

  async function run<T extends CaseOut>(kind: typeof busy, fn: () => Promise<T>) {
    setBusy(kind); setErr(null); setTick(0);
    try {
      const out = await fn();
      setData((d) => ({ case: out.case, turn: out.turn ?? (out.case.stage === "intake" ? d?.turn : null) }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null); setPending(null);
    }
  }

  async function upload(file: File, promptId: string) {
    setPending(URL.createObjectURL(file));
    await run("photo", async () => {
      const blob = await resizeImage(file).catch(() => file);
      const fd = new FormData();
      fd.append("file", blob, "photo.jpg");
      fd.append("prompt_id", promptId);
      fd.append("source", "customer");
      return api.upload<CaseOut>(`/cases/${caseId}/photos`, fd);
    });
  }
  const answer = (key: string, value: string) => run("answer", () => api.post<CaseOut>(`/cases/${caseId}/answers`, { key, value }));
  const setLang = (l: "en" | "fr") => run("answer", async () => {
    const out = await api.post<CaseOut>(`/cases/${caseId}/language`, { language: l });
    localStorage.setItem("moldflow_lang", l);
    if (out.case.pre_assessment) return api.post<CaseOut>(`/cases/${caseId}/pre-assessment`);
    return out;
  });

  if (err && !data) return <Center><p className="text-rust">{err}</p></Center>;
  if (!data) return <Center><Spinner label="Loading…" /></Center>;
  const c = data.case;
  const customerPhotos = c.photos.filter((p) => p.source === "customer");

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-16 pt-4">
      <div className="flex items-center justify-between">
        <Logo small />
        <LangToggle lang={lang} onChange={setLang} />
      </div>
      <p className="mt-3 flex gap-2 rounded-xl bg-paper-2 px-3 py-2 text-xs leading-snug text-ink-2">
        <Info size={14} className="mt-0.5 shrink-0" /> {t.banner}
      </p>

      {c.stage === "intake" ? (
        <Intake c={c} turn={data.turn ?? null} photos={customerPhotos} pending={pending} busy={busy} tick={tick}
          onUpload={upload} onAnswer={answer}
          onSkip={(pid) => run("answer", () => api.post<CaseOut>(`/cases/${caseId}/skip-photo`, { prompt_id: pid }))}
          onSamples={() => run("photo", () => api.post<CaseOut>(`/cases/${caseId}/sample-photos`))}
          onAssess={async (extra) => {
            if (extra.trim()) await api.post(`/cases/${caseId}/answers`, { key: "concern", value: extra.trim() });
            await run("assess", () => api.post<CaseOut>(`/cases/${caseId}/pre-assessment`));
          }} />
      ) : (
        <Result c={c} busy={busy} tick={tick} reload={load}
          onRelocate={(v) => run("assess", async () => {
            await api.post(`/cases/${caseId}/answers`, { key: "location", value: v });
            return api.post<CaseOut>(`/cases/${caseId}/pre-assessment`);
          })} />
      )}
      {err && <p className="mt-4 rounded-xl border border-rust/30 bg-rust-2 p-3 text-sm text-rust">{err}</p>}
    </main>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-dvh place-items-center">{children}</div>;
}

function Intake({ c, turn, photos, pending, busy, tick, onUpload, onAnswer, onSkip, onSamples, onAssess }: {
  c: Case; turn: IntakeTurn | null; photos: Photo[]; pending: string | null; busy: string | null; tick: number;
  onUpload: (f: File, pid: string) => void; onAnswer: (k: string, v: string) => void; onSkip: (pid: string) => void;
  onSamples: () => void; onAssess: (extra: string) => void;
}) {
  const t = STRINGS[c.language];
  const cam = useRef<HTMLInputElement>(null);
  const lib = useRef<HTMLInputElement>(null);
  const [loc, setLoc] = useState("");
  const [extra, setExtra] = useState("");
  const actionRef = useRef<HTMLDivElement>(null);
  const prompt = turn?.photo_prompt;
  const stepKey = `${prompt?.prompt_id ?? ""}|${turn?.next_chip_question?.key ?? ""}|${turn?.ready}|${busy}`;
  useEffect(() => {
    if (photos.length) actionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [stepKey, photos.length]);
  const chip = turn?.next_chip_question;
  const answered = Object.keys(c.answers).filter((k) => !k.startsWith("skip:") && k !== "concern").length;
  const progress = Math.min(1, (photos.length + answered) / 10);

  return (
    <div className="mt-4 space-y-4">
      <div className="h-1.5 overflow-hidden rounded-full bg-paper-2">
        <div className="h-full rounded-full bg-moss transition-all duration-500" style={{ width: `${Math.max(6, progress * 100)}%` }} />
      </div>

      {(photos.length > 0 || pending) && (
        <div className="space-y-3">
          {photos.map((p) => <PhotoCard key={p.id} c={c} p={p} />)}
          {pending && (
            <Card className="rise overflow-hidden">
              <div className="scanline relative aspect-[4/3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pending} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="p-3"><Spinner label={t.looking[tick % t.looking.length]} /></div>
            </Card>
          )}
          {busy === "photo" && !pending && <Card className="p-4"><Spinner label={t.looking[tick % t.looking.length]} /></Card>}
        </div>
      )}

      <div ref={actionRef} />
      {!busy && prompt && (
        <Card key={prompt.prompt_id} className="rise p-5">
          <p className="stamp mb-1 text-amber">{t.photos.toUpperCase()} {photos.length + 1} / 4</p>
          <h2 className="font-display text-2xl font-semibold leading-tight">{prompt.text}</h2>
          <p className="mt-1 text-sm text-ink-2">{prompt.why}</p>
          <input ref={cam} type="file" accept="image/*" capture="environment" hidden
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0], prompt.prompt_id)} />
          <input ref={lib} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0], prompt.prompt_id)} />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button onClick={() => cam.current?.click()}><Camera size={18} />{t.takePhoto}</Button>
            <Button variant="outline" onClick={() => lib.current?.click()}><ImageUp size={18} />{t.library}</Button>
          </div>
          <div className="mt-2 flex justify-between">
            {photos.length === 0
              ? <Button variant="ghost" className="text-xs" onClick={onSamples}>{t.useSamples}</Button>
              : <Button variant="ghost" className="text-xs" onClick={() => onSkip(prompt.prompt_id)}>{t.skip}</Button>}
          </div>
        </Card>
      )}

      {!busy && chip && chip.options.length > 0 && (
        <Card key={chip.key} className="rise p-5">
          <h2 className="font-display text-2xl font-semibold leading-tight">{chip.text}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {chip.options.map((o) => (
              <button key={o} onClick={() => onAnswer(chip.key, o)}
                className="min-h-11 rounded-full border border-ink/15 bg-card px-4 text-sm font-medium hover:border-moss hover:bg-moss-2">
                {o}
              </button>
            ))}
          </div>
          {chip.key === "symptoms" && <p className="mt-3 flex gap-1.5 text-xs text-ink-2"><HeartPulse size={14} />{STRINGS[c.language].banner.split(".")[0]}.</p>}
        </Card>
      )}

      {!busy && chip && chip.options.length === 0 && (
        <Card key={chip.key} className="rise p-5">
          <h2 className="font-display text-2xl font-semibold leading-tight">{chip.text}</h2>
          <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (loc.trim()) onAnswer(chip.key, loc); }}>
            <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder={t.postalPlaceholder}
              className="min-h-11 flex-1 rounded-xl border border-ink/15 bg-white px-3 text-base outline-none focus:border-moss" />
            <Button type="submit">{t.next}</Button>
          </form>
        </Card>
      )}

      {!busy && turn?.ready && (
        <Card className="rise p-5">
          <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={3} placeholder={t.anythingElse}
            className="w-full rounded-xl border border-ink/15 bg-white p-3 text-base outline-none focus:border-moss" />
          <Button className="mt-3 h-14 w-full text-base" onClick={() => onAssess(extra)}>{t.getResult}</Button>
        </Card>
      )}

      {busy === "assess" && (
        <Card className="p-5">
          <ul className="space-y-2">
            {t.preparing.map((s, i) => (
              <li key={s} className={cx("flex items-center gap-2 text-sm transition", i <= tick ? "text-ink" : "text-ink-2/50")}>
                {i < tick ? <Check size={16} className="text-moss" /> : i === tick ? <Spinner /> : <span className="w-4" />} {s.replace(" ✓", "")}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {busy === "answer" && <Spinner />}
    </div>
  );
}

function PhotoCard({ c, p }: { c: Case; p: Photo }) {
  const [boxes, setBoxes] = useState(true);
  const t = STRINGS[c.language];
  const a = p.analysis;
  return (
    <Card className="rise overflow-hidden">
      <AnnotatedPhoto caseId={c.id} photo={p} showBoxes={boxes} className="aspect-[4/3]" />
      <div className="space-y-2 p-3">
        {a ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {a.observations.slice(0, 3).map((o, i) => (
                <span key={i} className="rounded-lg bg-paper-2 px-2 py-1 text-xs leading-snug">{o}</span>
              ))}
            </div>
            {a.quality !== "ok" && <p className="text-xs text-amber">Photo looks {a.quality.replace("_", " ")}; a retake may help.</p>}
            <div className="flex items-center justify-between gap-2">
              <ProvenancePill tier={p.analysis_tier} ms={p.analysis_latency_ms} model={p.analysis_model} />
              {a.regions.length > 0 && (
                <button onClick={() => setBoxes(!boxes)} className="stamp flex items-center gap-1 text-ink-2" title={t.lookCloserNote}>
                  <Info size={12} /> {boxes ? "hide" : "show"} highlights
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-ink-2">Saved. Our team will review this photo.</p>
        )}
      </div>
    </Card>
  );
}

function Result({ c, busy, tick, reload, onRelocate }: { c: Case; busy: string | null; tick: number; reload: () => void; onRelocate: (v: string) => void }) {
  const t = STRINGS[c.language];
  const pa = c.pre_assessment!;
  const [modal, setModal] = useState<null | "book" | "letter" | "pay">(null);
  const [letter, setLetter] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [loc, setLoc] = useState("");
  const [showLoc, setShowLoc] = useState(false);
  const remote = pa.recommended_service === "remote_report";
  const paid = c.booking?.status === "paid_simulated";
  const booked = c.booking && !paid;

  async function act(kind: "book" | "letter" | "pay", payload?: string) {
    if (kind === "letter") {
      const l = await api.post<{ body: string }>(`/cases/${c.id}/letters/landlord`, { language: c.language });
      setLetter(l.body); setModal("letter"); return;
    }
    await api.post(`/cases/${c.id}/book`, { service: kind === "pay" ? "remote_report" : pa.recommended_service, slot_text: payload ?? "Remote report" });
    setModal(null); reload();
  }
  if (busy === "assess") return <Card className="mt-6 p-5"><Spinner label={t.preparing[Math.min(tick, 2)]} /></Card>;

  return (
    <div className="mt-5 space-y-4">
      <section className="rise">
        <div className="flex items-center justify-between">
          <p className="stamp text-amber">{t.yourPA.toUpperCase()}</p>
          <ProvenancePill tier={pa.tier} />
        </div>
        <h1 className="mt-1 font-display text-3xl font-semibold leading-tight">{pa.summary.split(". ")[0]}.</h1>
        <p className="mt-2 text-ink-2">{pa.summary.split(". ").slice(1).join(". ")}</p>
      </section>

      <Card className="rise overflow-hidden border-moss/30" style={{ animationDelay: "0.05s" }}>
        <div className="bg-moss px-5 py-4 text-white">
          <p className="stamp opacity-80">{t.nextStep.toUpperCase()}</p>
          <p className="mt-1 font-display text-2xl font-semibold leading-tight">{pa.service_price_text.split(":")[0]}</p>
          <p className="mt-1 text-lg font-semibold">{pa.service_price_text.split(":").slice(1).join(":").trim()}
            <span title={t.priceNote} className="ml-1 inline-block align-middle opacity-80"><Info size={14} /></span>
          </p>
          {remote && <p className="mt-2 text-sm opacity-90">{t.outside}</p>}
        </div>
        <div className="p-5">
          <p className="stamp mb-2 text-ink-2">{t.why.toUpperCase()}</p>
          <ul className="space-y-1.5 text-sm">{pa.reasons.map((r, i) => <li key={i} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-moss" />{r}</li>)}</ul>
          {pa.health_note && <p className="mt-4 flex gap-2 rounded-xl bg-amber-2 p-3 text-sm text-[#7a4e06]"><HeartPulse size={16} className="mt-0.5 shrink-0" />{pa.health_note}</p>}
          <div className="mt-5 grid gap-2">
            {remote ? (
              paid ? <p className="rounded-xl bg-moss-2 p-3 text-sm text-moss">{t.paid}</p>
                : <Button className="h-12" onClick={() => setModal("pay")}><CreditCard size={18} />{t.remote}</Button>
            ) : booked ? (
              <p className="flex items-center gap-2 rounded-xl bg-moss-2 p-3 text-sm text-moss"><CalendarCheck size={16} />{t.booked} · {c.booking?.slot_text}</p>
            ) : (
              <Button className="h-12" onClick={() => setModal("book")}><CalendarCheck size={18} />{t.book}</Button>
            )}
            {pa.next_actions.includes("landlord_letter") && <Button variant="outline" onClick={() => act("letter")}><Mail size={18} />{t.letter}</Button>}
            <a href={`/api/cases/${c.id}/export/pre-assessment.pdf`} target="_blank" rel="noreferrer"
              className={cx("inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-ink/15 bg-card text-sm font-semibold",
                remote && !paid && "pointer-events-none opacity-40")}>
              <FileDown size={18} />{t.pdf}
            </a>
            <Button variant="ghost" className="text-xs"><Phone size={14} />{t.callMe}</Button>
          </div>
        </div>
      </Card>

      <Card className="rise p-5" style={{ animationDelay: "0.1s" }}>
        <p className="stamp mb-2 text-ink-2">{t.weSee.toUpperCase()}</p>
        <ul className="space-y-1.5 text-sm">{pa.observed.map((o, i) => <li key={i}>• {o}</li>)}</ul>
        <p className="stamp mb-2 mt-5 text-ink-2">{t.cantTell.toUpperCase()}</p>
        <ul className="space-y-1.5 text-sm text-ink-2">{pa.cannot_tell.map((o, i) => <li key={i}>• {o}</li>)}</ul>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        {c.photos.filter((p) => p.source === "customer").map((p) => <AnnotatedPhoto key={p.id} caseId={c.id} photo={p} className="aspect-square" />)}
      </div>
      <p className="text-xs text-ink-2">{t.lookCloserNote} {t.priceNote}</p>

      <div className="text-center">
        {!showLoc ? (
          <button className="inline-flex items-center gap-1 text-xs text-ink-2 underline" onClick={() => setShowLoc(true)}><MapPin size={12} />{t.changeLoc}</button>
        ) : (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (loc.trim()) onRelocate(loc); }}>
            <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder={t.postalPlaceholder}
              className="min-h-11 flex-1 rounded-xl border border-ink/15 bg-white px-3" />
            <Button type="submit">{t.apply}</Button>
          </form>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/40 p-3 sm:items-center sm:justify-center" onClick={() => setModal(null)}>
          <Card className="rise w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            {modal === "book" && (
              <>
                <h3 className="font-display text-xl font-semibold">{t.bookTitle}</h3>
                <div className="mt-3 grid gap-2">
                  {["Tomorrow · 9:00", "Tomorrow · 13:30", "Friday · 10:00"].map((s) => (
                    <Button key={s} variant="outline" onClick={() => act("book", s)}>{s}</Button>
                  ))}
                </div>
                <p className="stamp mt-3 text-ink-2">Simulated: in production this writes to the MB calendar + Close.</p>
              </>
            )}
            {modal === "pay" && (
              <>
                <h3 className="font-display text-xl font-semibold">{t.payTitle}</h3>
                <p className="mt-2 text-sm text-ink-2">{pa.summary}</p>
                <Button className="mt-4 h-12 w-full" onClick={() => act("pay")}><CreditCard size={18} />{t.pay}</Button>
                <p className="stamp mt-3 text-ink-2">Simulated checkout. Proposed product, pending Mold Busters approval.</p>
              </>
            )}
            {modal === "letter" && (
              <>
                <h3 className="font-display text-xl font-semibold">{t.letterTitle}</h3>
                <pre className="mt-3 max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-xl bg-paper-2 p-3 font-sans text-sm">{letter}</pre>
                <Button className="mt-3 w-full" onClick={() => { navigator.clipboard.writeText(letter); setCopied(true); }}>
                  {copied ? t.copied : t.copy}
                </Button>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
