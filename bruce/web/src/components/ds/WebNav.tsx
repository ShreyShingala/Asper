"use client";

import { ChevronDown, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Logo } from "./Logo";

export type NavVariant = "outline" | "solid" | "blue";

export type NavLinkItem = { label: string; href?: string; hasMenu?: boolean };

const DEFAULT_LINKS: NavLinkItem[] = [
  { label: "Home" },
  { label: "Services", hasMenu: true },
  { label: "News" },
  { label: "About" },
  { label: "Projects" },
];

/**
 * Web Navigations (Components artboard). Three base styles:
 *  - outline: floating card, green logo, outlined pill CTA
 *  - solid:   logo overhangs the card edge, solid green full-height CTA block
 *  - blue:    blue logo, blue active link, text "Log In" + tinted CTA block
 */
export function WebNav({
  variant = "outline",
  links = DEFAULT_LINKS,
  active = "Home",
  brand = "Halal Lab",
  className,
}: {
  variant?: NavVariant;
  links?: NavLinkItem[];
  active?: string;
  brand?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const isBlue = variant === "blue";
  const logoColor = isBlue ? "#203DE2" : "#0ABC5C";

  const linkEls = links.map((l) => {
    const isActive = l.label === active;
    return (
      <li key={l.label}>
        <a
          href={l.href ?? "#"}
          onClick={(e) => e.preventDefault()}
          aria-current={isActive ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-2 py-2 text-[16px] transition-colors",
            isBlue
              ? isActive
                ? "font-medium text-nav-blue"
                : "font-normal text-black hover:text-nav-blue"
              : isActive
                ? "font-semibold text-ink-body"
                : "font-normal text-ink-body hover:text-ink",
          )}
        >
          {l.label}
          {l.hasMenu && <ChevronDown size={16} strokeWidth={2} aria-hidden />}
        </a>
      </li>
    );
  });

  return (
    <div className="@container w-full">
    <header
      className={cn(
        "relative flex items-center bg-white shadow-ds-lg",
        variant === "outline" && "h-[88px] pl-10 pr-10",
        variant === "solid" && "h-[76px] pl-0 pr-0",
        variant === "blue" && "h-[88px] pl-10 pr-10",
        className,
      )}
    >
      <div className={cn("shrink-0", variant === "solid" && "-ml-3")}>
        <Logo color={logoColor} size={variant === "solid" ? 48 : 40} name={brand} textClassName={variant === "solid" ? "text-[22px]" : "text-[22px]"} />
      </div>

      <nav aria-label="Primary" className="ml-auto hidden @4xl:block">
        <ul className={cn("flex items-center", variant === "blue" ? "gap-9" : "gap-9")}>{linkEls}</ul>
      </nav>

      <div className={cn("hidden @4xl:flex items-center", variant === "solid" ? "ml-10 self-stretch" : "ml-14 gap-3")}>
        {variant === "outline" && (
          <button
            type="button"
            className="h-12 rounded-full border-2 border-nav-green px-6 text-[16px] font-medium text-nav-green transition-colors hover:bg-nav-green hover:text-white active:bg-nav-green/90"
          >
            Create account
          </button>
        )}
        {variant === "solid" && (
          <button
            type="button"
            className="h-full whitespace-nowrap bg-nav-green px-10 text-[16px] font-medium text-white transition-colors hover:brightness-95 active:brightness-90"
          >
            Create Account
          </button>
        )}
        {variant === "blue" && (
          <>
            <button type="button" className="px-4 py-3 text-[16px] font-medium text-nav-blue hover:underline">
              Log In
            </button>
            <button
              type="button"
              className="h-12 bg-nav-blue-tint px-7 text-[16px] font-medium text-nav-blue transition-colors hover:bg-[#dfe5ff] active:bg-[#d3dbff]"
            >
              Create account
            </button>
          </>
        )}
      </div>

      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="ml-auto mr-4 inline-flex h-10 w-10 items-center justify-center rounded-ds-sm text-ink-body hover:bg-kit-gray-faint @4xl:hidden"
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-10 border-t border-line-soft bg-white p-6 shadow-ds-lg @4xl:hidden">
          <ul className="flex flex-col gap-2">{linkEls}</ul>
        </div>
      )}
    </header>
    </div>
  );
}
