import { cn } from "@/lib/cn";

/**
 * "Halal Lab" mark from the Web Navigations artboard:
 * a coloured disc holding a slanted "h" built from rounded bars, two of them 45% translucent.
 */
export function LogoMark({ size = 56, color = "#0ABC5C", className }: { size?: number; color?: string; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Halal Lab logo"
      className={cn("shrink-0", className)}
    >
      <circle cx="50" cy="50" r="50" fill={color} />
      <g strokeLinecap="round" strokeWidth="8.4" fill="none">
        <path d="M30.5 36.5 H48.3" stroke="#fff" strokeOpacity="0.45" />
        <path d="M48.3 51 H58.7" stroke="#fff" strokeOpacity="0.45" />
        <path d="M38.5 64.2 L47.6 35.4" stroke="#fff" />
        <path d="M63.2 42.4 L55.9 62.5" stroke="#fff" />
      </g>
    </svg>
  );
}

export function Logo({
  color,
  size = 56,
  name = "Halal Lab",
  className,
  textClassName,
}: {
  color?: string;
  size?: number;
  name?: string;
  className?: string;
  textClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-4", className)}>
      <LogoMark size={size} color={color} />
      <span className={cn("text-[24px] leading-none font-normal text-black", textClassName)}>{name}</span>
    </span>
  );
}
