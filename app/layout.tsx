import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Nunito } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-nunito",
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
    <html lang="en" className={`${nunito.variable} h-full antialiased`}>
      <body>
        <div className="desk">
          <div className="phone">
            <Suspense fallback={children}>
              <AppShell>{children}</AppShell>
            </Suspense>
          </div>
        </div>
      </body>
    </html>
  );
}
