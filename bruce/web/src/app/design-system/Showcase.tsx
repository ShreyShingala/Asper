import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Section title block: bold title, light subtitle, hairline rule (matches every artboard header). */
export function SectionHeader({ id, title, subtitle, level = 2 }: { id?: string; title: string; subtitle?: string; level?: 2 | 3 }) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <header className={cn(level === 2 ? "mb-10" : "mb-6")}>
      <H id={id} className={cn("font-semibold text-ink", level === 2 ? "text-[32px] leading-tight" : "text-[20px]")}>{title}</H>
      {subtitle && <p className={cn("mt-1 font-light text-ink-muted", level === 2 ? "text-[16px]" : "text-[14px]")}>{subtitle}</p>}
      {level === 2 && <hr className="mt-5 border-line-soft" />}
    </header>
  );
}

export function Group({ id, title, subtitle, children, className }: { id?: string; title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("mt-14 first:mt-0", className)}>
      <SectionHeader id={id} level={3} title={title} subtitle={subtitle} />
      {children}
    </div>
  );
}

export function Spec({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <figure className={cn("flex flex-col gap-3", className)}>
      <figcaption className="text-[14px] font-medium text-ink-muted">{label}</figcaption>
      {children}
    </figure>
  );
}

export function Section({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("py-16 first:pt-0", className)}>
      {children}
    </section>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-ds-sm bg-kit-gray-faint p-6", className)}>{children}</div>;
}

export function Mono({ children }: { children: ReactNode }) {
  return <code className="rounded bg-kit-gray-faint px-1.5 py-0.5 font-mono text-[12px] text-ink-body">{children}</code>;
}
