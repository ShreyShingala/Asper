import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "neutral" | "text" | "danger" | "outline";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonForcedState = "default" | "hover" | "pressed" | "disabled" | "loading";

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[12px] gap-1.5",
  md: "h-10 px-4 text-[14px] gap-2",
  lg: "h-12 px-6 text-[16px] gap-2.5",
};

/** Same sizes as SIZE, but the height is a minimum so long (e.g. French) labels can wrap. */
const SIZE_MULTILINE: Record<ButtonSize, string> = {
  sm: "min-h-8 px-3 py-1 text-[12px] gap-1.5",
  md: "min-h-10 px-4 py-2 text-[14px] gap-2",
  lg: "min-h-12 px-6 py-2.5 text-[16px] gap-2.5",
};

const BASE =
  "inline-flex select-none items-center justify-center rounded-ds-xsm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

function sizeClass(size: ButtonSize, multiline?: boolean) {
  return multiline ? cn(SIZE_MULTILINE[size], "text-center leading-snug") : cn(SIZE[size], "whitespace-nowrap");
}

const ICON_SIZE: Record<ButtonSize, string> = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12" };

/** [natural, hover, pressed] per variant */
const VARIANT: Record<ButtonVariant, { base: string; hover: string; pressed: string }> = {
  primary: {
    base: "bg-brand text-white",
    hover: "bg-brand-strong",
    pressed: "bg-brand-deep",
  },
  neutral: {
    base: "bg-kit-gray text-ink",
    hover: "bg-[#b6bcc0]",
    pressed: "bg-[#a6adb2]",
  },
  text: {
    base: "bg-transparent text-brand",
    hover: "bg-brand-tint",
    pressed: "bg-brand-tint-strong",
  },
  danger: {
    base: "bg-kit-red text-white",
    hover: "bg-[#b53e3e]",
    pressed: "bg-[#9d3434]",
  },
  outline: {
    base: "border border-brand bg-white text-brand",
    hover: "bg-brand-tint",
    pressed: "bg-brand-tint-strong",
  },
};

function resolve(variant: ButtonVariant, state: ButtonForcedState | undefined) {
  const v = VARIANT[variant];
  if (state === "hover") return v.base + " " + v.hover;
  if (state === "pressed") return v.base + " " + v.pressed;
  return v.base;
}

const NATURAL_HOVER: Record<ButtonVariant, string> = {
  primary: "hover:bg-brand-strong active:bg-brand-deep",
  neutral: "hover:bg-[#b6bcc0] active:bg-[#a6adb2]",
  text: "hover:bg-brand-tint active:bg-brand-tint-strong active:text-brand-strong",
  danger: "hover:bg-[#b53e3e] active:bg-[#9d3434]",
  outline: "hover:bg-brand-tint active:bg-brand-tint-strong active:text-brand-strong",
};

/** Button styling for non-button elements (e.g. `<Link>` / `<a>` that should look like a button). */
export function buttonClass({
  variant = "primary",
  size = "md",
  fullWidth,
  multiline,
  disabled,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean; multiline?: boolean; disabled?: boolean; className?: string } = {}) {
  return cn(
    BASE,
    sizeClass(size, multiline),
    fullWidth && "w-full",
    disabled ? "pointer-events-none cursor-not-allowed bg-kit-gray-soft text-[#9aa0a6]" : cn(VARIANT[variant].base, NATURAL_HOVER[variant]),
    className,
  );
}

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Force a visual state for documentation. */
  state?: ButtonForcedState;
  leading?: ReactNode;
  trailing?: ReactNode;
  fullWidth?: boolean;
  /** Let the label wrap onto several lines (height becomes a minimum). */
  multiline?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = "primary",
  size = "md",
  state,
  leading,
  trailing,
  fullWidth,
  multiline,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || state === "disabled";
  const isLoading = state === "loading";
  return (
    <button
      type={type}
      disabled={isDisabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        BASE,
        sizeClass(size, multiline),
        fullWidth && "w-full",
        isDisabled
          ? "cursor-not-allowed bg-kit-gray-soft text-[#9aa0a6]"
          : cn(resolve(variant, state), state === undefined && NATURAL_HOVER[variant]),
        isLoading && "cursor-progress opacity-90",
        className,
      )}
      {...rest}
    >
      {isLoading ? <Loader2 size={size === "lg" ? 18 : 14} className="animate-ds-spin" aria-hidden /> : leading}
      {children}
      {!isLoading && trailing}
    </button>
  );
}

export function IconButton({
  variant = "neutral",
  size = "md",
  state,
  label,
  children,
  className,
  disabled,
  type = "button",
  ...rest
}: Omit<ButtonProps, "leading" | "trailing" | "fullWidth"> & { label: string }) {
  const isDisabled = disabled || state === "disabled";
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={isDisabled}
      className={cn(
        "inline-flex items-center justify-center rounded-ds-xsm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        ICON_SIZE[size],
        isDisabled
          ? "cursor-not-allowed bg-kit-gray-soft text-[#9aa0a6]"
          : cn(resolve(variant, state), state === undefined && NATURAL_HOVER[variant]),
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function TextLink({ className, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={cn(
        "text-[14px] font-medium text-brand underline decoration-brand/40 underline-offset-4 transition-colors hover:decoration-brand",
        className,
      )}
      {...rest}
    >
      {children}
    </a>
  );
}
