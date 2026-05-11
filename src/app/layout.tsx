import type { Metadata, Viewport } from "next";
import { Source_Sans_3, Work_Sans } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

// Self-hosted via next/font — eliminates render-blocking Google Fonts CSS
// fetch, removes the third-party round trip, and avoids CLS via font-display
// swap with size-adjust. Wired through CSS variables so the existing
// --sm-font-* tokens in design-system.css keep working.

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-source-sans",
});

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
  variable: "--font-work-sans",
});

export const metadata: Metadata = {
  title: "Sunday Musician",
  description: "Connecting worship musicians with churches",
  icons: { icon: "/assets/sm-logo-icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`h-full ${sourceSans.variable} ${workSans.variable}`}>
      <head>
        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{
            __html: `(function(k) {
        let s=document.createElement('script');s.defer=true;
        s.src="https://cdn.feedbucket.app/assets/feedbucket.js";
        s.dataset.feedbucket=k;document.head.appendChild(s);
    })('yHUicpcTyCstQ9Wj3YcB')`,
          }}
        />
      </head>
      <body className="min-h-full" suppressHydrationWarning>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
