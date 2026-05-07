import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sunday Musician",
  description: "Connecting worship musicians with churches",
  icons: { icon: "/assets/sm-logo-icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full" suppressHydrationWarning>{children}</body>
    </html>
  );
}
