"use client";
import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Camera, ListChecks, FileText, ArrowRight } from "lucide-react";
import { api, type CaseOut } from "@/lib/api";
import { STRINGS, type Lang } from "@/lib/i18n";
import { Button, Card, Eyebrow, LangToggle, Logo } from "@/components/ui";

export default function Landing() {
  const router = useRouter();
  const stored = useSyncExternalStore(subscribe, readStorage, () => "|");
  const [resumeStored, langStored] = stored.split("|");
  const [langPick, setLang] = useState<Lang | null>(null);
  const lang: Lang = langPick ?? (langStored === "fr" ? "fr" : "en");
  const resumeId = resumeStored || null;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const t = STRINGS[lang];

  async function start() {
    setBusy(true); setErr(null);
    try {
      const out = await api.post<CaseOut>("/cases", { language: lang });
      localStorage.setItem("moldflow_case", out.case.id);
      router.push(`/assess/${out.case.id}`);
    } catch (e) {
      setErr((e as Error).message || "Couldn't reach the server. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-5">
      <div className="flex items-center justify-between">
        <Logo small />
        <LangToggle lang={lang} onChange={(l) => { setLang(l); localStorage.setItem("moldflow_lang", l); }} />
      </div>
      <section className="rise mt-12">
        <Eyebrow color="text-kit-blue" className="mb-3">11:02 PM · NO APP NEEDED</Eyebrow>
        <h1 className="text-h5 font-bold tracking-tight text-ink">{t.heroTitle}</h1>
        <p className="mt-4 text-subheading font-light text-ink-body">{t.heroSub}</p>
      </section>
      <ol className="mt-8 space-y-3">
        {[[Camera, t.how1], [ListChecks, t.how2], [FileText, t.how3]].map(([Icon, label], i) => {
          const I = Icon as typeof Camera;
          return (
            <li key={i} className="rise" style={{ animationDelay: `${0.1 + i * 0.08}s` }}>
              <Card className="flex items-center gap-3 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-kit-blue/10 text-kit-blue"><I size={18} aria-hidden /></span>
                <span className="text-body font-medium text-ink">{label as string}</span>
              </Card>
            </li>
          );
        })}
      </ol>
      <div className="mt-auto space-y-3 pt-10">
        <Button size="lg" fullWidth onClick={start} state={busy ? "loading" : undefined} trailing={<ArrowRight size={18} aria-hidden />}>
          {t.start}
        </Button>
        {err && <p role="alert" className="rounded-ds-sm bg-alert-danger-bg p-3 text-center text-subtitle text-kit-red">{err}</p>}
        {resumeId && (
          <Button variant="outline" size="lg" fullWidth onClick={() => router.push(`/assess/${resumeId}`)}>{t.resume}</Button>
        )}
        <p className="text-center text-caption font-light text-ink-muted">{t.privacy}</p>
      </div>
    </main>
  );
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function readStorage() {
  if (new URLSearchParams(window.location.search).has("reset")) localStorage.removeItem("moldflow_case");
  return `${localStorage.getItem("moldflow_case") ?? ""}|${localStorage.getItem("moldflow_lang") ?? ""}`;
}
