import { Suspense } from "react";
import Assess from "./client";

export default function Page() {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center text-sm text-ink-2">Loading…</div>}>
      <Assess />
    </Suspense>
  );
}
