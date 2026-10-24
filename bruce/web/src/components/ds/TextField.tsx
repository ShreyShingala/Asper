"use client";

import { X } from "lucide-react";
import { useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type FieldState = "default" | "hover" | "focus" | "validating" | "error" | "success" | "disabled";

const BORDER: Record<FieldState, string> = {
  default: "border-line",
  hover: "border-ink-muted",
  focus: "border-field-focus shadow-focus",
  validating: "border-field-focus",
  error: "border-danger",
  success: "border-field-success",
  disabled: "border-line bg-disabled",
};

function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" className={cn("animate-ds-spin", className)} aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <line
          key={i}
          x1="10"
          y1="2"
          x2="10"
          y2="5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity={0.2 + (i / 8) * 0.8}
          transform={`rotate(${i * 45} 10 10)`}
        />
      ))}
    </svg>
  );
}

/**
 * Inputs (Components artboard): 60px tall, fluid width (372px in the spec), 12px radius.
 * States: default, hover, focus/active, inline validating, error, success, disabled.
 * Pass `state` to force a state (documentation); omit it for live :hover/:focus behaviour.
 */
export function TextField({
  label,
  state,
  message,
  className,
  id,
  ...rest
}: {
  label?: string;
  state?: FieldState;
  message?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const inputId = id ?? auto;
  const disabled = state === "disabled" || rest.disabled;
  const forced = state !== undefined;

  const shownMessage =
    message ??
    (state === "validating" ? "Verifying email..." : state === "error" ? "Email taken. Try another one" : undefined);

  return (
    <div className={cn("w-full max-w-[372px]", className)}>
      {label && (
        <label htmlFor={inputId} className="mb-2 block text-[14px] font-semibold text-ink-muted">
          {label}
        </label>
      )}
      <div
        data-state={state ?? "auto"}
        className={cn(
          "flex h-[60px] items-center rounded-ds-sm border-[1.5px] bg-white px-4 transition-[border-color,box-shadow]",
          forced
            ? BORDER[state]
            : "border-line hover:border-ink-muted focus-within:border-field-focus focus-within:shadow-focus",
          disabled && "bg-disabled",
        )}
      >
        <input
          id={inputId}
          disabled={disabled}
          aria-invalid={state === "error" || undefined}
          aria-describedby={shownMessage ? `${inputId}-msg` : undefined}
          className={cn(
            "w-full bg-transparent text-[16px] font-normal text-ink outline-none placeholder:font-light placeholder:text-placeholder",
            disabled && "cursor-not-allowed text-placeholder",
          )}
          {...rest}
        />
      </div>
      {shownMessage && (
        <p
          id={`${inputId}-msg`}
          className={cn(
            "mt-2 flex items-center gap-2 text-[14px] font-light",
            state === "validating" && "text-field-focus",
            state === "error" && "text-danger",
            state === "success" && "text-field-success",
          )}
        >
          {state === "validating" && <Spinner />}
          {state === "error" && (
            <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-danger text-white">
              <X size={11} strokeWidth={3} aria-hidden />
            </span>
          )}
          {shownMessage}
        </p>
      )}
    </div>
  );
}
