import { Suspense } from "react";
import type { Metadata } from "next";
import { PagesManager } from "@/components/pages-manager";
import { BenchLoading } from "@/components/ui";

export const metadata: Metadata = { title: "Pages" };

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<BenchLoading label="Opening pages" />}>
      <Loader params={params} />
    </Suspense>
  );
}

async function Loader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PagesManager id={id} />;
}
