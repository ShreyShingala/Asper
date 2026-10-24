"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Camera, ImageUp, Info, FileDown, CalendarCheck, Phone, CreditCard, MapPin, Check, HeartPulse } from "lucide-react";
import { api, resizeImage, type Case, type CaseOut, type IntakeTurn, type Photo } from "@/lib/api";
import { STRINGS } from "@/lib/i18n";
import { AnnotatedPhoto, Button, Card, Eyebrow, LangToggle, Logo, ProgressBar, ProvenancePill, Spinner, TextArea, TextField, buttonClass, cx } from "@/components/ui";

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

  if (err && !data) return <Center><p role="alert" className="text-subtitle text-kit-red">{err}</p></Center>;
  if (!data) return <Center><Spinner label="Loading…" /></Center>;
  const c = data.case;
  const customerPhotos = c.photos.filter((p) => p.source === "customer");

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-16 pt-4">
      <div className="flex items-center justify-between">
        <Logo small />
        <LangToggle lang={lang} onChange={setLang} />
      </div>
      <p className="mt-4 flex gap-2 rounded-ds-sm bg-brand-tint px-3 py-2.5 text-caption text-ink-body">
        <Info size={14} className="mt-0.5 shrink-0 text-brand" aria-hidden /> {t.banner}
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
      {err && <Card tone="danger" role="alert" className="mt-4 p-3 text-subtitle text-kit-red">{err}</Card>}
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
      <ProgressBar value={Math.round(Math.max(6, progress * 100))} label="Progress" />

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
          <Eyebrow color="text-brand" className="mb-1">{t.photos} {photos.length + 1} / 4</Eyebrow>
          <h2 className="text-h6 font-semibold text-ink">{prompt.text}</h2>
          <p className="mt-1 text-subtitle font-light text-ink-body">{prompt.why}</p>
          <input ref={cam} type="file" accept="image/*" capture="environment" hidden
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0], prompt.prompt_id)} />
          <input ref={lib} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0], prompt.prompt_id)} />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button size="lg" multiline leading={<Camera size={18} aria-hidden className="shrink-0" />} onClick={() => cam.current?.click()}>{t.takePhoto}</Button>
            <Button size="lg" multiline variant="outline" leading={<ImageUp size={18} aria-hidden className="shrink-0" />} onClick={() => lib.current?.click()}>{t.library}</Button>
          </div>
          <div className="mt-2 flex justify-between">
            {photos.length === 0
              ? <Button variant="text" size="sm" onClick={onSamples}>{t.useSamples}</Button>
              : <Button variant="text" size="sm" onClick={() => onSkip(prompt.prompt_id)}>{t.skip}</Button>}
          </div>
        </Card>
      )}

      {!busy && chip && chip.options.length > 0 && (
        <Card key={chip.key} className="rise p-5">
          <h2 className="text-h6 font-semibold text-ink">{chip.text}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {chip.options.map((o) => (
              <Button key={o} size="lg" multiline variant="outline" onClick={() => onAnswer(chip.key, o)}>{o}</Button>
            ))}
          </div>
          {chip.key === "symptoms" && <p className="mt-3 flex gap-1.5 text-caption font-light text-ink-muted"><HeartPulse size={14} className="shrink-0" aria-hidden />{STRINGS[c.language].banner.split(".")[0]}.</p>}
        </Card>
      )}

      {!busy && chip && chip.options.length === 0 && (
        <Card key={chip.key} className="rise p-5">
          <h2 className="text-h6 font-semibold text-ink">{chip.text}</h2>
          <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (loc.trim()) onAnswer(chip.key, loc); }}>
            <TextField value={loc} onChange={(e) => setLoc(e.target.value)} placeholder={t.postalPlaceholder} aria-label={chip.text} />
            <Button type="submit" size="lg" fullWidth>{t.next}</Button>
          </form>
        </Card>
      )}

      {!busy && turn?.ready && (
        <Card className="rise p-5">
          <TextArea value={extra} onChange={(e) => setExtra(e.target.value)} rows={3} placeholder={t.anythingElse} aria-label={t.anythingElse} />
          <Button size="lg" fullWidth className="mt-3" onClick={() => onAssess(extra)}>{t.getResult}</Button>
        </Card>
      )}

      {busy === "assess" && (
        <Card className="p-5">
          <ul className="space-y-2">
            {t.preparing.map((s, i) => (
              <li key={s} className={cx("flex items-center gap-2 text-subtitle transition", i <= tick ? "text-ink" : "text-ink-muted/50")}>
                {i < tick ? <Check size={16} className="text-kit-green" aria-hidden /> : i === tick ? <Spinner /> : <span className="w-4" />} {s.replace(" ✓", "")}
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
                <span key={i} className="rounded-ds-xsm bg-kit-gray-faint px-2 py-1 text-caption text-ink-body">{o}</span>
              ))}
            </div>
            {a.quality !== "ok" && <p className="text-caption text-kit-orange">Photo looks {a.quality.replace("_", " ")}; a retake may help.</p>}
            <div className="flex items-center justify-between gap-2">
              <ProvenancePill tier={p.analysis_tier} ms={p.analysis_latency_ms} model={p.analysis_model} />
              {a.regions.length > 0 && (
                <Button variant="text" size="sm" onClick={() => setBoxes(!boxes)} title={t.lookCloserNote} leading={<Info size={12} aria-hidden />} aria-pressed={boxes}>
                  {boxes ? "hide" : "show"} highlights
                </Button>
              )}
            </div>
          </>
        ) : (
          <p className="text-caption font-light text-ink-muted">Saved. Our team will review this photo.</p>
        )}
      </div>
    </Card>
  );
}

function Result({ c, busy, tick, onRelocate }: { c: Case; busy: string | null; tick: number; reload: () => void; onRelocate: (v: string) => void }) {
  const t = STRINGS[c.language];
  const pa = c.pre_assessment!;
  const [loc, setLoc] = useState("");
  const [showLoc, setShowLoc] = useState(false);
  const remote = pa.recommended_service === "remote_report";
  const paid = c.booking?.status === "paid_simulated";
  const booked = c.booking && !paid;

  if (busy === "assess") return <Card className="mt-6 p-5"><Spinner label={t.preparing[Math.min(tick, 2)]} /></Card>;

  return (
    <div className="mt-5 space-y-4">
      <section className="rise">
        <div className="flex items-center justify-between gap-2">
          <Eyebrow color="text-brand">{t.yourPA}</Eyebrow>
          <ProvenancePill tier={pa.tier} />
        </div>
        <h1 className="mt-1 text-h6 font-semibold text-ink">{pa.summary.split(". ")[0]}.</h1>
        <p className="mt-2 text-body font-light text-ink-body">{pa.summary.split(". ").slice(1).join(". ")}</p>
      </section>

      <Card className="rise overflow-hidden" style={{ animationDelay: "0.05s" }}>
        <div className="bg-brand px-5 py-4 text-white">
          <Eyebrow color="text-white/80">{t.nextStep}</Eyebrow>
          <p className="mt-1 text-h6 font-semibold">{pa.service_price_text.split(":")[0]}</p>
          <p className="mt-1 text-subheading font-semibold">{pa.service_price_text.split(":").slice(1).join(":").trim()}
            <span title={t.priceNote} className="ml-1 inline-block align-middle opacity-80"><Info size={14} aria-label={t.priceNote} /></span>
          </p>
          {remote && <p className="mt-2 text-subtitle text-white/90">{t.outside}</p>}
        </div>
        <div className="p-5">
          <Eyebrow className="mb-2">{t.why}</Eyebrow>
          <ul className="space-y-1.5 text-subtitle text-ink">{pa.reasons.map((r, i) => <li key={i} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-kit-green" aria-hidden />{r}</li>)}</ul>
          {pa.health_note && <p className="mt-4 flex gap-2 rounded-ds-sm bg-alert-warning-bg p-3 text-subtitle text-warning-text"><HeartPulse size={16} className="mt-0.5 shrink-0 text-alert-warning-accent" aria-hidden />{pa.health_note}</p>}
          <div className="mt-5 grid gap-2">
            {remote ? (
              paid ? <p role="status" className="rounded-ds-sm bg-alert-success-bg p-3 text-subtitle font-medium text-alert-success-title">{t.paid}</p>
                : <Link href={`/assess/${c.id}/checkout?product=ai_report`} className={buttonClass({ size: "lg", multiline: true })}><CreditCard size={18} aria-hidden className="shrink-0" />{t.remote}</Link>
            ) : booked ? (
              <Link href={`/assess/${c.id}/book`} className="flex items-center gap-2 rounded-ds-sm bg-alert-success-bg p-3 text-subtitle font-medium text-alert-success-title">
                <CalendarCheck size={16} className="shrink-0" aria-hidden />{t.booked} · {c.booking?.slot_text}
              </Link>
            ) : (
              <Link href={`/assess/${c.id}/book`} className={buttonClass({ size: "lg", multiline: true })}>
                <CalendarCheck size={18} aria-hidden className="shrink-0" />{t.book}
              </Link>
            )}
            <a href={`/api/cases/${c.id}/export/pre-assessment.pdf`} target="_blank" rel="noreferrer" aria-disabled={remote && !paid ? true : undefined}
              className={buttonClass({ variant: "outline", size: "lg", multiline: true, disabled: remote && !paid })}>
              <FileDown size={18} aria-hidden className="shrink-0" />{t.pdf}
            </a>
            <Button variant="text" size="sm" leading={<Phone size={14} aria-hidden />}>{t.callMe}</Button>
          </div>
        </div>
      </Card>

      <StayInTouch c={c} />
      <Offers c={c} />

      <Card className="rise p-5" style={{ animationDelay: "0.1s" }}>
        <Eyebrow className="mb-2">{t.weSee}</Eyebrow>
        <ul className="space-y-1.5 text-subtitle text-ink">{pa.observed.map((o, i) => <li key={i}>• {o}</li>)}</ul>
        <Eyebrow className="mb-2 mt-5">{t.cantTell}</Eyebrow>
        <ul className="space-y-1.5 text-subtitle font-light text-ink-body">{pa.cannot_tell.map((o, i) => <li key={i}>• {o}</li>)}</ul>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        {c.photos.filter((p) => p.source === "customer").map((p) => <AnnotatedPhoto key={p.id} caseId={c.id} photo={p} className="aspect-square" />)}
      </div>
      <p className="text-caption font-light text-ink-muted">{t.lookCloserNote} {t.priceNote}</p>

      <div className="text-center">
        {!showLoc ? (
          <Button variant="text" size="sm" leading={<MapPin size={12} aria-hidden />} onClick={() => setShowLoc(true)}>{t.changeLoc}</Button>
        ) : (
          <form className="flex flex-col gap-3 text-left" onSubmit={(e) => { e.preventDefault(); if (loc.trim()) onRelocate(loc); }}>
            <TextField value={loc} onChange={(e) => setLoc(e.target.value)} placeholder={t.postalPlaceholder} aria-label={t.changeLoc} />
            <Button type="submit" size="lg" fullWidth>{t.apply}</Button>
          </form>
        )}
      </div>

    </div>
  );
}

/** Paid add-ons: the $20 AI report for everyone, the $50 tenant action pack for tenants. */
function Offers({ c }: { c: Case }) {
  const paid = (p: string) => (c.payments ?? []).some((x) => x.product === p);
  const tenant = c.customer.type === "tenant" || c.answers.occupant === "Tenant";
  return (
    <Card className="rise space-y-3 p-5" style={{ animationDelay: "0.08s" }}>
      <Eyebrow>Do more with your pre-assessment</Eyebrow>
      {tenant && (
        <div className="rounded-ds-sm border border-brand/30 bg-brand-tint p-4">
          <p className="text-subtitle font-semibold text-ink">Renting? We contact your landlord for you · $50</p>
          <p className="mt-1 text-caption text-ink-body">We write from a Mold Busters address on your behalf (you&apos;re copied), follow up automatically, then help with a city complaint and tribunal paperwork. You approve every message.</p>
          <Link href={paid("tenant_pack") ? `/assess/${c.id}/pack` : `/assess/${c.id}/checkout?product=tenant_pack`} className={cx(buttonClass({ size: "md", fullWidth: true }), "mt-3")}>
            {paid("tenant_pack") ? "Open my action pack" : "Get the tenant action pack"}
          </Link>
        </div>
      )}
      <div className="rounded-ds-sm border border-kit-gray-soft p-4">
        <p className="text-subtitle font-semibold text-ink">Full AI pre-assessment report · $20</p>
        <p className="mt-1 text-caption text-ink-body">Every photo annotated by AI with what it shows, a room-by-room analysis, likely moisture sources and next steps, in the format our inspectors use.</p>
        {paid("ai_report") ? (
          <a href={`/api/cases/${c.id}/export/ai-report.pdf`} target="_blank" rel="noreferrer" className={cx(buttonClass({ variant: "outline", size: "md", fullWidth: true }), "mt-3")}>Download my full report</a>
        ) : (
          <Link href={`/assess/${c.id}/checkout?product=ai_report`} className={cx(buttonClass({ variant: "outline", size: "md", fullWidth: true }), "mt-3")}>Get the report</Link>
        )}
      </div>
    </Card>
  );
}

/** Basic fields once: then the system texts/emails the next steps itself and answers replies automatically. */
function StayInTouch({ c }: { c: Case }) {
  const [f, setF] = useState({ name: c.customer.alias !== "New customer" ? c.customer.alias : "", phone: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<{ trigger: string; status: string; body: string }[] | null>(c.contact_id ? [] : null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await api.post<{ messages: { trigger: string; status: string; body: string }[] }>(`/cases/${c.id}/contact`, f);
      setSent(r.messages);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (sent) {
    return (
      <Card className="rise space-y-2 p-5">
        <p className="flex items-center gap-2 text-subtitle font-semibold text-ink"><Check size={16} className="text-kit-green" aria-hidden />We&apos;ll keep you posted</p>
        {sent.filter((m) => m.status === "sent_simulated").map((m, i) => (
          <p key={i} className="whitespace-pre-wrap rounded-ds-xsm bg-kit-gray-faint p-3 text-caption text-ink-body">{m.body}</p>
        ))}
        <p className="text-caption font-light text-ink-muted">Reply any time: you&apos;ll get an answer right away. Sending is simulated in this prototype.</p>
      </Card>
    );
  }
  return (
    <Card className="rise p-5">
      <Eyebrow className="mb-2">Where should we send your next steps?</Eyebrow>
      <form onSubmit={save} className="grid gap-3">
        <TextField label="Your name" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <TextField label="Mobile (text)" type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <TextField label="Email (optional)" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        {err && <p role="alert" className="text-subtitle text-kit-red">{err}</p>}
        <Button type="submit" size="lg" fullWidth state={busy ? "loading" : undefined} disabled={!f.phone.trim() && !f.email.trim()}>Send me my next steps</Button>
        <p className="text-caption font-light text-ink-muted">We use this to reply about your request. Reply STOP to opt out. <a href="/privacy" className="text-brand underline">Privacy</a></p>
      </form>
    </Card>
  );
}
