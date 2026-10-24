"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, money } from "@/lib/api";
import { Card, Spinner, StaffShell, Tag, cx } from "@/components/ui";
import { OwnerBadge, SyntheticTag, day, type PersonRow } from "@/components/hub";

export default function People() {
  const sp = useSearchParams();
  const [rows, setRows] = useState<PersonRow[] | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(sp.get("pending") ? "pending" : "all");
  useEffect(() => { api.get<PersonRow[]>("/people").then(setRows); }, []);
  const shown = useMemo(() => (rows ?? []).filter((r) => {
    if (filter === "pending" && !r.pending_facts) return false;
    if (filter === "estimates" && !r.open_estimate) return false;
    const t = q.toLowerCase();
    return !t || `${r.name} ${r.city} ${r.phone}`.toLowerCase().includes(t);
  }), [rows, q, filter]);
  if (!rows) return <StaffShell><Spinner label="Loading people…" /></StaffShell>;
  return (
    <StaffShell title="People">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, city, phone" aria-label="Filter people"
          className="h-10 w-72 rounded-ds-xsm border border-kit-gray-soft px-3 text-subtitle" />
        {[["all", `All (${rows.length})`], ["estimates", "Open estimates"], ["pending", "Facts to check"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k}
            className={cx("h-10 rounded-full px-4 text-subtitle", filter === k ? "bg-brand text-white" : "bg-white text-ink-body shadow-ds-xsm")}>{l}</button>
        ))}
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <caption className="sr-only">Customers</caption>
          <thead className="bg-kit-gray-faint text-[12px] text-ink-muted">
            <tr>{["Name", "City", "Type", "Language", "Open estimate", "Facts to check", "Last contact", "Messages", "Replies"].map((h) => <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-kit-gray-soft hover:bg-kit-gray-faint/60">
                <td className="px-4 py-3"><Link href={`/people/${r.id}`} className="font-medium text-ink hover:text-brand">{r.name}</Link> <SyntheticTag show={r.synthetic} /></td>
                <td className="px-4 py-3">{r.city}</td>
                <td className="px-4 py-3 capitalize">{r.customer_type.replace("_", " ")}</td>
                <td className="px-4 py-3 uppercase">{r.language}</td>
                <td className="px-4 py-3 tabular-nums">{r.open_estimate ? <Tag tone="orange" soft>{money(r.open_estimate)} · {r.estimate_status}</Tag> : r.estimate_status ? <span className="text-ink-muted">{r.estimate_status}</span> : "—"}</td>
                <td className="px-4 py-3">{r.pending_facts ? <Tag tone="brand" soft>{r.pending_facts}</Tag> : "—"}</td>
                <td className="px-4 py-3">{day(r.last_contact)}</td>
                <td className="px-4 py-3">{r.consent_ok ? <Tag tone="green" soft>allowed</Tag> : <Tag tone="gray" soft>no consent</Tag>}</td>
                <td className="px-4 py-3"><OwnerBadge owner={r.owner} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </StaffShell>
  );
}
