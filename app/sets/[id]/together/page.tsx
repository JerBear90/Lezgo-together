import { Suspense } from "react";
import type { Metadata } from "next";
import { TogetherView } from "@/components/together-view";
import { BenchLoading } from "@/components/ui";

export const metadata: Metadata = { title: "Together" };

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<BenchLoading label="Opening the room" />}>
      <Loader params={params} />
    </Suspense>
  );
}

async function Loader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TogetherView id={id} />;
}
