"use client";
import { useCallback, useEffect, useState } from "react";
import { api, type Case, type CaseOut } from "./api";

export function useCase(caseId: string) {
  const [c, setC] = useState<Case | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setC((await api.get<CaseOut>(`/cases/${caseId}`)).case);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [caseId]);
  useEffect(() => {
    let on = true;
    api.get<CaseOut>(`/cases/${caseId}`).then((o) => on && setC(o.case)).catch((e: Error) => on && setErr(e.message));
    return () => { on = false; };
  }, [caseId]);
  const run = useCallback(async (label: string, fn: () => Promise<CaseOut | unknown>) => {
    setBusy(label); setErr(null);
    try {
      const out = await fn();
      if (out && typeof out === "object" && "case" in out) setC((out as CaseOut).case);
      else await reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, [reload]);
  return { c, err, busy, run, reload, setErr };
}
