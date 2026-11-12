"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Sets", testId: "nav-sets" },
  { href: "/together", label: "Build Together", testId: "nav-together" },
  { href: "/me", label: "Me", testId: "nav-me" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "/";
  const building = path.includes("/play");
  return (
    <>
      <div className={building ? "" : "pb-28"}>{children}</div>
      {building ? null : (
        <nav className="pill-nav" aria-label="Main">
          {links.map((link) => {
            const on = link.href === "/" ? path === "/" : path.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} data-testid={link.testId} className={on ? "pill-on" : "pill-off"}>
                {link.label}
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
