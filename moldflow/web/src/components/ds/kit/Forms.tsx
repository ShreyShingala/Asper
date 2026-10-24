"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useId, useMemo, useRef, useState, type ComponentProps, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const FIELD_BASE =
  "w-full rounded-ds-xsm border bg-white text-[14px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-placeholder disabled:cursor-not-allowed disabled:bg-kit-gray-faint disabled:text-[#9aa0a6]";
const FIELD_STATE = "border-kit-gray-soft hover:border-kit-gray focus:border-kit-blue focus:shadow-[0_0_0_3px_rgb(33_105_232/0.15)]";

function Field({ label, hint, id, children }: { label?: string; hint?: string; id: string; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-[12px] font-medium text-ink-body">
          {label}
        </label>
      )}
      {children}
      {hint && <p className="text-[12px] font-light text-ink-muted">{hint}</p>}
    </div>
  );
}

/** Kit text input: optional leading icon, error + disabled states. */
export function KitInput({
  label,
  hint,
  icon,
  error,
  className,
  id,
  ...rest
}: { label?: string; hint?: string; icon?: ReactNode; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <Field label={label} hint={error ?? hint} id={inputId}>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">{icon}</span>}
        <input
          id={inputId}
          aria-invalid={!!error || undefined}
          className={cn(FIELD_BASE, FIELD_STATE, "h-10", icon ? "pl-9 pr-3" : "px-3", error && "border-kit-red focus:border-kit-red", className)}
          {...rest}
        />
      </div>
    </Field>
  );
}

export function KitTextarea({ label, hint, className, id, ...rest }: { label?: string; hint?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const tid = id ?? auto;
  return (
    <Field label={label} hint={hint} id={tid}>
      <textarea id={tid} className={cn(FIELD_BASE, FIELD_STATE, "min-h-[104px] resize-y px-3 py-2.5 leading-6", className)} {...rest} />
    </Field>
  );
}

export function KitSelect({
  label,
  hint,
  className,
  id,
  children,
  prefixDot,
  ...rest
}: { label?: string; hint?: string; prefixDot?: boolean } & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId();
  const sid = id ?? auto;
  return (
    <Field label={label} hint={hint} id={sid}>
      <div className="relative">
        {prefixDot && <span className="pointer-events-none absolute left-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-sm bg-kit-blue" aria-hidden />}
        <select id={sid} className={cn(FIELD_BASE, FIELD_STATE, "h-10 appearance-none pr-9", prefixDot ? "pl-8" : "pl-3", className)} {...rest}>
          {children}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden />
      </div>
    </Field>
  );
}

/* ------------------------------------------------------------------ Checkbox / radio / toggle */

export function Checkbox({
  label,
  className,
  ...rest
}: { label?: ReactNode } & Omit<ComponentProps<"input">, "type">) {
  return (
    <label className={cn("group inline-flex cursor-pointer items-center gap-2.5 text-[14px] text-ink-body has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50", className)}>
      <span className="relative inline-flex h-[18px] w-[18px] shrink-0">
        <input type="checkbox" className="peer absolute inset-0 h-full w-full cursor-[inherit] appearance-none rounded-[4px] border border-kit-gray bg-white transition-colors checked:border-kit-blue checked:bg-kit-blue indeterminate:border-kit-blue indeterminate:bg-kit-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kit-blue" {...rest} />
        <Check size={12} strokeWidth={3.5} className="pointer-events-none absolute left-[3px] top-[3px] text-white opacity-0 peer-checked:opacity-100" aria-hidden />
      </span>
      {label}
    </label>
  );
}

export function Radio({ label, className, ...rest }: { label?: ReactNode } & Omit<ComponentProps<"input">, "type">) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2.5 text-[14px] text-ink-body has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50", className)}>
      <span className="relative inline-flex h-[18px] w-[18px] shrink-0">
        <input
          type="radio"
          className="peer absolute inset-0 h-full w-full cursor-[inherit] appearance-none rounded-full border border-kit-gray bg-white transition-colors checked:border-kit-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kit-blue"
          {...rest}
        />
        <span className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-kit-blue transition-transform peer-checked:scale-100" aria-hidden />
      </span>
      {label}
    </label>
  );
}

export function Toggle({
  label,
  defaultChecked,
  checked,
  onChange,
  disabled,
}: {
  label?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  const [inner, setInner] = useState(!!defaultChecked);
  const on = checked ?? inner;
  return (
    <label className={cn("inline-flex items-center gap-3 text-[14px] text-ink-body", disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={() => {
          setInner(!on);
          onChange?.(!on);
        }}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kit-blue",
          on ? "bg-kit-blue" : "bg-kit-gray",
        )}
      >
        <span className={cn("block h-4 w-4 rounded-full bg-white shadow-ds-xsm transition-transform", on ? "translate-x-[18px]" : "translate-x-0.5")} />
      </button>
      {label}
    </label>
  );
}

/* ------------------------------------------------------------------ Search + dropdown (combobox) */

export function SearchCombobox({ options, label = "Search", placeholder = "Search…" }: { options: string[]; label?: string; placeholder?: string }) {
  const id = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const results = useMemo(() => options.filter((o) => o.toLowerCase().includes(q.toLowerCase())), [options, q]);

  const choose = (v: string) => {
    setPicked(v);
    setQ(v);
    setOpen(false);
  };

  return (
    <div className="relative w-full max-w-[360px]">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-activedescendant={open && results[idx] ? `${id}-opt-${idx}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          value={q}
          placeholder={placeholder}
          onChange={(e) => {
            setQ(e.target.value);
            setPicked(null);
            setIdx(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setIdx((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && open && results[idx]) {
              e.preventDefault();
              choose(results[idx]);
            } else if (e.key === "Escape") setOpen(false);
          }}
          className={cn(FIELD_BASE, FIELD_STATE, "h-10 pl-3 pr-10")}
        />
        <Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden />
      </div>
      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-auto rounded-ds-xsm border border-kit-gray-soft bg-white py-1 shadow-ds-normal"
        >
          {results.length === 0 && <li className="px-3 py-2 text-[13px] text-ink-muted">No results</li>}
          {results.map((o, i) => (
            <li
              key={o}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={picked === o}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
              onMouseEnter={() => setIdx(i)}
              className={cn("flex cursor-pointer items-center justify-between px-3 py-2 text-[13px] text-ink-body", i === idx && "bg-kit-blue/10 text-kit-blue")}
            >
              {o}
              {picked === o && <Check size={14} aria-hidden />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
