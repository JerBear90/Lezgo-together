import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Build Together" };

export default function TogetherPage() {
  return (
    <main className="together-lobby min-h-dvh px-5 py-8 text-white">
      <p className="text-sm font-bold uppercase tracking-wide text-white/80">Build Together</p>
      <h1 className="mt-2 font-display text-4xl leading-tight">Build solo or invite friends</h1>
      <p className="mt-3 max-w-sm text-white/90">
        Open a set and build every section yourself. A room code is only an invite.
      </p>
      <Link href="/" className="btn-lip mt-8 inline-flex min-h-12 items-center px-5 font-extrabold text-ink">
        Back to sets
      </Link>
    </main>
  );
}
