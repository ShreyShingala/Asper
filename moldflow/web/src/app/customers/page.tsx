"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Spinner, StaffShell, Tag, cx } from "@/components/ui";
import { PersonPanel, type Person } from "@/components/people";

/** All the information on every customer in one place. */
export default function Customers() {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { api.get<{ people: Person[] }>("/people/overview").then((d) => setPeople(d.people)); }, []);
  return (
    <StaffShell title="All customers">
      {!people ? <Spinner label="Loading…" /> : (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-ds-sm bg-white shadow-ds-sm">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead className="bg-kit-gray-faint text-[12px] text-ink-muted">
                <tr>{["Customer", "Location", "Case", "Stage", "Last message", "Learned", "Next follow-up", ""].map((h) => <th key={h} scope="col" className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {people.map((p) => {
                  const last = p.messages.filter((m) => m.status !== "draft").at(-1);
                  const next = p.followups.find((f) => f.status === "upcoming");
                  return (
                    <tr key={p.id} onClick={() => setOpen(open === p.id ? null : p.id)} className={cx("cursor-pointer border-t border-kit-gray-soft hover:bg-brand-tint/40", open === p.id && "bg-brand-tint/40")}>
                      <td className="px-4 py-3"><p className="font-medium text-ink">{p.name}</p><p className="text-caption text-ink-muted">{p.type.replace("_", " ")} · {p.language.toUpperCase()}</p></td>
                      <td className="px-4 py-3 text-ink-body">{p.address}<br /><span className="text-caption text-ink-muted">{p.postal}</span></td>
                      <td className="max-w-[240px] px-4 py-3 text-ink-body">{p.case?.concern}</td>
                      <td className="px-4 py-3"><Tag tone="gray" soft>{p.case?.stage.replace("_", " ")}</Tag></td>
                      <td className="max-w-[260px] px-4 py-3 text-caption text-ink-body">{last ? `${last.dir === "in" ? "Them" : "Us"}: ${last.text.slice(0, 90)}` : "—"}</td>
                      <td className="px-4 py-3 tabular-nums">{p.facts.length}</td>
                      <td className="px-4 py-3 text-caption">{next ? `${next.due}` : "—"}</td>
                      <td className="px-4 py-3">{p.drafts > 0 && <Tag tone="brand" soft>{p.drafts} to approve</Tag>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {open && people.find((p) => p.id === open) && <PersonPanel p={people.find((p) => p.id === open)!} />}
        </div>
      )}
    </StaffShell>
  );
}
