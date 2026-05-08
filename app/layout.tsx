import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TopBar } from "@/components/top-bar";
import { BottomNav } from "@/components/bottom-nav";
import { LeagueBootstrap } from "@/components/league-bootstrap";

export const metadata: Metadata = {
  title: "Maverick Football",
  description: "An immersive NFL franchise simulator",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0b0e16",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans">
        <LeagueBootstrap />
        <div className="mx-auto flex min-h-dvh max-w-7xl flex-col">
          <TopBar />
          <main className="flex-1 px-3 pb-24 pt-3 sm:px-6 sm:pb-10">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
