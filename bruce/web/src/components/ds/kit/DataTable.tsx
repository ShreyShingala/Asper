"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Checkbox } from "./Forms";

export type Column<T> = {
  key: keyof T & string;
  header: string;
  align?: "left" | "right";
  sortable?: boolean;
  render?: (row: T) => ReactNode;
};

/**
 * Table (kit): selectable rows with indeterminate "select all", sortable headers,
 * highlighted selected rows, gray panel background.
 */
export function DataTable<T extends { id: string }>({
  columns,
  rows,
  selectable = true,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  selectable?: boolean;
  caption: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sort.key as keyof T];
      const bv = b[sort.key as keyof T];
      return (av > bv ? 1 : av < bv ? -1 : 0) * sort.dir;
    });
  }, [rows, sort]);

  const all = selected.size === rows.length && rows.length > 0;
  const some = selected.size > 0 && !all;

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="overflow-x-auto rounded-ds-xsm bg-kit-gray-faint">
      <table className="w-full border-collapse text-left text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-kit-gray-soft text-[12px] text-ink-muted">
            {selectable && (
              <th scope="col" className="w-10 px-3 py-3">
                <Checkbox
                  aria-label="Select all rows"
                  checked={all}
                  ref={(el) => {
                    if (el) el.indeterminate = some;
                  }}
                  onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))}
                />
              </th>
            )}
            {columns.map((c) => {
              const dir = sort?.key === c.key ? sort.dir : 0;
              return (
                <th key={c.key} scope="col" aria-sort={dir === 0 ? "none" : dir === 1 ? "ascending" : "descending"} className={cn("px-3 py-3 font-medium", c.align === "right" && "text-right")}>
                  {c.sortable ? (
                    <button
                      type="button"
                      onClick={() => setSort(dir === 0 ? { key: c.key, dir: 1 } : dir === 1 ? { key: c.key, dir: -1 } : null)}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      {c.header}
                      {dir === 0 ? <ChevronsUpDown size={12} aria-hidden /> : dir === 1 ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const on = selected.has(r.id);
            return (
              <tr key={r.id} aria-selected={on} className={cn("border-b border-kit-gray-soft/70 transition-colors last:border-0", on ? "bg-kit-blue/10" : "hover:bg-white/70")}>
                {selectable && (
                  <td className="px-3 py-2.5">
                    <Checkbox aria-label={`Select row ${r.id}`} checked={on} onChange={() => toggle(r.id)} />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-3 py-2.5 text-ink-body", c.align === "right" && "text-right")}>
                    {c.render ? c.render(r) : String(r[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
