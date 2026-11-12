"use client";

import { useEffect } from "react";
import { requestPersistentStorage } from "@/lib/players";

export function PersistStorage() {
  useEffect(() => {
    void requestPersistentStorage();
  }, []);
  return null;
}
