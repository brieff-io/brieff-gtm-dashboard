import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brieff GTM Dashboard",
  description: "Internal go-to-market dashboard.",
  icons: { icon: "/favicon.svg" },
  // Internal tool — keep it out of search engines (access is gated by Vercel).
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased text-ink">{children}</body>
    </html>
  );
}
