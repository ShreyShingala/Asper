"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

export type AlertVariant = "success" | "info" | "warning" | "danger";
export type InteractionState = "default" | "hover" | "pressed";

const STYLES: Record<
  AlertVariant,
  { box: string; icon: string; title: string; desc: string; descActive: string; descGroupHover: string; closeHover: string; closePressed: string; closeIdle: string }
> = {
  success: {
    box: "bg-alert-success-bg",
    icon: "bg-alert-success-accent",
    title: "text-alert-success-title",
    desc: "text-alert-success-accent",
    descActive: "text-alert-success-text",
    descGroupHover: "group-hover:text-alert-success-text",
    closeIdle: "text-alert-success-accent",
    closeHover: "bg-alert-success-accent/25",
    closePressed: "bg-alert-success-accent/25 ring-4 ring-white/60",
  },
  info: {
    box: "bg-alert-info-bg",
    icon: "bg-alert-info-accent",
    title: "text-alert-info-accent",
    desc: "text-alert-info-accent",
    descActive: "text-alert-info-accent",
    descGroupHover: "group-hover:text-alert-info-accent",
    closeIdle: "text-alert-info-accent",
    closeHover: "bg-alert-info-accent/20",
    closePressed: "bg-alert-info-accent/20 ring-4 ring-white/60",
  },
  warning: {
    box: "bg-alert-warning-bg",
    icon: "bg-alert-warning-accent",
    title: "text-alert-warning-accent",
    desc: "text-alert-warning-accent",
    descActive: "text-alert-warning-accent",
    descGroupHover: "group-hover:text-alert-warning-accent",
    closeIdle: "text-alert-warning-accent",
    closeHover: "bg-alert-warning-accent/25",
    closePressed: "bg-alert-warning-accent/25 ring-4 ring-white/60",
  },
  danger: {
    box: "bg-alert-danger-bg",
    icon: "bg-alert-danger-accent",
    title: "text-alert-danger-accent",
    desc: "text-alert-danger-accent",
    descActive: "text-alert-danger-accent",
    descGroupHover: "group-hover:text-alert-danger-accent",
    closeIdle: "text-alert-danger-accent",
    closeHover: "bg-alert-danger-accent/20",
    closePressed: "bg-alert-danger-accent/20 ring-4 ring-white/60",
  },
};

const DEFAULT_COPY: Record<AlertVariant, { title: string; description: string }> = {
  success: { title: "Congratulations!", description: "Your profile verified" },
  info: { title: "Information", description: "Your profile verified" },
  warning: { title: "Warning!", description: "Your profile verified" },
  danger: { title: "Warning!", description: "Your profile verified" },
};

/** Tiny arrow cursor used on the artboard to illustrate Hover / Pressed. */
function SpecimenCursor() {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden className="pointer-events-none absolute -bottom-2 -right-2 drop-shadow-sm">
      <path d="M1 1 L1 12.5 L4 9.8 L6.2 14.8 L8.2 13.9 L6 9 L10.3 9 Z" fill="#fff" stroke="#111" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Alert: "used to show feedback to the user about an action or state".
 * 68px tall, fluid width (440px in the spec). Close button has Hover and Pressed states.
 * `state` forces a state for documentation; leave it undefined for live behaviour.
 */
export function Alert({
  variant = "success",
  title,
  description,
  state,
  onClose,
  dismissible = true,
  className,
}: {
  variant?: AlertVariant;
  title?: string;
  description?: string;
  state?: InteractionState;
  onClose?: () => void;
  dismissible?: boolean;
  className?: string;
}) {
  const [closed, setClosed] = useState(false);
  const s = STYLES[variant];
  const copy = DEFAULT_COPY[variant];
  if (closed) return null;

  const forced = state !== undefined;
  const active = state === "hover" || state === "pressed";

  return (
    <div
      role={variant === "danger" || variant === "warning" ? "alert" : "status"}
      className={cn("group flex h-[68px] w-full max-w-[440px] items-center gap-4 rounded-ds-sm px-4", s.box, className)}
    >
      <span className={cn("inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white", s.icon)}>
        <Check size={15} strokeWidth={3} aria-hidden />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className={cn("text-[16px] font-semibold", s.title)}>{title ?? copy.title}</p>
        <p
          className={cn(
            "text-[14px] font-light transition-colors",
            active ? s.descActive : s.desc,
            !forced && s.descGroupHover,
          )}
        >
          {description ?? copy.description}
        </p>
      </div>
      {dismissible && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            onClose?.();
            setClosed(true);
          }}
          className={cn(
            "relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
            s.closeIdle,
            state === "hover" && s.closeHover,
            state === "pressed" && s.closePressed,
            !forced && "hover:bg-current/15 active:ring-4 active:ring-white/60",
          )}
        >
          <X size={18} strokeWidth={2.5} aria-hidden />
          {active && <SpecimenCursor />}
        </button>
      )}
    </div>
  );
}
