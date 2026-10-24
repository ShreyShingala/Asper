import { Suspense } from "react";
import Outreach from "./client";

export default function Page() {
  return <Suspense fallback={<div className="p-8 text-subtitle text-ink-muted">Loading…</div>}><Outreach /></Suspense>;
}
