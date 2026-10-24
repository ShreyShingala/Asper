"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ Tabs */

export type TabItem = { id: string; label: string; disabled?: boolean };

export function Tabs({
  items,
  variant = "underline",
  defaultId,
  value,
  onChange,
  label = "Tabs",
  className,
}: {
  items: TabItem[];
  variant?: "underline" | "pill";
  defaultId?: string;
  value?: string;
  onChange?: (id: string) => void;
  label?: string;
  className?: string;
}) {
  const [inner, setActive] = useState(defaultId ?? items[0]?.id);
  const active = value ?? inner;
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const move = (dir: 1 | -1, from: number) => {
    const enabled = items.filter((i) => !i.disabled);
    const cur = enabled.findIndex((i) => i.id === items[from].id);
    const next = enabled[(cur + dir + enabled.length) % enabled.length];
    setActive(next.id);
    onChange?.(next.id);
    refs.current[next.id]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={cn("inline-flex max-w-full overflow-x-auto", variant === "underline" ? "gap-6 border-b border-kit-gray-soft" : "gap-1 rounded-ds-sm bg-kit-gray-faint p-1", className)}>
      {items.map((t, i) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            role="tab"
            type="button"
            id={`tab-${t.id}`}
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            disabled={t.disabled}
            onClick={() => {
              setActive(t.id);
              onChange?.(t.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                move(1, i);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                move(-1, i);
              }
            }}
            className={cn(
              "shrink-0 text-[14px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kit-blue",
              variant === "underline"
                ? cn("-mb-px border-b-2 pb-2.5", on ? "border-kit-blue text-kit-blue" : "border-transparent text-ink-muted hover:text-ink")
                : cn("rounded-ds-xsm px-3.5 py-1.5", on ? "bg-white text-kit-blue shadow-ds-sm" : "text-ink-muted hover:text-ink"),
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Sidebar menu + list rows */

export type MenuSection = { heading?: string; items: { id: string; label: string; icon?: ReactNode; badge?: string }[] };

export function SidebarMenu({
  sections,
  defaultId,
  activeId,
  onSelect,
  className,
}: {
  sections: MenuSection[];
  defaultId?: string;
  activeId?: string;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const [inner, setInner] = useState(defaultId ?? sections[0]?.items[0]?.id);
  const active = activeId ?? inner;
  const setActive = (id: string) => {
    setInner(id);
    onSelect?.(id);
  };
  return (
    <nav aria-label="Sidebar" className={cn("flex w-full max-w-[220px] flex-col gap-4 rounded-ds-xsm bg-white p-3 shadow-ds-sm", className)}>
      {sections.map((s, si) => (
        <div key={si} className="flex flex-col gap-0.5">
          {s.heading && <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{s.heading}</p>}
          {s.items.map((it) => {
            const on = it.id === active;
            return (
              <button
                key={it.id}
                type="button"
                aria-current={on ? "page" : undefined}
                onClick={() => setActive(it.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-ds-xsm px-2 py-2 text-left text-[13px] transition-colors",
                  on ? "bg-kit-blue/10 font-medium text-kit-blue" : "text-ink-body hover:bg-kit-gray-faint",
                )}
              >
                {it.icon}
                <span className="flex-1">{it.label}</span>
                {it.badge && <span className="rounded-full bg-kit-blue px-1.5 text-[10px] font-semibold text-white">{it.badge}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function ListRow({
  title,
  meta,
  trailing,
  icon,
  className,
}: {
  title: string;
  meta?: string;
  trailing?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-ds-xsm bg-white px-3 py-2.5 shadow-ds-xsm", className)}>
      {icon && <span className="text-ink-muted">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-ink">{title}</p>
        {meta && <p className="truncate text-[12px] font-light text-ink-muted">{meta}</p>}
      </div>
      {trailing}
    </div>
  );
}

export function SearchRow({ placeholder = "Search", ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden />
      <input
        type="search"
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-ds-xsm border border-kit-gray-soft bg-white pl-9 pr-3 text-[13px] outline-none placeholder:text-placeholder focus:border-kit-blue"
        {...rest}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ Breadcrumb / back link */

export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-muted">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={it.label} className="flex items-center gap-1.5">
              {last ? (
                <span aria-current="page" className="font-medium text-ink">
                  {it.label}
                </span>
              ) : (
                <a href={it.href ?? "#"} className="hover:text-kit-blue hover:underline">
                  {it.label}
                </a>
              )}
              {!last && <ChevronRight size={14} aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function BackLink({ label = "Back", href = "#" }: { label?: string; href?: string }) {
  return (
    <a href={href} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink hover:text-kit-blue">
      <ChevronLeft size={16} aria-hidden />
      {label}
    </a>
  );
}
