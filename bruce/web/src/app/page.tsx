import Link from "next/link";
import { LogoMark } from "@/components/ds/Logo";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[720px] flex-col items-start justify-center gap-6 px-6 py-16">
      <LogoMark size={48} color="#517CFF" />
      <h1 className="text-h5 font-bold text-ink">Bruce</h1>
      <p className="text-[16px] font-light text-ink-muted">Mold Busters&apos; AI inspector. No app, any country, report in minutes.</p>
      <Link
        href="/design-system"
        className="inline-flex h-12 items-center rounded-ds-xsm bg-kit-blue px-6 text-[16px] font-medium text-white transition-colors hover:bg-[#1b5cd0]"
      >
        Open the design system
      </Link>
    </main>
  );
}
