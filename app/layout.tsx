import type { Metadata, Viewport } from "next";
import { Zen_Maru_Gothic, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";
import { AppHeader } from "@/components/layout/AppHeader";
import { CabinetChrome } from "@/components/CabinetChrome";
import { AuthDialog } from "@/components/AuthDialog";
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
    { media: "(prefers-color-scheme: light)", color: "#f7f4ed" },
    { media: "(prefers-color-scheme: dark)", color: "#17211d" },
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
        </AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
