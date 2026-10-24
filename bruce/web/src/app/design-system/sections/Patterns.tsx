import { Group, Section, SectionHeader } from "../Showcase";

const SHADOWS = [
  { label: "Xsm", cls: "shadow-ds-xsm", value: "0 1px 2px 0 rgb(16 20 45 / .06)" },
  { label: "Sm", cls: "shadow-ds-sm", value: "0 1px 3px 0 rgb(16 20 45 / .12)" },
  { label: "Normal", cls: "shadow-ds-normal", value: "0 4px 8px -2px rgb(16 20 45 / .12)" },
  { label: "Large", cls: "shadow-ds-lg", value: "0 12px 28px -4px rgb(16 20 45 / .14)" },
  { label: "xLarge", cls: "shadow-ds-xl", value: "0 24px 48px -8px rgb(16 20 45 / .22)" },
];

const RADII = [
  { label: "Xsm-4px", cls: "rounded-ds-xsm", token: "--radius-ds-xsm" },
  { label: "Sm-12px", cls: "rounded-ds-sm", token: "--radius-ds-sm" },
  { label: "Normal-16px", cls: "rounded-ds-normal", token: "--radius-ds-normal" },
  { label: "Large-24px", cls: "rounded-ds-lg", token: "--radius-ds-lg" },
  { label: "xLarge-70px", cls: "rounded-ds-xl shadow-ds-lg", token: "--radius-ds-xl" },
];

export function Patterns() {
  return (
    <Section id="patterns">
      <SectionHeader id="patterns-title" title="Patterns" subtitle="Shadows and corner radii used across surfaces." />

      <Group id="shadows" title="Shadows" subtitle="Base styles & states">
        <ul className="flex flex-wrap gap-8">
          {SHADOWS.map((s) => (
            <li key={s.label} className="flex flex-col gap-4">
              <div className={`h-[120px] w-[120px] bg-white ${s.cls}`} />
              <div>
                <p className="text-[14px] font-semibold text-ink-muted">{s.label}</p>
                <p className="mt-0.5 max-w-[150px] font-mono text-[10px] text-placeholder">{s.value}</p>
              </div>
            </li>
          ))}
        </ul>
      </Group>

      <Group id="radius" title="Border-Radius" subtitle="Base styles & states">
        <ul className="flex flex-wrap gap-8">
          {RADII.map((r) => (
            <li key={r.label} className="flex flex-col gap-4">
              <div className={`h-[120px] w-[120px] bg-primary ${r.cls}`} />
              <div>
                <p className="text-[14px] font-semibold text-ink-muted">{r.label}</p>
                <p className="mt-0.5 font-mono text-[10px] text-placeholder">{r.token}</p>
              </div>
            </li>
          ))}
        </ul>
      </Group>
    </Section>
  );
}
