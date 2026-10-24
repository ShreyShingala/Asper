import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Kit card surface: 4px radius, soft gray border, xsm shadow, white fill. */
export const cardSurface = "rounded-ds-xsm border border-kit-gray-soft bg-white shadow-ds-xsm";

export function Card({ title, children, actions, className }: { title?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3 p-4", cardSurface, className)}>
      {title && <h4 className="text-[14px] font-semibold text-ink">{title}</h4>}
      <div className="text-[13px] leading-5 font-light text-ink-body">{children}</div>
      {actions}
    </section>
  );
}

export function EmptyState({ title = "Nothing here yet", description = "When you add items they will show up in this space.", action, className }: { title?: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-ds-xsm bg-kit-gray-faint px-6 py-10 text-center", className)}>
      <svg width="220" height="140" viewBox="0 0 220 140" role="img" aria-label="Illustration of a person holding a flag">
        <ellipse cx="110" cy="122" rx="62" ry="8" fill="#E1E4EA" />
        <path d="M58 98 C 40 70, 66 36, 100 40 C 118 18, 160 26, 164 58 C 190 62, 188 98, 160 100 Z" fill="#E4EBFB" />
        <circle cx="132" cy="44" r="14" fill="#C9D8FA" />
        <rect x="104" y="74" width="12" height="38" rx="5" fill="#14102A" />
        <circle cx="110" cy="66" r="7.5" fill="#E8B898" />
        <path d="M100 76 H120 L124 96 H96 Z" fill="#E57439" />
        <path d="M120 78 L134 52" stroke="#E8B898" strokeWidth="5" strokeLinecap="round" />
        <path d="M134 52 V30" stroke="#14102A" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M134 30 H152 L146 36 L152 42 H134 Z" fill="#2169E8" />
        <rect x="101" y="108" width="8" height="12" rx="3" fill="#14102A" />
        <rect x="111" y="108" width="8" height="12" rx="3" fill="#14102A" />
      </svg>
      <h4 className="text-[16px] font-semibold text-ink">{title}</h4>
      <p className="max-w-[300px] text-[13px] font-light text-ink-muted">{description}</p>
      {action}
    </div>
  );
}
