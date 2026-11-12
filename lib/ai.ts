/** Confirmed on the AI Gateway catalog: vision input and structured output. */
export const DEFAULT_VISION_MODEL = "google/gemini-3.5-flash-lite";

export function visionModel(): string {
  const configured = process.env["AI_GATEWAY_MODEL"]?.trim();
  return configured || DEFAULT_VISION_MODEL;
}

export function aiConfigured(): boolean {
  const key = process.env["AI_GATEWAY_API_KEY"]?.trim();
  const oidc = process.env["VERCEL_OIDC_TOKEN"]?.trim();
  return Boolean(key || oidc);
}
