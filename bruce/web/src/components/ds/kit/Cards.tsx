import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./Buttons";

export function Card({ title, children, actions, className }: { title?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-ds-xsm border border-kit-gray-soft bg-white p-4 shadow-ds-xsm", className)}>
      {title && <h4 className="text-[14px] font-semibold text-ink">{title}</h4>}
      <div className="text-[13px] leading-5 font-light text-ink-body">{children}</div>
      {actions}
    </section>
  );
}

/** Card with a header image, short copy and Cancel / Confirm style actions. */
export function MediaCard({ title, children, onPrimary, onSecondary }: { title: string; children: ReactNode; onPrimary?: () => void; onSecondary?: () => void }) {
  return (
    <article className="flex w-full max-w-[520px] overflow-hidden rounded-ds-xsm bg-white shadow-ds-normal">
      <div className="relative hidden w-[132px] shrink-0 sm:block" aria-hidden>
        <svg viewBox="0 0 132 160" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="mc-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3b4f6b" />
              <stop offset="0.55" stopColor="#1d2a3d" />
              <stop offset="1" stopColor="#0f1724" />
            </linearGradient>
          </defs>
          <rect width="132" height="160" fill="url(#mc-sky)" />
          <path d="M0 98 C 20 90, 40 104, 66 96 S 112 88, 132 98 V160 H0Z" fill="#16324a" />
          <path d="M0 116 C 24 108, 44 122, 70 114 S 112 108, 132 116 V160 H0Z" fill="#0d2236" />
          <circle cx="72" cy="86" r="9" fill="#e6c4a8" />
          <path d="M58 122 C 60 100, 84 100, 88 122 Z" fill="#f2f2f2" />
          <path d="M40 126 L96 118" stroke="#8fb6d9" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h4 className="text-[14px] font-semibold text-ink">{title}</h4>
        <p className="text-[12px] leading-5 font-light text-ink-body">{children}</p>
        <div className="mt-auto flex justify-end gap-2 pt-2">
          <Button size="sm" variant="text" onClick={onSecondary}>
            Cancel
          </Button>
          <Button size="sm" onClick={onPrimary}>
            Continue
          </Button>
        </div>
      </div>
    </article>
  );
}

export function EmptyState({ title = "Nothing here yet", description = "When you add items they will show up in this space.", action }: { title?: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-ds-xsm bg-kit-gray-faint px-6 py-10 text-center">
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

/** 12-column layout grid used for the Grid specimen. */
export function GridSpecimen() {
  const rows: number[][] = [
    Array(12).fill(1),
    Array(6).fill(2),
    Array(4).fill(3),
    [12],
  ];
  return (
    <div className="flex flex-col gap-3" role="img" aria-label="12 column grid with 12, 6, 4 and 1 column layouts">
      {rows.map((r, ri) => (
        <div key={ri} className="grid grid-cols-12 gap-3">
          {r.map((span, i) => (
            <div
              key={i}
              style={{ gridColumn: `span ${span} / span ${span}` }}
              className="flex h-10 items-center justify-center rounded-ds-xsm bg-kit-gray-faint text-[11px] text-ink-muted"
            >
              {span}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
