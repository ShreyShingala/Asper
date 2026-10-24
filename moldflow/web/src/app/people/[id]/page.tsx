import { Suspense } from "react";
import Profile from "./client";

export default function Page() {
  return <Suspense fallback={<div className="p-8 text-subtitle text-ink-muted">Loading…</div>}><Profile /></Suspense>;
}
