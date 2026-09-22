// The browser/phone status-bar colour (meta theme-color) follows the active
// palette + light/dark mode, so the top of the screen matches the page ground.
// Keep in sync with the --background tokens in app/globals.css (and the inline
// copy in app/layout.tsx's themeScript).
export const THEME_BG: Record<string, [light: string, dark: string]> = {
  default: ["#f7f3ed", "#151210"],
  ocean: ["#eef4f8", "#0b1319"],
  sakura: ["#f9f1f3", "#171013"],
  matcha: ["#f6f3eb", "#12130e"],
  yoru: ["#f2f3fa", "#10111d"],
};

export function syncThemeColor() {
  const root = document.documentElement;
  const pair = THEME_BG[root.dataset.palette ?? "default"] ?? THEME_BG.default;
  const color = root.classList.contains("dark") ? pair[1] : pair[0];
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", color));
}
