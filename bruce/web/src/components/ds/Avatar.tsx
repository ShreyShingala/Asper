import { Check, Lock, Pencil, User, X } from "lucide-react";
import { cn } from "@/lib/cn";

export const AVATAR_SIZES = [96, 72, 56, 48, 32, 24, 16] as const;
export type AvatarSize = (typeof AVATAR_SIZES)[number];

export type AvatarBadge = "editing" | "uploaded" | "active" | "inactive" | "error" | "locked";
export type AvatarKind = "image" | "empty" | "initial";

const BADGE_STYLE: Record<AvatarBadge, { bg: string; icon?: typeof Check }> = {
  editing: { bg: "bg-badge-edit", icon: Pencil },
  uploaded: { bg: "bg-badge-ok", icon: Check },
  active: { bg: "bg-badge-ok" },
  inactive: { bg: "bg-badge-off" },
  error: { bg: "bg-badge-error", icon: X },
  locked: { bg: "bg-black", icon: Lock },
};

export const PEOPLE = {
  one: "/avatars/person-1.png",
  two: "/avatars/person-2.png",
  three: "/avatars/person-3.png",
} as const;

/**
 * Avatars (Components artboard).
 * Sizes: 96 / 72 / 56 / 48 / 32 / 24 / 16.
 * Types: empty, initial, user pic, plus status badges
 * (editing, uploaded, user active, user inactive, error upload, locked).
 */
export function Avatar({
  size = 48,
  kind = "image",
  src = PEOPLE.one,
  initials = "S.M",
  alt = "",
  badge,
  className,
}: {
  size?: number;
  kind?: AvatarKind;
  src?: string;
  initials?: string;
  alt?: string;
  badge?: AvatarBadge;
  className?: string;
}) {
  const b = badge ? BADGE_STYLE[badge] : undefined;
  const badgeSize = Math.max(8, Math.round(size * (b?.icon ? 0.36 : 0.3)));
  const BadgeIcon = b?.icon;

  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      <span
        className={cn(
          "inline-flex h-full w-full items-center justify-center overflow-hidden rounded-full",
          kind === "image" && "bg-avatar-pink",
          kind === "empty" && "bg-avatar-empty text-ink-muted",
          kind === "initial" && "bg-avatar-initial-bg font-medium text-avatar-initial-fg",
        )}
        style={kind === "initial" ? { fontSize: Math.max(8, Math.round(size * 0.31)) } : undefined}
      >
        {kind === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} width={size} height={size} className="h-full w-full object-cover" draggable={false} />
        )}
        {kind === "empty" && <User size={Math.round(size * 0.45)} strokeWidth={1.6} aria-label={alt || "Empty avatar"} />}
        {kind === "initial" && <span aria-label={alt || initials}>{initials}</span>}
      </span>
      {b && (
        <span
          aria-hidden
          className={cn("absolute -bottom-px -right-px inline-flex items-center justify-center rounded-full text-white ring-2 ring-white", b.bg)}
          style={{ width: badgeSize, height: badgeSize }}
        >
          {BadgeIcon && <BadgeIcon size={Math.round(badgeSize * 0.62)} strokeWidth={3} />}
        </span>
      )}
    </span>
  );
}

/**
 * Avatar stacked: three photos plus a "+N" overflow bubble.
 * Offsets reproduce the artboard: each avatar overlaps its neighbour by ~32%.
 */
export function AvatarStack({ size = 48, extra = 12, className }: { size?: 48 | 32 | 24 | number; extra?: number; className?: string }) {
  const ring = Math.max(1.5, size / 24);
  const overlap = -Math.round(size * 0.32);
  const people = [PEOPLE.one, PEOPLE.two, PEOPLE.three];
  const common = { width: size, height: size, boxShadow: `0 0 0 ${ring}px #fff` } as const;
  return (
    <span className={cn("inline-flex items-center", className)} role="group" aria-label={`${people.length + extra} collaborators`}>
      {people.map((p, i) => (
        <span
          key={p}
          className="relative inline-block overflow-hidden rounded-full bg-avatar-empty"
          style={{ ...common, marginLeft: i === 0 ? ring : overlap, zIndex: i + 1 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p} alt="" className="h-full w-full object-cover" draggable={false} />
        </span>
      ))}
      <span
        className="relative inline-flex items-center justify-center rounded-full bg-avatar-empty font-medium text-[#3a3a4f]"
        style={{ ...common, marginLeft: overlap, zIndex: 10, fontSize: Math.round(size * 0.3) }}
      >
        +{extra}
      </span>
    </span>
  );
}
