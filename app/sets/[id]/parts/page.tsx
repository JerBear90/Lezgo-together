import { Suspense } from "react";
import type { Metadata } from "next";
import { PartsView } from "@/components/parts-view";
import { BenchLoading } from "@/components/ui";

export const metadata: Metadata = { title: "Parts" };

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<BenchLoading label="Counting pieces" />}>
      <Loader params={params} />
    </Suspense>
  );
}

async function Loader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PartsView id={id} />;
}
