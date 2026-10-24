"use client";
import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Camera, ListChecks, FileText, ArrowRight } from "lucide-react";
import { api, type CaseOut } from "@/lib/api";
import { STRINGS, type Lang } from "@/lib/i18n";
import { Button, LangToggle, Logo } from "@/components/ui";

export default function Landing() {
  const router = useRouter();
  const stored = useSyncExternalStore(subscribe, readStorage, () => "|");
  const [resumeStored, langStored] = stored.split("|");
  const [langPick, setLang] = useState<Lang | null>(null);
  const lang: Lang = langPick ?? (langStored === "fr" ? "fr" : "en");
  const resumeId = resumeStored || null;
  const [busy, setBusy] = useState(false);
  const t = STRINGS[lang];

  async function start() {
    setBusy(true);
    const out = await api.post<CaseOut>("/cases", { language: lang });
    localStorage.setItem("moldflow_case", out.case.id);
    router.push(`/assess/${out.case.id}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-5">
      <div className="flex items-center justify-between">
        <Logo small />
        <LangToggle lang={lang} onChange={(l) => { setLang(l); localStorage.setItem("moldflow_lang", l); }} />
      </div>
      <section className="rise mt-12">
        <p className="stamp mb-3 text-amber">11:02 PM · NO APP NEEDED</p>
        <h1 className="font-display text-[2.6rem] font-semibold leading-[1.02] tracking-tight">{t.heroTitle}</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">{t.heroSub}</p>
      </section>
      <ol className="mt-8 space-y-3">
        {[[Camera, t.how1], [ListChecks, t.how2], [FileText, t.how3]].map(([Icon, label], i) => {
          const I = Icon as typeof Camera;
          return (
            <li key={i} className="rise flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3" style={{ animationDelay: `${0.1 + i * 0.08}s` }}>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-moss-2 text-moss"><I size={18} /></span>
              <span className="font-medium">{label as string}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-auto space-y-3 pt-10">
        <Button className="h-14 w-full text-base" onClick={start} disabled={busy}>
          {t.start} <ArrowRight size={18} />
        </Button>
        {resumeId && (
          <Button variant="outline" className="w-full" onClick={() => router.push(`/assess/${resumeId}`)}>{t.resume}</Button>
        )}
        <p className="text-center text-xs leading-relaxed text-ink-2">{t.privacy}</p>
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
