import { Suspense } from "react";
import type { Metadata } from "next";
import { StepEditor } from "@/components/step-editor";
import { BenchLoading } from "@/components/ui";

export const metadata: Metadata = { title: "Fix steps" };

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<BenchLoading label="Opening steps" />}>
      <Loader params={params} />
    </Suspense>
  );
}

async function Loader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StepEditor id={id} />;
}
