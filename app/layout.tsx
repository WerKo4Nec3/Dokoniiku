import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppHeader } from "@/components/layout/AppHeader";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "旅コンパス | Tabi Compass",
  description:
    "旅の精タビが、次の週末の行き先をランダムに選ぶ日本の小さな旅アプリ。",
  applicationName: "旅コンパス",
  appleWebApp: {
    capable: true,
    title: "旅コンパス",
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
  } catch {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppHeader />
        <main>{children}</main>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
