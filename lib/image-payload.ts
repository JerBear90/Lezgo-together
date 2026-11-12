export type DecodedImage = {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  bytes: Uint8Array;
};

const MAX_BYTES = 3_500_000;

export function decodeImageDataUrl(dataUrl: string): DecodedImage {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([a-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!match) {
    throw new Error("Use a JPEG, PNG, or WebP photo.");
  }
  const rawType = match[1].toLowerCase();
  const mediaType = rawType === "image/jpg" ? "image/jpeg" : (rawType as DecodedImage["mediaType"]);
  const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (bytes.length < 32) throw new Error("That photo looks empty.");
  if (bytes.length > MAX_BYTES) {
    throw new Error("That photo is too large. Retake it a little farther from the page.");
  }
  return { mediaType, bytes };
}
