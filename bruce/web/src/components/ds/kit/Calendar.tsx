"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export type YMD = [year: number, monthIndex: number, day: number];
const toDate = (v?: YMD) => (v ? new Date(v[0], v[1], v[2]) : null);
const key = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
const same = (a: Date | null, b: Date | null) => !!a && !!b && key(a) === key(b);

/**
 * Datepicker (dark surface from the kit).
 * mode="single": one selected day (blue disc). mode="range": click start then end, blue band between.
 * The month is fixed to a prop so server + client render identically (no `new Date()` during render).
 */
export function Calendar({
  mode = "single",
  initialYear = 2026,
  initialMonth = 9,
  defaultStart,
  defaultEnd,
  onChange,
}: {
  mode?: "single" | "range";
  initialYear?: number;
  initialMonth?: number;
  defaultStart?: YMD;
  defaultEnd?: YMD;
  onChange?: (start: Date | null, end: Date | null) => void;
}) {
  const [cursor, setCursor] = useState({ y: initialYear, m: initialMonth });
  const [start, setStart] = useState<Date | null>(toDate(defaultStart));
  const [end, setEnd] = useState<Date | null>(toDate(defaultEnd));

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const offset = first.getDay();
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(cursor.y, cursor.m, 1 - offset + i);
      return { d, out: d.getMonth() !== cursor.m };
    });
  }, [cursor]);

  const pick = (d: Date) => {
    if (mode === "single") {
      setStart(d);
      setEnd(null);
      onChange?.(d, null);
      return;
    }
    if (!start || (start && end)) {
      setStart(d);
      setEnd(null);
      onChange?.(d, null);
    } else if (key(d) < key(start)) {
      setStart(d);
      onChange?.(d, null);
    } else {
      setEnd(d);
      onChange?.(start, d);
    }
  };

  const shift = (delta: number) => setCursor(({ y, m }) => {
    const n = new Date(y, m + delta, 1);
    return { y: n.getFullYear(), m: n.getMonth() };
  });

  const inRange = (d: Date) => !!start && !!end && key(d) > key(start) && key(d) < key(end);

  return (
    <div role="group" aria-label={`${MONTHS[cursor.m]} ${cursor.y}`} className="w-[300px] rounded-ds-xsm bg-kit-navy p-4 text-white shadow-ds-lg">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="rounded p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
          <ChevronLeft size={16} aria-hidden />
        </button>
        <p className="text-[14px] font-medium" aria-live="polite">
          {MONTHS[cursor.m]} {cursor.y}
        </p>
        <button type="button" aria-label="Next month" onClick={() => shift(1)} className="rounded p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-white/50">
        {DOW.map((d) => (
          <span key={d} className="py-1.5">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map(({ d, out }) => {
          const isStart = same(d, start);
          const isEnd = same(d, end);
          const mid = inRange(d);
          return (
            <div key={key(d)} className={cn("relative flex justify-center", mid && "bg-kit-blue/45", isStart && end && "rounded-l-full bg-kit-blue/45", isEnd && "rounded-r-full bg-kit-blue/45")}>
              <button
                type="button"
                onClick={() => pick(d)}
                aria-pressed={isStart || isEnd}
                aria-label={d.toDateString()}
                className={cn(
                  "h-9 w-9 rounded-full text-[13px] transition-colors",
                  out ? "text-white/30" : "text-white",
                  isStart || isEnd ? "bg-kit-blue font-semibold text-white" : "hover:bg-white/15",
                )}
              >
                {d.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
