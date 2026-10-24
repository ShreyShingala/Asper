import { Suspense } from "react";
import Live from "./client";

export default function Page() {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center text-subtitle text-ink-muted">Loading…</div>}>
      <Live />
    </Suspense>
  );
}
