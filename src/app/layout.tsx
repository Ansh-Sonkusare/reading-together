import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Literata, Onest } from "next/font/google";
import "./globals.css";

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reading Together",
  description: "A shared EPUB reader for couples",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBFAFD" },
    { media: "(prefers-color-scheme: dark)", color: "#17161F" },
  ],
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
      className={`${literata.variable} ${onest.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
