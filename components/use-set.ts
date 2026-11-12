"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSet, listSets, saveSet } from "@/lib/db";
import type { BrickSet } from "@/lib/types";

export function useBrickSet(id: string) {
  const [set, setSet] = useState<BrickSet | null | undefined>(undefined);
  const ref = useRef<BrickSet | null>(null);
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    let cancel = false;
    getSet(id)
      .then((row) => {
        if (cancel) return;
        ref.current = row;
        setSet(row);
      })
      .catch(() => {
        if (!cancel) setSet(null);
      });
    return () => {
      cancel = true;
    };
  }, [id]);

  const commit = useCallback((next: BrickSet) => {
    const stamped = { ...next, updatedAt: Date.now() };
    ref.current = stamped;
    setSet(stamped);
    const write = queue.current.then(() => saveSet(stamped));
    queue.current = write.then(
      () => undefined,
      () => undefined,
    );
    return stamped;
  }, []);

  return {
    set,
    loading: set === undefined,
    missing: set === null,
    commit,
    snapshot: () => ref.current,
  };
}

export function useSetList() {
  const [sets, setSets] = useState<BrickSet[] | undefined>(undefined);

  const refresh = useCallback(async () => {
    const rows = await listSets();
    setSets(rows);
    return rows;
  }, []);

  useEffect(() => {
    let cancel = false;
    listSets()
      .then((rows) => {
        if (!cancel) setSets(rows);
      })
      .catch(() => {
        if (!cancel) setSets([]);
      });
    return () => {
      cancel = true;
    };
  }, []);

  return { sets, refresh, loading: sets === undefined };
}

export function useAiMode() {
  const [mode, setMode] = useState<"loading" | "demo" | "live">("loading");
  useEffect(() => {
    let cancel = false;
    fetch("/api/config")
      .then((response) => response.json())
      .then((body: { mode?: string }) => {
        if (!cancel) setMode(body.mode === "live" ? "live" : "demo");
      })
      .catch(() => {
        if (!cancel) setMode("demo");
      });
    return () => {
      cancel = true;
    };
  }, []);
  return mode;
}
