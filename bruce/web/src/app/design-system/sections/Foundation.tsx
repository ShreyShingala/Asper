import { brandPalette, semanticPalette, type Swatch } from "@/lib/ds/palette.generated";
import { Group, Section, SectionHeader } from "../Showcase";

const STEPS: { key: keyof Swatch["scale"]; label: string }[] = [
  { key: "dark", label: "Dark 10%" },
  { key: "light", label: "Light 90%" },
  { key: "75", label: "75%" },
  { key: "50", label: "50%" },
  { key: "25", label: "25%" },
  { key: "10", label: "10%" },
];

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ColorCard({ swatch, hexLabel }: { swatch: Swatch; hexLabel?: string }) {
  return (
    <figure className="w-full max-w-[260px]">
      <figcaption className="mb-2 text-[14px] font-medium text-ink-body">{swatch.name}</figcaption>
      <div className="overflow-hidden rounded-t-ds-normal">
        <div className="flex h-[138px] items-center justify-center text-[18px] font-normal text-white" style={{ background: swatch.hex }}>
          {hexLabel ?? swatch.hex}
        </div>
        <ul className="flex h-[46px]" aria-label={`${swatch.name} tints`}>
          {STEPS.map((s) => {
            const hex = swatch.scale[s.key];
            return (
              <li
                key={s.key}
                title={hex}
                className="flex flex-1 items-end justify-center pb-1 text-[7px] font-medium leading-none"
                style={{ background: hex, color: luminance(hex) < 0.6 ? "#fff" : "#000" }}
              >
                {s.label}
              </li>
            );
          })}
        </ul>
      </div>
      <p className="mt-2 font-mono text-[11px] text-ink-muted">{swatch.usage}</p>
    </figure>
  );
}

type TypeRow = { name: string; size: number; weight: number; weightLabel: string; cls: string };

const HEADINGS: TypeRow[] = [
  { name: "H2 Headline", size: 64, weight: 700, weightLabel: "Bold", cls: "text-h2" },
  { name: "H3 Headline", size: 48, weight: 700, weightLabel: "Bold", cls: "text-h3" },
  { name: "H4 Headline", size: 40, weight: 700, weightLabel: "Bold", cls: "text-h4" },
  { name: "H5 Headline", size: 32, weight: 700, weightLabel: "Bold", cls: "text-h5" },
  { name: "H6 Headline", size: 24, weight: 700, weightLabel: "Bold", cls: "text-h6" },
  { name: "SubHeading", size: 18, weight: 700, weightLabel: "Bold", cls: "text-subheading" },
];

const BODY: TypeRow[] = [
  { name: "Body-Text", size: 16, weight: 700, weightLabel: "Bold", cls: "text-body" },
  { name: "Subtitle", size: 14, weight: 700, weightLabel: "Bold", cls: "text-subtitle" },
  { name: "Caption", size: 12, weight: 600, weightLabel: "Semi-Bold", cls: "text-caption" },
];

function TypeTable({ title, rows }: { title: string; rows: TypeRow[] }) {
  return (
    <div className="mt-6">
      <h4 className="mb-4 text-[32px] font-light text-ink-body">{title}</h4>
      <div role="table" aria-label={title} className="@container">
        {rows.map((r) => (
          <div key={r.name} role="row" className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-4 border-t border-dashed border-line-soft py-6 first:border-t-0 sm:py-8">
            {[r.name, `${r.size}px`, r.weightLabel].map((cell, i) => (
              <p
                key={i}
                role="cell"
                className={`${r.cls} min-w-0 text-black`}
                // Keeps the spec size on desktop; shrinks only when the container is too narrow to hold it.
                style={{ fontWeight: r.weight, fontSize: `min(${r.size}px, ${(r.size * 0.095).toFixed(2)}cqw)` }}
              >
                {cell}
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Foundation() {
  return (
    <Section id="foundation">
      <SectionHeader id="foundation-title" title="Foundation" subtitle="Colour, type and the base tokens every component is built from." />

      <Group id="color-scheme" title="Color Scheme" subtitle="Colors are used for elements that must reflect & show the branding.">
        <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
          {brandPalette.map((s) => (
            <ColorCard key={s.key} swatch={s} />
          ))}
        </div>
      </Group>

      <Group id="alert-colors" title="Alerts" subtitle="Semantic colors used for feedback states.">
        <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
          {semanticPalette.map((s) => (
            <ColorCard key={s.key} swatch={s} />
          ))}
        </div>
        <p className="mt-6 max-w-[640px] text-[13px] font-light text-ink-muted">
          Every scale follows the same rule: <span className="font-medium">Dark 10%</span> is the base mixed with 10% black, <span className="font-medium">Light 90%</span> through{" "}
          <span className="font-medium">10%</span> are the base at that opacity over white. The source artboard prints &ldquo;#3366FF&rdquo; on the Warning swatch; the swatch itself is
          #FFB020, which is what is used here.
        </p>
      </Group>

      <Group id="typography" title="Typography Scale" subtitle="Poppins. Type sizes and weights for headings, body text, subtitles and captions.">
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b border-line-soft pb-3 text-[20px] font-semibold text-ink">
          <span>TypeScale</span>
          <span>Font Size</span>
          <span>Font Weight</span>
        </div>
        <TypeTable title="Headings" rows={HEADINGS} />
        <TypeTable title="Body-Text, Subtitle, Caption" rows={BODY} />
      </Group>
    </Section>
  );
}
