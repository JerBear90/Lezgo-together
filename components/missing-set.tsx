"use client";

import Link from "next/link";
import { DEMO_SET_ID } from "@/lib/demo";
import { TopBar } from "./ui";

export function MissingSet() {
  return (
    <>
      <TopBar title="Missing set" backHref="/" backLabel="Sets" />
      <main className="px-4 py-8">
        <p>That set is not on this device.</p>
        <Link
          href={`/sets/${DEMO_SET_ID}`}
          data-testid="try-sample"
          className="btn-sun mt-4 inline-flex min-h-12 items-center px-4 font-extrabold"
        >
          Try the sample
        </Link>
        <p className="mt-4">
          <Link href="/" className="font-semibold text-brick-dark">
            Home
          </Link>
        </p>
      </main>
    </>
  );
}
