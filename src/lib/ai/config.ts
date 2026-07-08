/**
 * AI provider configuration (NVIDIA).
 *
 * Reads env at call-time (not module-load) so it works correctly on the server
 * and stays testable. NEVER throws — if NVIDIA_API_KEY is missing the app must
 * keep working with AI simply disabled.
 *
 * This module is SERVER-ONLY in practice: it is imported only by the AI service,
 * the AI API route, and the (server) Executive page. The API key is never sent
 * to the client — the UI receives only a boolean `aiEnabled` flag.
 */

export interface AiProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";
// A chat/instruct model with good Arabic support. Override with NVIDIA_MODEL.
const DEFAULT_MODEL = "meta/llama-3.1-70b-instruct";

function isTrue(value: string | undefined): boolean {
  return String(value ?? "").trim().toLowerCase() === "true";
}

/**
 * AI is enabled ONLY when AI_ANALYSIS_ENABLED=true AND an API key is present.
 * If either is missing, returns false and no NVIDIA call is ever made.
 */
export function isAiEnabled(): boolean {
  return isTrue(process.env.AI_ANALYSIS_ENABLED) && !!(process.env.NVIDIA_API_KEY || "").trim();
}

/**
 * Returns the provider config, or null when the API key is missing.
 * Never throws.
 */
export function aiProviderConfig(): AiProviderConfig | null {
  const apiKey = (process.env.NVIDIA_API_KEY || "").trim();
  if (!apiKey) return null;
  const baseUrl = (process.env.NVIDIA_BASE_URL || DEFAULT_BASE_URL)
    .trim()
    .replace(/\/+$/, "");
  const model = (process.env.NVIDIA_MODEL || DEFAULT_MODEL).trim();
  return { apiKey, baseUrl, model };
}
