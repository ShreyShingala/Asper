"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Camera, ListChecks, FileText, ArrowRight, ImageUp, Video } from "lucide-react";
import { api, type CaseOut } from "@/lib/api";
import { STRINGS, type Lang } from "@/lib/i18n";
import { Button, Eyebrow, LangToggle, Logo } from "@/components/ui";

export default function Landing() {
  const router = useRouter();
  const stored = useSyncExternalStore(subscribe, readStorage, () => "|");
  const [resumeStored, langStored] = stored.split("|");
  const [langPick, setLang] = useState<Lang | null>(null);
  const lang: Lang = langPick ?? (langStored === "fr" ? "fr" : "en");
  const resumeId = resumeStored || null;
  const [busy, setBusy] = useState<"upload" | "live" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [liveEnabled, setLiveEnabled] = useState(false);
  const t = STRINGS[lang];
  useEffect(() => {
    api.get<{ enabled: boolean }>("/live/config").then((c) => setLiveEnabled(c.enabled)).catch(() => {});
  }, []);

  async function start(mode: "upload" | "live") {
    setBusy(mode); setErr(null);
    try {
      const out = await api.post<CaseOut>("/cases", { language: mode === "live" ? "en" : lang });
      localStorage.setItem("moldflow_case", out.case.id);
      router.push(mode === "live" ? `/assess/${out.case.id}/live${new URLSearchParams(window.location.search).get("demo") === "1" ? "?demo=1" : ""}` : `/assess/${out.case.id}`);
    } catch (e) {
      setErr((e as Error).message || "Couldn't reach the server. Please try again.");
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-5 pb-10 pt-5 lg:px-10">
      <div className="flex items-center justify-between">
        <Logo small />
        <LangToggle lang={lang} onChange={(l) => { setLang(l); localStorage.setItem("moldflow_lang", l); }} />
      </div>
      <div className="mt-10 grid items-start gap-10 lg:mt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
        <div className="flex flex-col">
          <section className="rise">
            <Eyebrow color="text-brand" className="mb-3">11:02 PM · NO APP NEEDED</Eyebrow>
            <h1 className="text-h5 font-bold tracking-tight text-ink lg:text-h3">{t.heroTitle}</h1>
            <p className="mt-4 max-w-md text-subheading font-light text-ink-body">{t.heroSub}</p>
          </section>
          <ol className="mt-8 divide-y divide-[#ece7e3] border-y border-[#ece7e3]">
            {[[Camera, t.how1], [ListChecks, t.how2], [FileText, t.how3]].map(([Icon, label], i) => {
              const I = Icon as typeof Camera;
              return (
                <li key={i} className="rise flex items-center gap-4 py-3.5" style={{ animationDelay: `${0.1 + i * 0.08}s` }}>
                  <span className="w-6 text-subtitle font-semibold tabular-nums text-brand">0{i + 1}</span>
                  <span className="flex-1 text-body font-medium text-ink">{label as string}</span>
                  <I size={18} aria-hidden className="text-ink-muted" />
                </li>
              );
            })}
          </ol>
          <div className="mt-8 space-y-3">
            {liveEnabled && (
              <Button size="lg" fullWidth multiline onClick={() => start("live")} disabled={!!busy && busy !== "live"} state={busy === "live" ? "loading" : undefined}
                leading={<Video size={18} aria-hidden className="shrink-0" />}>
                {t.goLive}
              </Button>
            )}
            <Button size="lg" fullWidth multiline variant={liveEnabled ? "outline" : "primary"} onClick={() => start("upload")}
              disabled={!!busy && busy !== "upload"} state={busy === "upload" ? "loading" : undefined}
              leading={liveEnabled ? <ImageUp size={18} aria-hidden className="shrink-0" /> : undefined}
              trailing={liveEnabled ? undefined : <ArrowRight size={18} aria-hidden />}>
              {liveEnabled ? t.uploadPhotos : t.start}
            </Button>
            {liveEnabled && <p className="text-center text-[13px] font-light text-ink-muted lg:text-left">{t.liveNote}</p>}
            {err && <p role="alert" className="rounded-ds-sm bg-alert-danger-bg p-3 text-center text-subtitle text-kit-red">{err}</p>}
            {resumeId && (
              <Button variant="outline" size="lg" fullWidth onClick={() => router.push(`/assess/${resumeId}`)}>{t.resume}</Button>
            )}
            <p className="text-center text-[13px] font-light text-ink-muted lg:text-left">{t.privacy}</p>
          </div>
        </div>
        {/* The live call's own device: the orange focus box framing a real customer photo (Mold Busters virtual sample). */}
        <figure className="rise order-first lg:order-none" style={{ animationDelay: "0.15s" }}>
          <div className="relative overflow-hidden rounded-[20px] bg-kit-navy">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/demo/vent-grille.jpg" alt="A ceiling vent grille with dark discoloration, photographed by a customer during a virtual assessment"
              className="aspect-[4/3] w-full object-cover opacity-90 lg:aspect-[4/5]" />
            <div className="absolute left-[22%] top-[24%] h-[46%] w-[52%] rounded-[14px] border-[3px] border-brand shadow-[0_0_0_9999px_rgba(15,20,42,0.35)]" aria-hidden />
            <span className="absolute left-[22%] top-[calc(24%-2.25rem)] rounded-full bg-brand px-3 py-1 text-[13px] font-semibold text-white">Looks good: tap the shutter</span>
            <p className="absolute inset-x-4 bottom-4 rounded-ds-sm bg-white/95 px-3 py-2 text-[14px] text-ink"><b>Bruce:</b> Come close to the vent so the grille fills the box.</p>
          </div>
          <figcaption className="mt-2 text-[13px] text-ink-muted">A real customer&apos;s photo from a Mold Busters virtual assessment.</figcaption>
        </figure>
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
