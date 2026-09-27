import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reading Together",
  description: "A shared EPUB reader for couples",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

// Runs before paint so a dark-mode visitor never sees a light flash; setAppTheme in features/reader/prefs.tsx mirrors it.
const THEME_SCRIPT = `(() => {
  const m = matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    let t = null;
    try { t = localStorage.getItem('app:theme'); } catch {}
    document.documentElement.classList.toggle('dark', t === 'dark' || (t !== 'light' && m.matches));
  };
  apply();
  m.addEventListener('change', apply);
})()`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
