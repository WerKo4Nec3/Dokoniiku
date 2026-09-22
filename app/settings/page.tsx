"use client";

import { Check, Heart, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { CabinetHeader } from "@/components/CabinetHeader";
import { syncThemeColor } from "@/lib/themeColor";
import { categoryLabels } from "@/lib/utils/travel";
import {
  CATEGORY_EMOJI,
  openPreferences,
  usePreferences,
} from "@/lib/preferences";

const THEME_EVENT = "tabi-compass:theme-change";

type ThemeMode = "light" | "dark" | "auto";

const palettes: {
  id: string;
  nameJa: string;
  hint: string;
  accent: string;
  secondary: string;
}[] = [
  { id: "default", nameJa: "朱", hint: "鳥居の朱色（標準）", accent: "#d14229", secondary: "#285f4d" },
  { id: "ocean", nameJa: "海", hint: "瀬戸内の青", accent: "#2f7aa5", secondary: "#1f5f6b" },
  { id: "sakura", nameJa: "桜", hint: "春の花見", accent: "#c54871", secondary: "#7a4a5e" },
  { id: "matcha", nameJa: "抹茶", hint: "京の茶屋", accent: "#548133", secondary: "#2f5d46" },
  { id: "yoru", nameJa: "夜", hint: "夜行列車", accent: "#7857fa", secondary: "#3d4a7a" },
];

function currentTheme(): ThemeMode {
  const stored = localStorage.getItem("tabi-compass:theme");
  if (stored === "light" || stored === "dark") return stored;
  return "auto";
}

export default function SettingsPage() {
  const [theme, setTheme] = useState<ThemeMode>("auto");
  const [palette, setPalette] = useState("default");
  const preferred = usePreferences();

  useEffect(() => {
    setTheme(currentTheme());
    setPalette(localStorage.getItem("tabi-compass:palette") ?? "default");
  }, []);

  function applyTheme(mode: ThemeMode) {
    setTheme(mode);
    if (mode === "auto") {
      localStorage.removeItem("tabi-compass:theme");
      document.documentElement.classList.toggle(
        "dark",
        matchMedia("(prefers-color-scheme: dark)").matches,
      );
    } else {
      localStorage.setItem("tabi-compass:theme", mode);
      document.documentElement.classList.toggle("dark", mode === "dark");
    }
    // Keep the header's sun/moon icon + the status bar in sync.
    window.dispatchEvent(new Event(THEME_EVENT));
    syncThemeColor();
  }

  function applyPalette(id: string) {
    setPalette(id);
    if (id === "default") {
      localStorage.removeItem("tabi-compass:palette");
      delete document.documentElement.dataset.palette;
    } else {
      localStorage.setItem("tabi-compass:palette", id);
      document.documentElement.dataset.palette = id;
    }
    syncThemeColor();
  }

  const themeOptions: { id: ThemeMode; labelJa: string; icon: typeof Sun }[] = [
    { id: "light", labelJa: "ライト", icon: Sun },
    { id: "dark", labelJa: "ダーク", icon: Moon },
    { id: "auto", labelJa: "自動", icon: Monitor },
  ];

  return (
    <section className="mx-auto min-h-[calc(100vh-4rem)] max-w-3xl px-4 pb-20 pt-32 sm:px-6">
      <CabinetHeader
        eyebrow="カスタマイズ"
        title="設定"
        subtitle="見た目をあなた好みに。設定はこの端末に保存されます。"
        accent="sun"
      />

      <div className="mt-8 space-y-6">
        {/* Theme mode */}
        <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
          <h2 className="text-sm font-black">外観モード</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const active = theme === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => applyTheme(option.id)}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3.5 text-xs font-bold transition ${
                    active
                      ? "border-vermilion bg-vermilion/10 text-vermilion"
                      : "border-[color:var(--line)] text-[color:var(--muted)] hover:text-[color:var(--foreground)]"
                  }`}
                >
                  <Icon size={18} />
                  {option.labelJa}
                </button>
              );
            })}
          </div>
        </div>

        {/* Colour palette */}
        <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
          <h2 className="text-sm font-black">カラーパレット</h2>
          <p className="mt-1 text-xs font-medium text-[color:var(--muted)]">
            ボタンやアクセントの色が切り替わります。
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {palettes.map((option) => {
              const active = palette === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => applyPalette(option.id)}
                  aria-pressed={active}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-vermilion ring-2 ring-vermilion/25"
                      : "border-[color:var(--line)] hover:border-vermilion/40"
                  }`}
                >
                  <span className="flex shrink-0 -space-x-1.5">
                    <span
                      className="h-7 w-7 rounded-full border-2 border-[color:var(--surface)]"
                      style={{ backgroundColor: option.accent }}
                    />
                    <span
                      className="h-7 w-7 rounded-full border-2 border-[color:var(--surface)]"
                      style={{ backgroundColor: option.secondary }}
                    />
                    <span className="h-7 w-7 rounded-full border-2 border-[color:var(--surface)] bg-sun" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black">
                      {option.nameJa}
                    </span>
                    <span className="block text-[11px] font-medium text-[color:var(--muted)]">
                      {option.hint}
                    </span>
                  </span>
                  {active && (
                    <Check size={16} className="shrink-0 text-vermilion" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Favourite genres (biases the "surprise me" pick) */}
        <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
          <div className="flex items-center gap-2">
            <Heart size={16} className="text-vermilion" />
            <h2 className="text-sm font-black">好みのジャンル</h2>
          </div>
          <p className="mt-1 text-xs font-medium text-[color:var(--muted)]">
            選んだジャンルに、タビの行き先えらびが少し寄っていきます。
          </p>
          {preferred.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {preferred.map((category) => (
                <span
                  key={category}
                  className="inline-flex items-center gap-1 rounded-full bg-vermilion/10 px-3 py-1.5 text-xs font-bold text-vermilion"
                >
                  <span aria-hidden>{CATEGORY_EMOJI[category]}</span>
                  {categoryLabels[category]}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs font-medium text-[color:var(--muted)]">
              まだ未設定です（今はすべておまかせ）。
            </p>
          )}
          <button
            type="button"
            onClick={openPreferences}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-5 py-2 text-xs font-bold transition hover:bg-[color:var(--surface-muted)]"
          >
            <Heart size={14} />
            好みを{preferred.length ? "変更" : "設定"}する
          </button>
        </div>
      </div>
    </section>
  );
}
