import { Suspense } from "react";
import type { Metadata } from "next";
import { SetHome } from "@/components/set-home";
import { BenchLoading } from "@/components/ui";

export const metadata: Metadata = { title: "Set" };

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<BenchLoading label="Opening set" />}>
      <Loader params={params} />
    </Suspense>
  );
}

async function Loader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SetHome id={id} />;
}
