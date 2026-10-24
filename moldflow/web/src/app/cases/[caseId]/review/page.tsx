import { Suspense } from "react";
import Review from "./client";

export default function Page() {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center text-subtitle text-ink-muted">Loading…</div>}>
      <Review />
    </Suspense>
  );
}
