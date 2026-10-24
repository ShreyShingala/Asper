"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera, MessageSquare, Send } from "lucide-react";
import { api } from "@/lib/api";
import { Card, Spinner, StaffShell, Tag } from "@/components/ui";

type P = { id: string; project_no?: number | null; title: string; stage: string; customer: string; customer_type: string; photos: number;
  chat: number; mock: boolean; pending: number; last_activity: string };

export default function Projects() {
  const [rows, setRows] = useState<P[] | null>(null);
  useEffect(() => { api.get<P[]>("/projects").then(setRows).catch(() => setRows([])); }, []);
  return (
    <StaffShell title="Projects">
      <p className="-mt-3 mb-5 text-subtitle font-light text-ink-body">One place per job instead of a chat group per project: photos from the live call are filed automatically, with the timeline, documents and the team chat.</p>
      {!rows ? <Spinner label="Loading projects…" /> : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <li key={p.id}>
              <Link href={`/projects/${p.id}`} className="block h-full">
                <Card className="h-full p-5 transition hover:shadow-ds-normal">
                  <div className="flex items-center gap-2">
                    <span className="text-caption font-semibold text-brand-strong">#{p.project_no ?? p.id}</span>
                    <Tag tone="gray" soft>{p.stage.replace("_", " ")}</Tag>
                    {p.mock && <Tag tone="gray" soft>mock</Tag>}
                  </div>
                  <p className="mt-2 text-subtitle font-semibold text-ink">{p.title}</p>
                  <p className="text-caption text-ink-muted">{p.customer} · {p.customer_type}</p>
                  <div className="mt-3 flex gap-4 text-caption text-ink-body">
                    <span className="flex items-center gap-1"><Camera size={13} aria-hidden />{p.photos}</span>
                    <span className="flex items-center gap-1"><MessageSquare size={13} aria-hidden />{p.chat}</span>
                    {p.pending > 0 && <span className="flex items-center gap-1 font-medium text-brand"><Send size={13} aria-hidden />{p.pending} to approve</span>}
                  </div>
                  <p className="mt-2 text-[11px] text-ink-muted">Last activity {new Date(p.last_activity).toLocaleDateString()}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </StaffShell>
  );
}
