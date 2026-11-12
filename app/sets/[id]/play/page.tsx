import { Suspense } from "react";
import type { Metadata } from "next";
import { StepPlayer } from "@/components/step-player";
import { BenchLoading } from "@/components/ui";

export const metadata: Metadata = { title: "Build" };

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<BenchLoading label="Opening the build" />}>
      <Loader params={params} />
    </Suspense>
  );
}

async function Loader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StepPlayer id={id} />;
}
