import type { BrickSet, InstructionPage } from "../types";
import { blobConfigured } from "./store";

export async function externalizeImages(set: BrickSet, code: string): Promise<BrickSet> {
  if (!blobConfigured()) return set;
  const { put } = await import("@vercel/blob");
  const pages: InstructionPage[] = [];
  for (const page of set.pages) {
    pages.push(await uploadPage(put, code, page));
  }
  let cover = set.coverDataUrl;
  if (cover?.startsWith("data:")) {
    const file = decodeDataUrl(cover);
    if (file) {
      const blob = await put(`lezgo/${code}/cover`, file.bytes, {
        access: "public",
        contentType: file.mediaType,
        addRandomSuffix: true,
      });
      cover = blob.url;
    }
  }
  return { ...set, pages, coverDataUrl: cover };
}

async function uploadPage(
  put: typeof import("@vercel/blob").put,
  code: string,
  page: InstructionPage,
): Promise<InstructionPage> {
  if (!page.imageDataUrl.startsWith("data:")) return page;
  const file = decodeDataUrl(page.imageDataUrl);
  if (!file) return page;
  const blob = await put(`lezgo/${code}/${page.id}`, file.bytes, {
    access: "public",
    contentType: file.mediaType,
    addRandomSuffix: true,
  });
  return { ...page, imageDataUrl: blob.url };
}

function decodeDataUrl(dataUrl: string): { bytes: Buffer; mediaType: string } | null {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/.exec(dataUrl);
  if (!match) return null;
  const mediaType = match[1] || "application/octet-stream";
  const bytes = match[2] ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3]));
  return { bytes, mediaType };
}
