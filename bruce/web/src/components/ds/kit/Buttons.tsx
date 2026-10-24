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

const ICON_SIZE: Record<ButtonSize, string> = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12" };

/** [natural, hover, pressed] per variant */
const VARIANT: Record<ButtonVariant, { base: string; hover: string; pressed: string }> = {
  primary: {
    base: "bg-kit-blue text-white",
    hover: "bg-[#1b5cd0]",
    pressed: "bg-[#174fb4]",
  },
  neutral: {
    base: "bg-kit-gray text-ink",
    hover: "bg-[#b6bcc0]",
    pressed: "bg-[#a6adb2]",
  },
  text: {
    base: "bg-transparent text-kit-blue",
    hover: "bg-kit-blue/10",
    pressed: "bg-kit-blue/20",
  },
  danger: {
    base: "bg-kit-red text-white",
    hover: "bg-[#b53e3e]",
    pressed: "bg-[#9d3434]",
  },
  outline: {
    base: "border border-kit-blue bg-white text-kit-blue",
    hover: "bg-kit-blue/10",
    pressed: "bg-kit-blue/20",
  },
};

function resolve(variant: ButtonVariant, state: ButtonForcedState | undefined) {
  const v = VARIANT[variant];
  if (state === "hover") return v.base + " " + v.hover;
  if (state === "pressed") return v.base + " " + v.pressed;
  return v.base;
}

const NATURAL_HOVER: Record<ButtonVariant, string> = {
  primary: "hover:bg-[#1b5cd0] active:bg-[#174fb4]",
  neutral: "hover:bg-[#b6bcc0] active:bg-[#a6adb2]",
  text: "hover:bg-kit-blue/10 active:bg-kit-blue/20",
  danger: "hover:bg-[#b53e3e] active:bg-[#9d3434]",
  outline: "hover:bg-kit-blue/10 active:bg-kit-blue/20",
};

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Force a visual state for documentation. */
  state?: ButtonForcedState;
  leading?: ReactNode;
  trailing?: ReactNode;
  fullWidth?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = "primary",
  size = "md",
  state,
  leading,
  trailing,
  fullWidth,
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
        "inline-flex select-none items-center justify-center rounded-ds-xsm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kit-blue",
        SIZE[size],
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
        "inline-flex items-center justify-center rounded-ds-xsm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kit-blue",
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
        "text-[14px] font-medium text-kit-blue underline decoration-kit-blue/40 underline-offset-4 transition-colors hover:decoration-kit-blue",
        className,
      )}
      {...rest}
    >
      {children}
    </a>
  );
}
