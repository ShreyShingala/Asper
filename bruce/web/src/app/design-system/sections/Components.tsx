import { Alert, type AlertVariant } from "@/components/ds/Alert";
import { Avatar, AvatarStack, AVATAR_SIZES, type AvatarBadge } from "@/components/ds/Avatar";
import { TextField } from "@/components/ds/TextField";
import { WebNav } from "@/components/ds/WebNav";
import { Group, Section, SectionHeader, Spec } from "../Showcase";

/** Avatar with the artboard's pink L-shaped dimension guide + px labels. */
function SizedAvatar({ size }: { size: number }) {
  const label = `${size}px`;
  return (
    <figure className="flex flex-col items-start">
      <div className="flex items-end gap-1.5">
        <span
          className="select-none text-[12px] font-light text-ink-muted [writing-mode:vertical-rl] rotate-180"
          style={{ fontSize: size >= 48 ? 14 : 10, lineHeight: 1 }}
        >
          {label}
        </span>
        <div className="relative border-b-2 border-l-2 border-[#F9DDE3] p-0" style={{ padding: 0 }}>
          <Avatar size={size} alt={`${size}px avatar`} />
        </div>
      </div>
      <figcaption className="mt-1.5 pl-6 text-ink-muted" style={{ fontSize: size >= 48 ? 14 : 10 }}>
        {label}
      </figcaption>
    </figure>
  );
}

const TYPES: { label: string; kind?: "empty" | "initial" | "image"; badge?: AvatarBadge; divider?: boolean }[] = [
  { label: "Empty", kind: "empty", divider: true },
  { label: "Initial", kind: "initial", divider: true },
  { label: "User Pic", kind: "image", divider: true },
  { label: "Editing", kind: "image", badge: "editing", divider: true },
  { label: "Uploaded", kind: "image", badge: "uploaded", divider: true },
  { label: "User Active", kind: "image", badge: "active" },
  { label: "User Inactive", kind: "image", badge: "inactive" },
  { label: "Error Upload", kind: "initial", badge: "error" },
  { label: "Locked", kind: "image", badge: "locked" },
];

const ALERT_ROWS: { variant: AlertVariant; label: string; copy: { title: string; description: string }; hasPressed: boolean }[] = [
  { variant: "success", label: "Success", copy: { title: "Congratulations!", description: "Your profile verified" }, hasPressed: true },
  { variant: "info", label: "Info", copy: { title: "Information", description: "Your profile verified" }, hasPressed: true },
  { variant: "warning", label: "Warning", copy: { title: "Warning!", description: "Your profile verified" }, hasPressed: true },
  { variant: "danger", label: "Danger", copy: { title: "Warning!", description: "Your profile verified" }, hasPressed: true },
];

export function Components() {
  return (
    <Section id="components">
      <SectionHeader id="components-title" title="Components" subtitle="Navigation, avatars, alerts and inputs, each with their documented states." />

      {/* ---------------------------------------------------------------- Web Navigations */}
      <Group id="web-navigations" title="Web Navigations" subtitle="Base styles & states">
        <div className="flex flex-col gap-10 bg-white py-2">
          <Spec label="Outline CTA (floating card)">
            <WebNav variant="outline" />
          </Spec>
          <Spec label="Solid CTA (logo overhang, full-height button)">
            <WebNav variant="solid" />
          </Spec>
          <Spec label="Blue (active link, Log In + tinted CTA)">
            <WebNav variant="blue" />
          </Spec>
        </div>
      </Group>

      {/* ---------------------------------------------------------------- Avatars */}
      <div className="mt-20">
        <SectionHeader id="avatars" title="Avatars" subtitle="You can use different size of the avatar" />

        <Group title="Sizes" subtitle="Avatars with various states">
          <div className="flex flex-wrap items-end gap-x-10 gap-y-6">
            {AVATAR_SIZES.map((s) => (
              <SizedAvatar key={s} size={s} />
            ))}
          </div>
        </Group>

        <Group title="Types" subtitle="Avatars with various states">
          <ul className="flex flex-wrap items-start gap-y-8">
            {TYPES.map((t) => (
              <li key={t.label} className={`flex flex-col items-center gap-3 px-6 first:pl-0 ${t.divider ? "border-r border-line-soft" : ""}`}>
                <Avatar size={56} kind={t.kind} badge={t.badge} alt={t.label} />
                <span className="text-[14px] font-light text-ink-muted">{t.label}</span>
              </li>
            ))}
          </ul>
        </Group>

        <Group title="Avatar stacked" subtitle="Stacked avatars can be used to show multiple collaborators">
          <div className="flex flex-wrap items-end gap-14">
            {([48, 32, 24] as const).map((s) => (
              <figure key={s} className="flex flex-col gap-3">
                <AvatarStack size={s} />
                <figcaption className="border-t-2 border-kit-gray-soft pt-2 text-[14px] font-light text-ink-muted">{s}px Stack avatars</figcaption>
              </figure>
            ))}
          </div>
        </Group>
      </div>

      {/* ---------------------------------------------------------------- Alerts */}
      <div className="mt-20">
        <SectionHeader id="alerts" title="Alerts" subtitle="The Alert component is used to show feedback to the user about an action or state." />
        <div className="flex flex-col gap-10">
          {ALERT_ROWS.map((row) => (
            <div key={row.variant} className="grid gap-x-8 gap-y-6 lg:grid-cols-3">
              {(["default", "hover", "pressed"] as const).map((st) => (
                <Spec key={st} label={st === "default" ? row.label : st === "hover" ? "Hover" : "Pressed"}>
                  <div className="relative">
                    <Alert variant={row.variant} state={st} title={row.copy.title} description={row.copy.description} dismissible />
                    {row.variant === "success" && st === "default" && (
                      <>
                        <span className="pointer-events-none absolute -left-7 top-1/2 hidden -translate-y-1/2 -rotate-90 text-[11px] font-light text-ink-muted xl:block">68px</span>
                        <span className="pointer-events-none absolute left-0 top-full mt-1 hidden border-t border-kit-gray-soft pt-1 text-[11px] font-light text-ink-muted xl:block">440px (auto)</span>
                      </>
                    )}
                  </div>
                </Spec>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-8 text-[13px] font-light text-ink-muted">Tip: the Hover and Pressed specimens are forced. The live alert below reacts to real pointer events and can be dismissed.</p>
        <div className="mt-4 flex flex-col gap-3">
          <Alert variant="info" title="Live alert" description="Hover or click the close button" />
        </div>
      </div>

      {/* ---------------------------------------------------------------- Inputs */}
      <div className="mt-20">
        <SectionHeader id="inputs" title="Inputs" subtitle="The Input component is used to collect text and show feedback about its state." />
        <div className="grid gap-x-10 gap-y-14 md:grid-cols-2 xl:grid-cols-3">
          <Spec label="Inactive / Default">
            <div className="relative">
              <TextField label="Email" placeholder="example@mail.com" state="default" aria-label="Email default" />
              <span className="pointer-events-none absolute -left-7 top-[34px] hidden -rotate-90 text-[11px] font-light text-ink-muted xl:block">60px</span>
              <span className="pointer-events-none mt-1 hidden text-[11px] font-light text-ink-muted xl:block">372px (auto)</span>
            </div>
          </Spec>
          <Spec label="Hover">
            <TextField label="Email" placeholder="example@mail.com" state="hover" aria-label="Email hover" />
          </Spec>
          <Spec label="Focus / Active">
            <TextField label="Email" defaultValue="Hellohalallab" state="focus" aria-label="Email focus" />
          </Spec>
          <Spec label="Inline validating">
            <TextField label="Email" defaultValue="Hellohalallab@gmail.com" state="validating" aria-label="Email validating" />
          </Spec>
          <Spec label="Error">
            <TextField label="Email" defaultValue="Hellohalallab@gmail.com" state="error" aria-label="Email error" />
          </Spec>
          <Spec label="Success">
            <TextField label="Email" defaultValue="Hellohalallab@gmail.com" state="success" aria-label="Email success" />
          </Spec>
          <Spec label="Disabled">
            <TextField label="Email" defaultValue="Hellohalallab@gmail.com" state="disabled" aria-label="Email disabled" />
          </Spec>
          <Spec label="Live (real hover / focus)">
            <TextField label="Email" placeholder="Try me: hover, focus, type" />
          </Spec>
        </div>
      </div>
    </Section>
  );
}
