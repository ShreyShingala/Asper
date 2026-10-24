# Bruce design system

Live specimen page: `bun dev` then open `/design-system`.

Source material: `Full Design System (Community).zip` (Foundation, Components, Patterns artboards) plus two
lower-resolution PNG exports (`Style Guide`, `Frame 1`) of the same kit.

## How accurate is each part?

| Part | Source | Fidelity |
|---|---|---|
| Colour scales, type scale, shadows, radii | Foundation / Patterns JPGs | Exact. Hex values were sampled from the pixels; the tint scale is computed (see below). |
| Web nav, avatars, alerts, inputs | Components JPG | Exact layout, copy, sizes and states. |
| Everything under **UI Kit** | PNG exports (121px and 715px wide, text unreadable) | Inferred. Structure, order and palette come from the PNGs; labels, sizes and copy are ours. |

If you can export the Style Guide / Frame 1 frames at 2x or share the Figma file, the UI Kit section can be
tightened to exact values.

## Tokens

- Colours: `scripts/gen-tokens.mjs` generates `src/styles/tokens.css` (Tailwind `@theme`) and
  `src/lib/ds/palette.generated.ts`. Run `node scripts/gen-tokens.mjs` after changing a base colour.
  - `Dark 10%` = base mixed 10% with black. `Light 90%`, `75%`, `50%`, `25%`, `10%` = base at that opacity over white.
  - Utilities: `bg-primary`, `bg-primary-dark`, `bg-primary-light`, `bg-primary-75`, `...-50`, `...-25`, `...-10`
    (same for `secondary`, `support`, `gray`, `success`, `info`, `warning`, `danger`).
  - Kit palette: `kit-blue`, `kit-green`, `kit-orange`, `kit-red`, `kit-navy`, `kit-gray`, `kit-gray-soft`, `kit-gray-faint`.
- Type (`src/app/globals.css`): `text-h2` 64, `text-h3` 48, `text-h4` 40, `text-h5` 32, `text-h6` 24,
  `text-subheading` 18, `text-body` 16, `text-subtitle` 14, `text-caption` 12. Font: Poppins.
- Radii: `rounded-ds-xsm` 4, `-sm` 12, `-normal` 16, `-lg` 24, `-xl` 70.
- Shadows: `shadow-ds-xsm`, `-sm`, `-normal`, `-lg`, `-xl`.

## Source quirks (kept out of the code on purpose)

- Warning swatch prints `#3366FF` (copy of Info); the swatch is `#FFB020` and that is used.
- Typos corrected in copy: "Successs", "Congratulatios", "Nurmal", "Border-Radious", "Varifiying".
- The Primary swatch label reads `#51ADFF` but the pixels are `#517CFF`; Support's label is unreadable and the pixels are `#FF49DA`.

## Components

`src/components/ds/`: `Logo`, `WebNav`, `Avatar` (+ `AvatarStack`), `Alert`, `TextField`.
`src/components/ds/kit/`: `Buttons`, `Forms`, `Feedback` (banner, toast, loader, tag, tooltip, popover, modal),
`Navigation` (tabs, sidebar, list row, search row, breadcrumb), `Calendar`, `Progress`, `Charts`, `DataTable`, `Cards`.

Components that document states (`Alert`, `TextField`, `Button`) take a `state` prop to force Hover / Pressed /
Focus etc. for specimens; leave it undefined for real interaction.
