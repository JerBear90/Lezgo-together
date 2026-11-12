import { generateText, NoObjectGeneratedError, Output } from "ai";
import { aiConfigured, visionModel } from "@/lib/ai";
import {
  EXTRACTION_INSTRUCTIONS,
  ExtractionError,
  extractionSchema,
  mockPageExtraction,
  parseExtraction,
} from "@/lib/extraction";
import { decodeImageDataUrl } from "@/lib/image-payload";

export const maxDuration = 60;

type RequestBody = {
  imageDataUrl?: unknown;
  pageOrder?: unknown;
  setName?: unknown;
  previousMaxStep?: unknown;
};

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return jsonError("The request could not be read.", 400);
  }

  try {
    if (typeof body.imageDataUrl !== "string") {
      throw new Error("Add a photo of the instruction page.");
    }
    decodeImageDataUrl(body.imageDataUrl);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "That photo could not be read.", 400);
  }

  const pageOrder = wholeNumber(body.pageOrder);
  const previousMaxStep = wholeNumber(body.previousMaxStep);
  const setName = typeof body.setName === "string" ? body.setName.slice(0, 80) : "this set";

  if (!aiConfigured()) {
    try {
      const extraction = parseExtraction(mockPageExtraction(pageOrder), { previousMaxStep });
      return Response.json({
        mode: "demo",
        model: null,
        notice:
          "Demo mode is on. These steps are sample data, not a reading of your photo. Set AI_GATEWAY_API_KEY to use a vision model.",
        extraction,
      });
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Demo reading failed.", 500);
    }
  }

  try {
    const image = decodeImageDataUrl(body.imageDataUrl as string);
    const result = await generateText({
      model: visionModel(),
      system: EXTRACTION_INSTRUCTIONS,
      maxOutputTokens: 4096,
      temperature: 0.2,
      output: Output.object({
        schema: extractionSchema,
        name: "instruction_page",
        description: "Build steps from one booklet page, including uncertainty and a retake flag.",
      }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Set name: ${setName}. This is page ${pageOrder + 1}. The previous page ended at step ${previousMaxStep}. Use printed step numbers when they are visible. If none are printed, continue after step ${previousMaxStep}. Prefer uncertain over guessing. Do not guess.`,
            },
            { type: "file", data: image.bytes, mediaType: image.mediaType },
          ],
        },
      ],
    });
    const extraction = parseExtraction(result.output, { previousMaxStep });
    return Response.json({ mode: "live", model: visionModel(), extraction });
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error) && error.text) {
      try {
        const extraction = parseExtraction(error.text, { previousMaxStep });
        return Response.json({ mode: "live", model: visionModel(), extraction });
      } catch {
        return jsonError("The model reply did not match the step schema. Try the photo again.", 502);
      }
    }
    const message =
      error instanceof ExtractionError
        ? error.message
        : "The vision model could not read that page. Try a straighter, brighter photo.";
    return jsonError(message, 502);
  }
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

function wholeNumber(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round(numeric);
}
