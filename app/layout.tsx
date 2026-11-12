import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { PersistStorage } from "@/components/persist-storage";
import { PlayerBar } from "@/components/player-bar";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: { default: "Lezgo", template: "%s · Lezgo" },
  description: "Turn muddy brick-set booklets into one clear step at a time.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f0e6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} ${fraunces.variable} h-full antialiased`}>
      <body>
        <PersistStorage />
        <div className="desk">
          <div className="phone flex h-dvh flex-col">
            <PlayerBar />
            <div className="min-h-0 flex-1 overflow-auto">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
