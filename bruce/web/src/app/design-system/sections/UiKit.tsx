import { ArrowRight, Download, Plus, Search, Settings, Trash2, User, Bell, Home, Folder, BarChart3, Users, Mail } from "lucide-react";
import { Button, IconButton, TextLink } from "@/components/ds/kit/Buttons";
import { Calendar } from "@/components/ds/kit/Calendar";
import { Card, EmptyState, GridSpecimen, MediaCard } from "@/components/ds/kit/Cards";
import { BarChart, LineChart } from "@/components/ds/kit/Charts";
import { DemoList, DemoTable } from "@/components/ds/kit/DemoTable";
import { Banner, DarkPill, Loader, ModalDemo, ModalSurface, NotificationBar, Popover, PopoverMenu, Tag, Tooltip } from "@/components/ds/kit/Feedback";
import { Checkbox, KitInput, KitSelect, KitTextarea, Radio, SearchCombobox, Toggle } from "@/components/ds/kit/Forms";
import { BackLink, Breadcrumb, ListRow, SearchRow, SidebarMenu, Tabs } from "@/components/ds/kit/Navigation";
import { ProgressBar, ProgressRing } from "@/components/ds/kit/Progress";
import { kitPalette } from "@/lib/ds/palette.generated";
import { ICON_SET } from "@/lib/ds/icons";
import { sampleSeries } from "@/lib/ds/series";
import { Group, Panel, Section, SectionHeader, Spec } from "../Showcase";

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ");

const KIT_TYPE = [
  { name: "Heading 1", spec: "42px / 50px", cls: "text-[42px] leading-[50px] font-bold" },
  { name: "Heading 2", spec: "34px / 42px", cls: "text-[34px] leading-[42px] font-bold" },
  { name: "Heading 3", spec: "28px / 36px", cls: "text-[28px] leading-[36px] font-semibold" },
  { name: "Heading 4", spec: "24px / 32px", cls: "text-[24px] leading-[32px] font-semibold" },
  { name: "Heading 5", spec: "20px / 28px", cls: "text-[20px] leading-[28px] font-semibold" },
  { name: "Heading 6", spec: "16px / 24px", cls: "text-[16px] leading-[24px] font-semibold" },
  { name: "Body", spec: "16px / 24px", cls: "text-[16px] leading-[24px] font-normal" },
  { name: "Body small", spec: "14px / 20px", cls: "text-[14px] leading-[20px] font-normal" },
  { name: "Caption", spec: "12px / 16px", cls: "text-[12px] leading-[16px] font-normal" },
  { name: "Overline", spec: "11px / 16px, +0.08em", cls: "text-[11px] leading-[16px] font-semibold uppercase tracking-[0.08em]" },
];

const BAR_A = sampleSeries(40, 7, 8, 100);
const BAR_B = sampleSeries(12, 21, 6, 90, "");
const LINE_A = sampleSeries(30, 3, 20, 95);
const LINE_B = sampleSeries(20, 11, 25, 95);

const CITIES = ["Ottawa, ON", "Gatineau, QC", "Montréal, QC", "Toronto, ON", "Québec City, QC", "Sydney, AU", "Ho Chi Minh City, VN", "Vancouver, BC", "Calgary, AB"];

export function UiKit() {
  return (
    <Section id="ui-kit">
      <SectionHeader id="ui-kit-title" title="UI Kit" subtitle="Every element from the Style Guide and Frame 1 exports: layout, colour, type, icons, feedback, controls, data and overlays." />

      {/* ------------------------------------------------------------- Grid */}
      <Group id="grid" title="Grid" subtitle="A 12-column layout grid. Columns collapse in multiples of 1, 2, 3, 4 and 12.">
        <GridSpecimen />
      </Group>

      {/* ------------------------------------------------------------- Kit colours */}
      <Group id="kit-colors" title="Colors" subtitle="Kit palette with HEX and RGB values.">
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {kitPalette.map((c) => (
            <li key={c.key}>
              <div className="h-14 rounded-ds-xsm border border-black/5" style={{ background: c.hex }} />
              <p className="mt-2 text-[13px] font-semibold text-ink">{c.name}</p>
              <dl className="mt-0.5 grid grid-cols-[auto_1fr] gap-x-3 font-mono text-[11px] text-ink-muted">
                <dt>HEX</dt>
                <dd>{c.hex}</dd>
                <dt>RGB</dt>
                <dd>{rgb(c.hex)}</dd>
                <dt>Token</dt>
                <dd>{c.key}</dd>
              </dl>
            </li>
          ))}
        </ul>
      </Group>

      {/* ------------------------------------------------------------- Typography */}
      <Group id="kit-typography" title="Typography" subtitle="Headings and text styles with size / line-height.">
        <div className="overflow-hidden rounded-ds-xsm bg-kit-gray-faint">
          <div className="grid grid-cols-[1fr_auto] gap-6 px-6 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            <span>Style</span>
            <span>Size / Line height</span>
          </div>
          {KIT_TYPE.map((t) => (
            <div key={t.name} className="grid grid-cols-[1fr_auto] items-baseline gap-6 border-t border-white/70 px-6 py-3 text-ink">
              <span className={t.cls}>{t.name}</span>
              <span className="font-mono text-[12px] text-ink-muted">{t.spec}</span>
            </div>
          ))}
        </div>
      </Group>

      {/* ------------------------------------------------------------- Icons */}
      <Group id="icons" title="Icons" subtitle={`${ICON_SET.length} glyphs, 20px / 1.75 stroke. Hover or focus an icon to see its name.`}>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1 rounded-ds-xsm bg-kit-gray-faint p-4">
          {ICON_SET.map(({ name, Icon }) => (
            <li key={name}>
              <button
                type="button"
                title={name}
                aria-label={name}
                className="flex h-11 w-full items-center justify-center rounded text-ink transition-colors hover:bg-white hover:text-kit-blue focus-visible:outline-2 focus-visible:outline-kit-blue"
              >
                <Icon size={20} strokeWidth={1.75} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </Group>

      {/* ------------------------------------------------------------- Alerts (banners) */}
      <Group id="banners" title="Alerts" subtitle="Full-width banners: neutral, success, warning and error.">
        <div className="flex flex-col gap-2">
          <Banner tone="navy">Heads up: your inspection link expires in 24 hours.</Banner>
          <Banner tone="green">Report approved. The customer has been notified.</Banner>
          <Banner tone="orange">Photo is blurry. Retake it for a better reading.</Banner>
          <Banner tone="red">Payment failed. Check the card details and try again.</Banner>
        </div>
      </Group>

      {/* ------------------------------------------------------------- Loaders */}
      <Group id="loaders" title="Loaders" subtitle="Ring, dots, bars and pulse indicators.">
        <div className="flex flex-wrap items-center gap-10">
          {(["ring", "dots", "bars", "pulse"] as const).map((v) => (
            <Spec key={v} label={v}>
              <Loader variant={v} size={32} label={`${v} loader`} />
            </Spec>
          ))}
        </div>
      </Group>

      {/* ------------------------------------------------------------- Buttons */}
      <Group id="buttons" title="Buttons" subtitle="Variants x sizes x states. Hover and Pressed rows are forced for documentation.">
        <div className="flex flex-col gap-10">
          {(["lg", "md", "sm"] as const).map((size) => (
            <div key={size}>
              <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Size {size}</p>
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-x-4 border-spacing-y-3 text-left text-[12px] text-ink-muted">
                  <thead>
                    <tr>
                      <th className="font-medium" />
                      {(["Default", "Hover", "Pressed", "Disabled", "Loading"] as const).map((h) => (
                        <th key={h} className="font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(["primary", "neutral", "outline", "text", "danger"] as const).map((variant) => (
                      <tr key={variant}>
                        <th scope="row" className="pr-2 font-medium capitalize">
                          {variant}
                        </th>
                        {(["default", "hover", "pressed", "disabled", "loading"] as const).map((st) => (
                          <td key={st}>
                            <Button variant={variant} size={size} state={st}>
                              Button
                            </Button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <Spec label="With icons">
            <div className="flex flex-wrap items-center gap-3">
              <Button leading={<Plus size={16} aria-hidden />}>Add capture</Button>
              <Button variant="neutral" trailing={<ArrowRight size={16} aria-hidden />}>
                Continue
              </Button>
              <Button variant="outline" leading={<Download size={16} aria-hidden />}>
                Download report
              </Button>
              <Button variant="danger" leading={<Trash2 size={16} aria-hidden />}>
                Delete
              </Button>
              <Button fullWidth className="max-w-[240px]">
                Full width
              </Button>
            </div>
          </Spec>

          <Spec label="Icon buttons">
            <div className="flex flex-wrap items-center gap-3">
              {(["neutral", "primary", "text", "outline", "danger"] as const).map((v) => (
                <IconButton key={v} variant={v} label={`${v} settings`}>
                  <Settings size={18} aria-hidden />
                </IconButton>
              ))}
              <IconButton variant="primary" state="hover" label="Hover">
                <Plus size={18} aria-hidden />
              </IconButton>
              <IconButton variant="primary" state="pressed" label="Pressed">
                <Plus size={18} aria-hidden />
              </IconButton>
              <IconButton variant="primary" state="disabled" label="Disabled">
                <Plus size={18} aria-hidden />
              </IconButton>
              <IconButton variant="primary" size="sm" label="Small">
                <Plus size={14} aria-hidden />
              </IconButton>
              <IconButton variant="primary" size="lg" label="Large">
                <Plus size={22} aria-hidden />
              </IconButton>
            </div>
          </Spec>

          <Spec label="Links">
            <div className="flex flex-wrap items-center gap-6">
              <TextLink href="#buttons">Text link</TextLink>
              <TextLink href="#buttons" className="text-kit-red decoration-kit-red/40 hover:decoration-kit-red">
                Danger link
              </TextLink>
              <TextLink href="#buttons" className="text-ink-body decoration-ink-body/30">
                Neutral link
              </TextLink>
            </div>
          </Spec>
        </div>
      </Group>

      {/* ------------------------------------------------------------- Tags */}
      <Group id="tags" title="Tags" subtitle="Solid and soft tones.">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            {(["gray", "blue", "green", "orange", "red"] as const).map((t) => (
              <Tag key={t} tone={t}>
                {t[0].toUpperCase() + t.slice(1)}
              </Tag>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {(["gray", "blue", "green", "orange", "red"] as const).map((t) => (
              <Tag key={t} tone={t} soft>
                {t[0].toUpperCase() + t.slice(1)}
              </Tag>
            ))}
          </div>
        </div>
      </Group>

      {/* ------------------------------------------------------------- Inputs / forms */}
      <Group id="forms" title="Inputs" subtitle="Text fields, textarea and selects in default, focus, error and disabled states.">
        <div className="flex flex-col gap-10">
          <div className="grid gap-6 md:grid-cols-3">
            <KitInput label="Default" placeholder="Placeholder" />
            <KitInput label="With icon" placeholder="Search captures" icon={<Search size={16} aria-hidden />} />
            <KitInput label="With value" defaultValue="Basement sink" />
            <KitInput label="Error" defaultValue="not-an-email" error="Enter a valid email address" />
            <KitInput label="Hint" placeholder="you@example.com" hint="We never share your email." />
            <KitInput label="Disabled" defaultValue="Locked value" disabled />
          </div>
          <KitTextarea label="Textarea" placeholder="Describe the area, access and any odour…" hint="Bruce uses this to ask better follow-up questions." />
          <div className="grid gap-6 md:grid-cols-3">
            <KitSelect label="Select" defaultValue="">
              <option value="" disabled>
                Choose location
              </option>
              <option>Basement</option>
              <option>Attic</option>
              <option>Washroom</option>
            </KitSelect>
            <KitSelect label="Select with marker" prefixDot defaultValue="Basement">
              <option>Basement</option>
              <option>Attic</option>
              <option>Washroom</option>
            </KitSelect>
            <KitSelect label="Disabled select" disabled defaultValue="Basement">
              <option>Basement</option>
            </KitSelect>
          </div>
        </div>
      </Group>

      <Group id="search" title="Search & dropdown" subtitle="Combobox with filtering, arrow-key navigation, Enter to select and Esc to close.">
        <div className="flex flex-wrap items-start gap-10">
          <div className="w-full max-w-[360px]">
            <SearchCombobox options={CITIES} placeholder="Search a city…" label="Search cities" />
          </div>
          <div className="w-full max-w-[360px]">
            <SearchRow placeholder="Search with icon" />
          </div>
        </div>
      </Group>

      <Group id="selection" title="Checkbox, radio & toggle" subtitle="Native inputs, restyled. Fully keyboard accessible.">
        <div className="grid gap-8 md:grid-cols-3">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Checkbox</legend>
            <Checkbox label="Unchecked" />
            <Checkbox label="Checked" defaultChecked />
            <Checkbox label="Disabled" disabled />
            <Checkbox label="Disabled checked" disabled defaultChecked />
          </fieldset>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Radio</legend>
            <Radio name="kit-radio" label="Option one" defaultChecked />
            <Radio name="kit-radio" label="Option two" />
            <Radio name="kit-radio" label="Disabled" disabled />
          </fieldset>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Toggle</legend>
            <Toggle label="Off" />
            <Toggle label="On" defaultChecked />
            <Toggle label="Disabled" disabled />
          </fieldset>
        </div>
      </Group>

      {/* ------------------------------------------------------------- Datepickers */}
      <Group id="datepickers" title="Datepickers" subtitle="Single date, date range, and the dark menu surface.">
        <div className="flex flex-wrap items-start gap-8">
          <Spec label="Single date">
            <Calendar mode="single" defaultStart={[2026, 9, 14]} />
          </Spec>
          <Spec label="Date range">
            <Calendar mode="range" defaultStart={[2026, 9, 8]} defaultEnd={[2026, 9, 22]} />
          </Spec>
          <Spec label="Menu">
            <PopoverMenu
              items={[
                { label: "Today" },
                { label: "Yesterday" },
                { label: "Last 7 days" },
                { label: "Last 30 days" },
                { label: "Custom range…", icon: "edit" },
              ]}
            />
          </Spec>
        </div>
      </Group>

      {/* ------------------------------------------------------------- Cards */}
      <Group id="cards" title="Cards" subtitle="Content card with action, and media card.">
        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Estimate ready" actions={<Button fullWidth>View estimate</Button>}>
            Based on 3 captures we suggest a virtual inspection. The estimate range is illustrative until an inspector confirms it.
          </Card>
          <Card title="Inspector review" actions={<Button fullWidth variant="outline">Open queue</Button>}>
            2 reports are waiting for approval. Average approval time is five minutes.
          </Card>
          <Card title="Details">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
              <dt className="text-ink-muted">Customer</dt>
              <dd className="text-ink">Homeowner, Ottawa</dd>
              <dt className="text-ink-muted">Route</dt>
              <dd className="text-ink">On-site $195 + HST</dd>
              <dt className="text-ink-muted">Status</dt>
              <dd>
                <Tag tone="orange" soft>
                  Awaiting review
                </Tag>
              </dd>
            </dl>
          </Card>
          <MediaCard title="Moisture reading logged">Thermal anomaly noted below the roofline. Add a photo for scale, then continue to the report.</MediaCard>
        </div>
      </Group>

      {/* ------------------------------------------------------------- Tabs */}
      <Group id="tabs" title="Tabs" subtitle="Underline and pill styles. Arrow keys move between tabs.">
        <div className="flex flex-col items-start gap-8">
          <Tabs
            label="Report sections"
            items={[
              { id: "summary", label: "Summary" },
              { id: "findings", label: "Findings" },
              { id: "photos", label: "Photos" },
              { id: "estimate", label: "Estimate" },
              { id: "locked", label: "Locked", disabled: true },
            ]}
          />
          <Tabs
            variant="pill"
            label="View"
            items={[
              { id: "day", label: "Day" },
              { id: "week", label: "Week" },
              { id: "month", label: "Month" },
            ]}
          />
        </div>
      </Group>

      {/* ------------------------------------------------------------- Progress */}
      <Group id="progress" title="Progress" subtitle="Linear bars and circular rings.">
        <div className="flex flex-col gap-10">
          <div className="grid max-w-[520px] gap-5">
            <ProgressBar value={72} label="Upload" showValue />
            <ProgressBar value={48} tone="orange" label="Moisture confidence" showValue />
            <ProgressBar value={91} tone="green" label="Report completeness" showValue />
            <ProgressBar value={20} tone="red" label="Low battery" showValue />
          </div>
          <div className="flex flex-wrap gap-8">
            <ProgressRing value={34} tone="red" caption="Severity" />
            <ProgressRing value={72} tone="orange" caption="Moisture" />
            <ProgressRing value={93} tone="green" caption="Confidence" />
          </div>
        </div>
      </Group>

      {/* ------------------------------------------------------------- Charts */}
      <Group id="charts" title="Charts" subtitle="Bar and line charts with hover tooltips. SVG, no chart dependency.">
        <div className="grid gap-x-10 gap-y-10 lg:grid-cols-2">
          <Spec label="Bar (dense)">
            <BarChart data={BAR_A} barRatio={0.6} title="Scans per day, dense bar chart" />
          </Spec>
          <Spec label="Line">
            <LineChart data={LINE_A} title="Conversion rate trend" area={false} />
          </Spec>
          <Spec label="Bar (wide)">
            <BarChart data={BAR_B} barRatio={0.7} title="Scans per month, wide bar chart" />
          </Spec>
          <Spec label="Line with area + tooltip">
            <LineChart data={LINE_B} title="Estimated job value" />
          </Spec>
        </div>
      </Group>

      {/* ------------------------------------------------------------- Table */}
      <Group id="table" title="Table" subtitle="Selectable rows, indeterminate select-all and sortable headers.">
        <div className="grid gap-8 xl:grid-cols-[2fr_1fr]">
          <DemoTable />
          <DemoList />
        </div>
      </Group>

      {/* ------------------------------------------------------------- Empty state */}
      <Group id="empty-state" title="Empty state" subtitle="Illustration, short copy and an optional action.">
        <EmptyState action={<Button leading={<Plus size={16} aria-hidden />}>Start a scan</Button>} />
      </Group>

      {/* ------------------------------------------------------------- Notifications */}
      <Group id="notifications" title="Notifications" subtitle="Dark full-width bar with dismiss.">
        <NotificationBar>Your report is ready. We emailed you a link.</NotificationBar>
      </Group>

      {/* ------------------------------------------------------------- Popovers & tooltips */}
      <Group id="popovers" title="Popovers" subtitle="Dark surfaces: plain text, action menu and rich text.">
        <div className="flex flex-wrap items-start gap-6">
          <Popover className="flex min-h-[88px] w-[220px] items-center justify-center text-center">Plain popover text</Popover>
          <PopoverMenu
            items={[
              { label: "Approve", icon: "check" },
              { label: "Edit", icon: "edit" },
              { label: "Add note" },
              { label: "Reject" },
            ]}
          />
          <Popover className="w-[260px]">
            <p className="mb-1 text-[13px] font-semibold">Why this route?</p>
            <p className="font-light text-white/80">Three captures show discoloration below a bathroom. Bruce recommends an on-site inspection ($195 + HST).</p>
          </Popover>
        </div>
      </Group>

      <Group id="tooltips" title="Tooltips" subtitle="Dark pills and hover/focus tooltips.">
        <div className="flex flex-wrap items-center gap-6">
          <DarkPill>Tooltip</DarkPill>
          <DarkPill>Shortcut ⌘K</DarkPill>
          <DarkPill>Copied!</DarkPill>
          <DarkPill>Saved</DarkPill>
          <Tooltip label="Add capture">
            <IconButton variant="primary" label="Add capture">
              <Plus size={18} aria-hidden />
            </IconButton>
          </Tooltip>
          <Tooltip label="Notifications" side="bottom">
            <IconButton label="Notifications">
              <Bell size={18} aria-hidden />
            </IconButton>
          </Tooltip>
        </div>
      </Group>

      {/* ------------------------------------------------------------- Modal */}
      <Group id="modal" title="Modal" subtitle="Dialog over a dimmed overlay. The live version traps scroll, closes on Esc and restores focus.">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-center rounded-ds-xsm bg-[#9a98a3] px-6 py-14">
            <ModalSurface
              title="Delete this scan?"
              titleId="modal-specimen-title"
              footer={
                <>
                  <Button variant="text">Cancel</Button>
                  <Button>Confirm</Button>
                </>
              }
            >
              This removes the photos and the draft report. You can&apos;t undo this action.
            </ModalSurface>
          </div>
          <div>
            <ModalDemo />
          </div>
        </div>
      </Group>

      {/* ------------------------------------------------------------- Navigation / list */}
      <Group id="navigation" title="Navigation & list" subtitle="Breadcrumb, back link, sidebar menu with sections and a list pane with search rows.">
        <div className="mb-6 flex flex-wrap items-center gap-8">
          <BackLink label="Back to scans" />
          <Breadcrumb items={[{ label: "Console", href: "#navigation" }, { label: "Scans", href: "#navigation" }, { label: "S-1042" }]} />
        </div>
        <Panel className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <SidebarMenu
            defaultId="inbox"
            sections={[
              {
                items: [
                  { id: "home", label: "Home", icon: <Home size={16} aria-hidden /> },
                  { id: "inbox", label: "Inbox", icon: <Mail size={16} aria-hidden />, badge: "4" },
                  { id: "scans", label: "Scans", icon: <Folder size={16} aria-hidden /> },
                ],
              },
              {
                heading: "Insights",
                items: [
                  { id: "reports", label: "Reports", icon: <BarChart3 size={16} aria-hidden /> },
                  { id: "customers", label: "Customers", icon: <Users size={16} aria-hidden /> },
                ],
              },
              { heading: "Account", items: [{ id: "settings", label: "Settings", icon: <Settings size={16} aria-hidden /> }] },
            ]}
          />
          <div className="flex flex-col gap-3">
            <SearchRow placeholder="Search captures" />
            <ListRow icon={<User size={16} aria-hidden />} title="Michael, Ottawa" meta="Basement, 3 captures" trailing={<Tag tone="green" soft>Approved</Tag>} />
            <ListRow icon={<User size={16} aria-hidden />} title="Tenant, Montréal" meta="Dryer vent, 3 captures" trailing={<Tag tone="orange" soft>In review</Tag>} />
            <ListRow icon={<User size={16} aria-hidden />} title="Homeowner, Gatineau" meta="Attic, 2 captures" trailing={<Tag tone="gray" soft>New</Tag>} />
          </div>
        </Panel>
      </Group>
    </Section>
  );
}
