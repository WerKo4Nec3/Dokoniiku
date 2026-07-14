import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppHeader } from "@/components/layout/AppHeader";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { AuthProvider } from "@/lib/auth/AuthProvider";

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
        <AuthProvider>
          <AppHeader />
          <main>{children}</main>
        </AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
