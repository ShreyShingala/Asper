import type { Metadata } from "next";
import Link from "next/link";
import { Components } from "./sections/Components";
import { Foundation } from "./sections/Foundation";
import { Patterns } from "./sections/Patterns";
import { UiKit } from "./sections/UiKit";

export const metadata: Metadata = {
  title: "Design System | Bruce",
  description: "Foundation, components, patterns and UI kit for Bruce, built from the Full Design System.",
};

const NAV = [
  {
    heading: "Foundation",
    id: "foundation",
    items: [
      ["color-scheme", "Color Scheme"],
      ["alert-colors", "Alert colors"],
      ["typography", "Typography Scale"],
    ],
  },
  {
    heading: "Components",
    id: "components",
    items: [
      ["web-navigations", "Web Navigations"],
      ["avatars", "Avatars"],
      ["alerts", "Alerts"],
      ["inputs", "Inputs"],
    ],
  },
  {
    heading: "Patterns",
    id: "patterns",
    items: [
      ["shadows", "Shadows"],
      ["radius", "Border-Radius"],
    ],
  },
  {
    heading: "UI Kit",
    id: "ui-kit",
    items: [
      ["grid", "Grid"],
      ["kit-colors", "Colors"],
      ["kit-typography", "Typography"],
      ["icons", "Icons"],
      ["banners", "Alerts (banners)"],
      ["loaders", "Loaders"],
      ["buttons", "Buttons"],
      ["tags", "Tags"],
      ["forms", "Inputs"],
      ["search", "Search & dropdown"],
      ["selection", "Checkbox, radio, toggle"],
      ["datepickers", "Datepickers"],
      ["cards", "Cards"],
      ["tabs", "Tabs"],
      ["progress", "Progress"],
      ["charts", "Charts"],
      ["table", "Table"],
      ["empty-state", "Empty state"],
      ["notifications", "Notifications"],
      ["popovers", "Popovers"],
      ["tooltips", "Tooltips"],
      ["modal", "Modal"],
      ["navigation", "Navigation & list"],
    ],
  },
] as const;

export default function DesignSystemPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] gap-12 px-6 py-12 lg:px-10">
      <aside className="sticky top-8 hidden h-[calc(100vh-4rem)] w-[220px] shrink-0 overflow-y-auto pr-2 lg:block" aria-label="Design system sections">
        <Link href="/" className="mb-6 block text-[14px] font-semibold text-ink">
          Bruce <span className="font-light text-ink-muted">/ Design System</span>
        </Link>
        <nav className="flex flex-col gap-6">
          {NAV.map((g) => (
            <div key={g.id}>
              <a href={`#${g.id}`} className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-ink">
                {g.heading}
              </a>
              <ul className="flex flex-col border-l border-line-soft">
                {g.items.map(([id, label]) => (
                  <li key={id}>
                    <a href={`#${id}`} className="block py-1 pl-3 text-[13px] font-light text-ink-body transition-colors hover:text-primary">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mb-16">
          <p className="text-[14px] font-medium text-primary">Full Design System (Community)</p>
          <h1 className="mt-2 text-h4 font-bold text-ink">Bruce Design System</h1>
          <p className="mt-3 max-w-[640px] text-[16px] font-light text-ink-muted">
            Foundation, components and patterns from the Community design system, plus the UI kit from the Style Guide and Frame 1 exports. Every specimen is a live, accessible
            component.
          </p>
        </div>
        <Foundation />
        <Components />
        <Patterns />
        <UiKit />
      </main>
    </div>
  );
}
