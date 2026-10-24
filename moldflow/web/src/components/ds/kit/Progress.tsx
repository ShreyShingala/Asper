import { cn } from "@/lib/cn";

export type ProgressTone = "brand" | "green" | "orange" | "red";

const TONE_BG: Record<ProgressTone, string> = {
  brand: "bg-brand",
  green: "bg-kit-green",
  orange: "bg-kit-orange",
  red: "bg-kit-red",
};

const TONE_STROKE: Record<ProgressTone, string> = {
  brand: "stroke-brand",
  green: "stroke-kit-green",
  orange: "stroke-kit-orange",
  red: "stroke-kit-red",
};

export function ProgressBar({ value, tone = "brand", label, showValue }: { value: number; tone?: ProgressTone; label?: string; showValue?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="mb-1.5 flex justify-between text-[12px] text-ink-body">
          <span>{label}</span>
          {showValue && <span className="font-medium">{v}%</span>}
        </div>
      )}
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={label ?? "Progress"} className="h-1.5 w-full overflow-hidden rounded-full bg-kit-gray-soft">
        <div className={cn("h-full rounded-full transition-[width] duration-500", TONE_BG[tone])} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

/** Circular gauge with centred percentage (kit "Rings": red, orange, green). */
export function ProgressRing({
  value,
  tone = "green",
  size = 112,
  stroke = 4,
  caption,
}: {
  value: number;
  tone?: ProgressTone;
  size?: number;
  stroke?: number;
  caption?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={caption ?? "Progress"} className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-kit-gray-soft" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          className={cn("transition-[stroke-dashoffset] duration-700", TONE_STROKE[tone])}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-tight">
        <span className="text-[18px] font-semibold text-ink">{v}%</span>
        {caption && <span className="text-[11px] font-light text-ink-muted">{caption}</span>}
      </div>
    </div>
  );
}
