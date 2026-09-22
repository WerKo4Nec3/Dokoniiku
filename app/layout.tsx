import type { Metadata, Viewport } from "next";
import { Zen_Maru_Gothic, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";
import { AppHeader } from "@/components/layout/AppHeader";
import { CabinetChrome } from "@/components/CabinetChrome";
import { AuthDialog } from "@/components/AuthDialog";
import { PreferencesDialog } from "@/components/PreferencesDialog";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { AuthProvider } from "@/lib/auth/AuthProvider";

// Rounded, friendly display face for headings + a clean body face. Both cover
// JP; only the small Latin subset is preloaded (JP glyphs stream on demand).
const displayFont = Zen_Maru_Gothic({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--font-display",
  display: "swap",
});

const bodyFont = Zen_Kaku_Gothic_New({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://dokoniiku.com"),
  title: "Dokoniiku | 旅コンパス",
  description:
    "旅の精タビが、次の週末の行き先をランダムに選ぶ日本の小さな旅アプリ。",
  applicationName: "Dokoniiku",
  appleWebApp: {
    capable: true,
    title: "Dokoniiku",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f3ed" },
    { media: "(prefers-color-scheme: dark)", color: "#151210" },
  ],
};

const themeScript = `
  try {
    const stored = localStorage.getItem('tabi-compass:theme');
    const dark = stored === 'dark' || (!stored && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    const palette = localStorage.getItem('tabi-compass:palette');
    if (palette && palette !== 'default') {
      document.documentElement.dataset.palette = palette;
    }
    // Status bar follows palette + mode (mirror of lib/themeColor.ts).
    var bg = {default:['#f7f3ed','#151210'],ocean:['#eef4f8','#0b1319'],sakura:['#f9f1f3','#171013'],matcha:['#f6f3eb','#12130e'],yoru:['#f2f3fa','#10111d']};
    var pair = bg[palette || 'default'] || bg['default'];
    var sync = function () {
      var c = document.documentElement.classList.contains('dark') ? pair[1] : pair[0];
      document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) { m.setAttribute('content', c); });
    };
    sync();
    document.addEventListener('DOMContentLoaded', sync);
  } catch {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ja"
      suppressHydrationWarning
      className={`${displayFont.variable} ${bodyFont.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AuthProvider>
          <AppHeader />
          <CabinetChrome />
          <main>{children}</main>
          <AuthDialog />
          <PreferencesDialog />
        </AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
