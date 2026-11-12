import type { Metadata } from "next";
import { SetList } from "@/components/set-list";

export const metadata: Metadata = { title: "Lezgo" };

export default function Page() {
  return <SetList />;
}
