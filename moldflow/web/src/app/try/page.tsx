"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Smartphone, TriangleAlert } from "lucide-react";
import { Card, Eyebrow, Logo } from "@/components/ui";

/** Demo kiosk: a big QR so visitors can try Bruce (live camera + voice) on their own phone. The phone needs HTTPS, so the
 *  QR uses NEXT_PUBLIC_PUBLIC_URL (the tunnel URL from scripts/tunnel.sh), or this page's own origin if that is HTTPS. */
const PUBLIC_URL = process.env.NEXT_PUBLIC_PUBLIC_URL ?? "";

export default function TryPage() {
  const [target, setTarget] = useState<string | null>(null);
  const [qr, setQr] = useState<string>();

  useEffect(() => {
    const origin = PUBLIC_URL || (window.location.protocol === "https:" ? window.location.origin : "");
    const url = origin ? `${origin.replace(/\/$/, "")}/` : "";
    if (!url) {
      queueMicrotask(() => setTarget(""));
      return;
    }
    QRCode.toDataURL(url, { margin: 1, width: 720, color: { dark: "#111827", light: "#ffffff" } }).then((src) => { setQr(src); setTarget(url); });
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center px-6 py-10 text-center">
      <Logo />
      <Eyebrow color="text-brand" className="mt-10">Try it on your phone</Eyebrow>
      <h1 className="mt-2 text-h4 font-bold tracking-tight text-ink">Point your camera at this code</h1>
      <p className="mt-3 max-w-xl text-body font-light text-ink-body">
        Bruce, our AI assistant, will guide you through a 4-minute live pre-assessment: show any wall or vent and answer a few questions.
        Prototype on sample data: please don&apos;t share personal details.
      </p>
      {target === null && <p className="mt-10 text-subtitle text-ink-muted">Preparing the code…</p>}
      {target === "" && (
        <Card className="mt-10 max-w-xl border-kit-orange p-6 text-left">
          <p className="flex items-center gap-2 text-subheading font-semibold text-ink"><TriangleAlert size={20} aria-hidden /> No public HTTPS link yet</p>
          <p className="mt-2 text-subtitle text-ink-body">
            Phones can only use the camera over HTTPS, and this page is running on localhost. Start <code>scripts/tunnel.sh</code>, then
            restart the web app with <code>NEXT_PUBLIC_PUBLIC_URL=https://&lt;your-tunnel&gt;.trycloudflare.com</code> (or open this page through the tunnel).
          </p>
        </Card>
      )}
      {target && qr && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR code for ${target}`} className="mt-8 h-auto w-full max-w-[min(80vh,640px)] rounded-ds-sm shadow-ds-normal" />
          <p className="mt-4 flex items-center gap-2 text-subtitle text-ink-muted"><Smartphone size={16} aria-hidden />{target}</p>
        </>
      )}
    </main>
  );
}
