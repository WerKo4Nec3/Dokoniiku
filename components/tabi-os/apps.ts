import {
  Bookmark,
  CalendarDays,
  CircleUserRound,
  Compass,
  MapPinCheck,
  Radar,
  ScrollText,
  Settings,
  Shirt,
  ShieldCheck,
  Trophy,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

// Apps on Tabi's tablet ("タビパッド", running かぜOS). Each one is an
// existing page; the OS frame (bezel, status bar, dock) wraps them.
export type TabiApp = {
  id: string;
  href: string;
  name: string;
  icon: LucideIcon;
  /** Icon tile gradient. */
  from: string;
  to: string;
  /** Shown in the bottom dock on phones. */
  dock?: boolean;
  adminOnly?: boolean;
  /** Not wrapped in the OS frame (opens full-screen). */
  external?: boolean;
};

export const TABI_APPS: TabiApp[] = [
  { id: "journey", href: "/", name: "旅にでる", icon: Compass, from: "#f07a52", to: "#c2361f", dock: true, external: true },
  { id: "saved", href: "/saved", name: "旅ノート", icon: Bookmark, from: "#f2a65a", to: "#d9692b", dock: true },
  { id: "calendar", href: "/calendar", name: "こよみ", icon: CalendarDays, from: "#f6cf63", to: "#dc9a12" },
  { id: "checkin", href: "/checkin", name: "チェックイン", icon: MapPinCheck, from: "#ff8a6b", to: "#d63b4f", dock: true },
  { id: "events", href: "/events", name: "クエスト", icon: ScrollText, from: "#c49567", to: "#80522d", dock: true },
  { id: "achievements", href: "/achievements", name: "実績", icon: Trophy, from: "#f7d36b", to: "#c98a12" },
  { id: "live", href: "/live", name: "いまどこ", icon: Radar, from: "#64c9c9", to: "#2b7da6" },
  { id: "friends", href: "/friends", name: "なかま", icon: Users, from: "#93d37c", to: "#3e8c48" },
  { id: "groups", href: "/groups", name: "グループ", icon: UsersRound, from: "#a497f4", to: "#5a48c6" },
  { id: "profile", href: "/profile", name: "タビ手帳", icon: CircleUserRound, from: "#f59bc2", to: "#c4466f", dock: true },
  { id: "wardrobe", href: "/wardrobe", name: "きせかえ", icon: Shirt, from: "#ffb39e", to: "#e3655f" },
  { id: "settings", href: "/settings", name: "設定", icon: Settings, from: "#a3acb6", to: "#5b6570" },
  { id: "admin", href: "/admin", name: "管理", icon: ShieldCheck, from: "#6f7d8c", to: "#2c3540", adminOnly: true, external: true },
];

export const OS_HOME = "/tabi";

const matches = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(href + "/");

/** Pages that render inside the tablet. */
export function isOSPath(pathname: string): boolean {
  if (matches(pathname, OS_HOME)) return true;
  return TABI_APPS.some((app) => !app.external && matches(pathname, app.href));
}

export function appForPath(pathname: string): TabiApp | null {
  return TABI_APPS.find((app) => !app.external && matches(pathname, app.href)) ?? null;
}
