import { Suspense } from "react";
import type { Metadata } from "next";
import { JoinRoom } from "@/components/join-room";
import { BenchLoading } from "@/components/ui";

export const metadata: Metadata = { title: "Join a room" };

export default function Page() {
  return (
    <Suspense fallback={<BenchLoading label="Opening the lobby" />}>
      <JoinRoom />
    </Suspense>
  );
}
