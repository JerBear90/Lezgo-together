"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  appendPages,
  markPageError,
  markPageReading,
  orderedSteps,
  reorderPages,
  replacePageImage,
} from "@/lib/editing";
import { fileToDataUrl } from "@/lib/images";
import { retakeMessage } from "@/lib/labels";
import { requestPageRead } from "@/lib/read-page";
import { createId } from "@/lib/ids";
import type { BrickSet } from "@/lib/types";
import { MissingSet } from "./missing-set";
import { BenchLoading, TopBar } from "./ui";
import { useAiMode, useBrickSet } from "./use-set";

export function PagesManager({ id }: { id: string }) {
  const { set, loading, missing, commit, snapshot } = useBrickSet(id);
  const mode = useAiMode();
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const replaceId = useRef<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function readIds(start: BrickSet, pageIds: string[]) {
    let working = start;
    for (const pageId of pageIds) {
      working = await commit(markPageReading(working, pageId));
      try {
        const result = await requestPageRead(working, pageId);
        working = await commit(result.next);
        if (result.notice) setNotice(result.notice);
      } catch (readError) {
        const message = readError instanceof Error ? readError.message : "Could not read that page.";
        working = await commit(markPageError(working, pageId, message));
        setError(message);
      }
    }
  }

  async function onFiles(list: FileList | null) {
    const replacing = replaceId.current;
    replaceId.current = null;
    const current = snapshot();
    if (!list?.length || !current) return;
    setError(null);
    setBusy(true);
    try {
      const files = Array.from(list).slice(0, replacing ? 1 : 12);
      const images: { imageDataUrl: string; fileName: string }[] = [];
      for (const file of files) {
        try {
          images.push({ imageDataUrl: await fileToDataUrl(file), fileName: file.name });
        } catch {
          setError("One photo could not be read. Use a JPEG or PNG.");
        }
      }
      if (images.length === 0) return;
      let working = snapshot() ?? current;
      let pageIds: string[] = [];
      if (replacing) {
        working = replacePageImage(working, replacing, images[0].imageDataUrl, images[0].fileName);
        pageIds = [replacing];
      } else {
        const before = new Set(working.pages.map((page) => page.id));
        working = appendPages(working, images, createId);
        pageIds = working.pages.filter((page) => !before.has(page.id)).map((page) => page.id);
      }
      working = await commit(working);
      await readIds(working, pageIds);
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }

  if (loading) return <BenchLoading label="Opening pages" />;
  if (missing || !set) return <MissingSet />;

  const pages = [...set.pages].sort((a, b) => a.order - b.order);
  const steps = orderedSteps(set.pages, set.steps);
  const retakes = pages.filter((page) => page.retake?.needed).length;

  return (
    <>
      <TopBar title="Pages" backHref={`/sets/${id}`} backLabel="Set" />
      <main className="space-y-4 px-4 py-4">
        {mode === "demo" ? (
          <p data-testid="demo-banner" className="rounded-2xl bg-stud/40 px-3 py-2 text-sm">
            Demo mode is on. Readings are sample data until an AI Gateway key is set.
          </p>
        ) : null}
        {notice ? <p className="text-sm text-muted">{notice}</p> : null}
        {error ? (
          <p className="text-sm text-brick-dark" role="alert">
            {error}
          </p>
        ) : null}
        {retakes > 0 ? (
          <p className="rounded-2xl bg-[#fff1ec] px-3 py-2 text-sm font-semibold text-brick-dark">
            {retakes === 1
              ? "1 photo needs a new shot before those pages can be trusted."
              : `${retakes} photos need a new shot before those pages can be trusted.`}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              replaceId.current = null;
              cameraRef.current?.click();
            }}
            className="min-h-11 flex-1 rounded-full bg-brick font-semibold text-white"
          >
            Take photo
          </button>
          <button
            type="button"
            onClick={() => {
              replaceId.current = null;
              uploadRef.current?.click();
            }}
            className="min-h-11 flex-1 rounded-full border border-ink/15 bg-card font-semibold"
          >
            Upload pages
          </button>
        </div>
        <input
          ref={cameraRef}
          data-testid="camera-input"
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(event) => void onFiles(event.target.files)}
        />
        <input
          ref={uploadRef}
          data-testid="upload-input"
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(event) => void onFiles(event.target.files)}
        />
        {pages.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line bg-card px-4 py-8 text-center text-sm text-muted">
            Add the booklet pages in order. A blurry or cropped shot will ask you to retake it.
          </p>
        ) : (
          <ol className="space-y-3" data-testid="page-list">
            {pages.map((page, index) => {
              const message = retakeMessage(page.retake);
              const pageSteps = steps.filter((step) => step.pageId === page.id).length;
              return (
                <li key={page.id} data-testid="page-card" className="rounded-3xl border border-line bg-card p-3">
                  <div className="flex gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={page.imageDataUrl} alt="" className="h-20 w-16 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">Page {index + 1}</p>
                      <p className="truncate text-xs text-muted">{page.fileName}</p>
                      <p data-testid="page-status" className="mt-1 text-sm">
                        {statusLabel(page.status)}
                        {pageSteps > 0 ? ` · ${pageSteps} steps` : ""}
                      </p>
                      {page.error ? <p className="text-sm text-brick-dark">{page.error}</p> : null}
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        aria-label={`Move page ${index + 1} up`}
                        disabled={index === 0 || busy}
                        onClick={() => commit(reorderPages(snapshot() ?? set, index, index - 1))}
                        className="rounded-full border border-line px-2 py-1 text-xs disabled:opacity-40"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        aria-label={`Move page ${index + 1} down`}
                        disabled={index === pages.length - 1 || busy}
                        onClick={() => commit(reorderPages(snapshot() ?? set, index, index + 1))}
                        className="rounded-full border border-line px-2 py-1 text-xs disabled:opacity-40"
                      >
                        Down
                      </button>
                    </div>
                  </div>
                  {page.status !== "reading" && !message ? (
                    <button
                      type="button"
                      className="mt-3 text-sm font-semibold text-brick-dark"
                      onClick={() => {
                        const current = snapshot();
                        if (!current) return;
                        void readIds(current, [page.id]);
                      }}
                    >
                      Read again
                    </button>
                  ) : null}
                  {message ? (
                    <div data-testid="retake-banner" role="status" className="mt-3 rounded-2xl bg-[#fff1ec] p-3">
                      <p className="font-semibold text-brick-dark">Retake this photo</p>
                      <p className="mt-1 text-sm">{message}</p>
                      <button
                        type="button"
                        data-testid="retake-button"
                        className="mt-3 min-h-11 w-full rounded-full bg-brick font-semibold text-white"
                        onClick={() => {
                          replaceId.current = page.id;
                          cameraRef.current?.click();
                        }}
                      >
                        Retake photo
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
        {steps.length > 0 ? (
          <Link
            href={`/sets/${id}/play`}
            data-testid="nav-play"
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink font-semibold text-paper"
          >
            Build these steps
          </Link>
        ) : null}
      </main>
    </>
  );
}

function statusLabel(status: string): string {
  if (status === "reading") return "Reading";
  if (status === "ready") return "Ready";
  if (status === "retake") return "Retake";
  if (status === "error") return "Could not read";
  return "Needs a read";
}
