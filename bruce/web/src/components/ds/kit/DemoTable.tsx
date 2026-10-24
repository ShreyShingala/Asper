"use client";

import { Pencil, Check } from "lucide-react";
import { Tag, type TagTone } from "./Feedback";
import { DataTable, type Column } from "./DataTable";

type Row = { id: string; name: string; location: string; status: "Pending" | "Approved" | "Needs review" | "Rejected"; value: number };

const ROWS: Row[] = [
  { id: "S-1041", name: "Basement sink swab", location: "Ottawa, ON", status: "Approved", value: 195 },
  { id: "S-1042", name: "Washroom grout", location: "Ottawa, ON", status: "Needs review", value: 3700 },
  { id: "S-1043", name: "Attic insulation", location: "Gatineau, QC", status: "Pending", value: 520 },
  { id: "S-1044", name: "Dryer vent hose", location: "Montréal, QC", status: "Approved", value: 100 },
  { id: "S-1045", name: "Ceiling vent grille", location: "Montréal, QC", status: "Rejected", value: 0 },
];

const TONE: Record<Row["status"], TagTone> = { Pending: "gray", Approved: "green", "Needs review": "orange", Rejected: "red" };

const COLUMNS: Column<Row>[] = [
  { key: "id", header: "ID", sortable: true },
  { key: "name", header: "Capture", sortable: true },
  { key: "location", header: "Location", sortable: true },
  { key: "status", header: "Status", sortable: true, render: (r) => <Tag tone={TONE[r.status]}>{r.status}</Tag> },
  { key: "value", header: "Est. ($)", align: "right", sortable: true, render: (r) => r.value.toLocaleString("en-CA") },
];

export function DemoTable() {
  return <DataTable caption="Captures awaiting review" columns={COLUMNS} rows={ROWS} />;
}

/** Grouped list rows with selection marks and edit icons (the table's list variant). */
export function DemoList() {
  const groups = [
    { title: "Selected", rows: ["Basement sink swab", "Attic insulation"], icon: "check" as const },
    { title: "Draft", rows: ["Washroom grout"], icon: "edit" as const },
    { title: "Completed", rows: ["Dryer vent hose", "Ceiling vent grille", "Exterior drainage"], icon: "edit" as const },
  ];
  return (
    <div className="rounded-ds-xsm bg-kit-gray-faint p-3">
      {groups.map((g) => (
        <div key={g.title} className="mb-3 last:mb-0">
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{g.title}</p>
          <ul>
            {g.rows.map((r) => (
              <li key={r} className="flex items-center gap-3 rounded px-2 py-1.5 text-[13px] text-ink-body hover:bg-white">
                {g.icon === "check" ? <Check size={14} className="text-kit-blue" aria-hidden /> : <Pencil size={14} className="text-kit-orange" aria-hidden />}
                <span className="flex-1">{r}</span>
                <span className="text-[12px] font-light text-ink-muted">{g.icon === "check" ? "Selected" : "Edit"}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
