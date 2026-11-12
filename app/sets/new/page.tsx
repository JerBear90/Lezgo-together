import type { Metadata } from "next";
import { NewSetForm } from "@/components/new-set-form";

export const metadata: Metadata = { title: "New set" };

export default function Page() {
  return <NewSetForm />;
}
