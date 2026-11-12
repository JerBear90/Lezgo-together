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
    const load = () => {
      getSet(id)
        .then((row) => {
          if (cancel) return;
          ref.current = row;
          setSet(row);
        })
        .catch(() => {
          if (!cancel) setSet(null);
        });
    };
    load();
    const onRemote = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail === id) load();
    };
    window.addEventListener("lezgo-set", onRemote);
    return () => {
      cancel = true;
      window.removeEventListener("lezgo-set", onRemote);
    };
  }, [id]);

  const commit = useCallback((next: BrickSet) => {
    const previous = ref.current;
    const contentChanged =
      !previous ||
      previous.pages !== next.pages ||
      previous.steps !== next.steps ||
      previous.sections !== next.sections ||
      previous.combine !== next.combine ||
      previous.name !== next.name ||
      previous.coverDataUrl !== next.coverDataUrl;
    const stamped = { ...next, updatedAt: contentChanged ? Date.now() : (previous?.updatedAt ?? next.updatedAt) };
    ref.current = stamped;
    setSet(stamped);
    const write = queue.current.then(() => saveSet(stamped));
    queue.current = write.then(
      () => undefined,
      () => undefined,
    );
    return write.then(() => stamped);
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
