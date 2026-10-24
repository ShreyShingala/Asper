"use client";

import { AlertTriangle, CheckCircle2, Info, OctagonAlert, Pencil, Check, X, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ Banner */

export type BannerTone = "navy" | "green" | "orange" | "red";

const BANNER: Record<BannerTone, { cls: string; icon: LucideIcon; role: "status" | "alert" }> = {
  navy: { cls: "bg-kit-navy", icon: Info, role: "status" },
  green: { cls: "bg-kit-green", icon: CheckCircle2, role: "status" },
  orange: { cls: "bg-kit-orange", icon: AlertTriangle, role: "alert" },
  red: { cls: "bg-kit-red", icon: OctagonAlert, role: "alert" },
};

/** Full-width alert bars from the UI kit (navy / green / orange / red). */
export function Banner({
  tone = "navy",
  children,
  dismissible = true,
  className,
}: {
  tone?: BannerTone;
  children: ReactNode;
  dismissible?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const b = BANNER[tone];
  const Icon = b.icon;
  if (!open) return null;
  return (
    <div role={b.role} className={cn("flex items-center gap-3 rounded-ds-xsm px-4 py-2.5 text-[13px] text-white", b.cls, className)}>
      <Icon size={16} aria-hidden className="shrink-0" />
      <p className="min-w-0 flex-1 truncate">{children}</p>
      {dismissible && (
        <button type="button" aria-label="Dismiss" onClick={() => setOpen(false)} className="rounded p-0.5 hover:bg-white/20">
          <X size={16} aria-hidden />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Toast / notification bar */

export function NotificationBar({ children, className, onDismiss }: { children: ReactNode; className?: string; onDismiss?: () => void }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div role="status" className={cn("relative flex items-center justify-center rounded-ds-xsm bg-kit-navy px-12 py-3 text-[14px] text-white", className)}>
      <span>{children}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => {
          setOpen(false);
          onDismiss?.();
        }}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-white/80 hover:bg-white/15 hover:text-white"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ Loader */

export type LoaderVariant = "ring" | "dots" | "bars" | "pulse";

export function Loader({ variant = "ring", size = 28, label = "Loading" }: { variant?: LoaderVariant; size?: number; label?: string }) {
  return (
    <span role="status" aria-label={label} className="inline-flex items-center justify-center text-kit-navy" style={{ width: size, height: size }}>
      {variant === "ring" && (
        <svg viewBox="0 0 24 24" width={size} height={size} className="animate-ds-spin" aria-hidden>
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" />
          <path d="M12 3 a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {variant === "dots" && (
        <span className="flex items-center gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="block rounded-full bg-current animate-pulse" style={{ width: size / 5, height: size / 5, animationDelay: `${i * 160}ms` }} />
          ))}
        </span>
      )}
      {variant === "bars" && (
        <span className="flex items-end gap-[3px]" style={{ height: size * 0.7 }} aria-hidden>
          {[0.5, 1, 0.7, 0.9].map((h, i) => (
            <span key={i} className="block w-[3px] origin-bottom rounded-sm bg-current animate-pulse" style={{ height: `${h * 100}%`, animationDelay: `${i * 120}ms` }} />
          ))}
        </span>
      )}
      {variant === "pulse" && <span className="block rounded-full bg-current animate-ping opacity-70" style={{ width: size * 0.6, height: size * 0.6 }} aria-hidden />}
    </span>
  );
}

/* ------------------------------------------------------------------ Tag */

export type TagTone = "gray" | "blue" | "green" | "orange" | "red";

const TAG: Record<TagTone, { solid: string; soft: string }> = {
  gray: { solid: "bg-kit-gray text-ink", soft: "bg-kit-gray-faint text-ink-body" },
  blue: { solid: "bg-kit-blue text-white", soft: "bg-kit-blue/10 text-kit-blue" },
  green: { solid: "bg-kit-green text-white", soft: "bg-kit-green/10 text-kit-green" },
  orange: { solid: "bg-kit-orange text-white", soft: "bg-kit-orange/10 text-kit-orange" },
  red: { solid: "bg-kit-red text-white", soft: "bg-kit-red/10 text-kit-red" },
};

export function Tag({ tone = "gray", soft, children, className }: { tone?: TagTone; soft?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-[22px] items-center rounded-ds-xsm px-2 text-[12px] font-medium", soft ? TAG[tone].soft : TAG[tone].solid, className)}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Tooltip & popovers (dark) */

export function Tooltip({ label, children, side = "top" }: { label: string; children: ReactNode; side?: "top" | "bottom" }) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-ds-xsm bg-kit-navy px-2.5 py-1.5 text-[12px] text-white opacity-0 shadow-ds-normal transition-opacity group-hover/tt:opacity-100 group-focus-within/tt:opacity-100",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
        )}
      >
        {label}
      </span>
    </span>
  );
}

/** Dark pill used for keyboard hints / tooltips in the kit's "Tooltips" row. */
export function DarkPill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-8 min-w-[72px] items-center justify-center rounded-ds-xsm bg-kit-navy px-3 text-[12px] text-white", className)}>{children}</span>;
}

/** Dark popover surface (kit "Popovers": plain text, action list, rich text). */
export function Popover({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-ds-xsm bg-kit-navy p-4 text-[12px] leading-5 text-white shadow-ds-lg", className)}>{children}</div>;
}

export function PopoverMenu({ items }: { items: { label: string; icon?: "check" | "edit"; onSelect?: () => void }[] }) {
  return (
    <Popover className="min-w-[150px] p-2">
      <ul role="menu" className="flex flex-col">
        {items.map((it) => (
          <li key={it.label} role="none">
            <button
              role="menuitem"
              type="button"
              onClick={it.onSelect}
              className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-[13px] hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
            >
              {it.icon === "check" && <Check size={14} aria-hidden />}
              {it.icon === "edit" && <Pencil size={14} aria-hidden />}
              {it.label}
            </button>
          </li>
        ))}
      </ul>
    </Popover>
  );
}

/* ------------------------------------------------------------------ Modal */

export function ModalSurface({
  title,
  children,
  onClose,
  footer,
  className,
  titleId,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  footer?: ReactNode;
  className?: string;
  titleId?: string;
}) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={cn("max-h-[calc(100dvh-2rem)] w-full overflow-y-auto rounded-ds-sm bg-white p-6 shadow-ds-xl", className ?? "max-w-[420px]")}>
      <div className="mb-3 flex items-start justify-between gap-4">
        <h3 id={titleId} className="text-[18px] font-semibold text-ink">
          {title}
        </h3>
        <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-ink-muted hover:bg-kit-gray-faint hover:text-ink">
          <X size={18} aria-hidden />
        </button>
      </div>
      <div className="text-[14px] leading-6 font-light text-ink-body">{children}</div>
      {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
    </div>
  );
}

/**
 * Live modal: overlay + Esc to close + initial focus + scroll-lock.
 * Initial focus goes to the first `[data-autofocus]` element, else the first button.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (ref.current?.querySelector<HTMLElement>("[data-autofocus]") ?? ref.current?.querySelector<HTMLElement>("button"))?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prev?.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" ref={ref}>
      <div className="absolute inset-0 bg-kit-navy/55" onClick={onClose} aria-hidden />
      <div className="rise relative flex max-h-full w-full justify-center">
        <ModalSurface title={title} titleId={titleId} onClose={onClose} footer={footer} className={className}>
          {children}
        </ModalSurface>
      </div>
    </div>
  );
}
