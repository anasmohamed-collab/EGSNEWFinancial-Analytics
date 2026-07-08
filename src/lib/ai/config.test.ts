import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isAiEnabled, aiProviderConfig } from "./config";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.AI_ANALYSIS_ENABLED;
  delete process.env.NVIDIA_API_KEY;
  delete process.env.NVIDIA_BASE_URL;
  delete process.env.NVIDIA_MODEL;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("ai config — isAiEnabled", () => {
  it("is false when AI_ANALYSIS_ENABLED is unset", () => {
    expect(isAiEnabled()).toBe(false);
  });

  it("is false when enabled=true but the API key is missing", () => {
    process.env.AI_ANALYSIS_ENABLED = "true";
    expect(isAiEnabled()).toBe(false);
  });

  it("is false when a key exists but the flag is false", () => {
    process.env.NVIDIA_API_KEY = "secret-key";
    process.env.AI_ANALYSIS_ENABLED = "false";
    expect(isAiEnabled()).toBe(false);
  });

  it("is true only when the flag is true AND a key is present", () => {
    process.env.AI_ANALYSIS_ENABLED = "true";
    process.env.NVIDIA_API_KEY = "secret-key";
    expect(isAiEnabled()).toBe(true);
  });
});

describe("ai config — aiProviderConfig", () => {
  it("returns null (never throws) when the key is missing", () => {
    expect(aiProviderConfig()).toBeNull();
  });

  it("returns config with sane defaults when a key is present", () => {
    process.env.NVIDIA_API_KEY = "secret-key";
    const c = aiProviderConfig();
    expect(c).not.toBeNull();
    expect(c!.apiKey).toBe("secret-key");
    expect(c!.baseUrl).toContain("integrate.api.nvidia.com");
    expect(c!.model.length).toBeGreaterThan(0);
  });

  it("honors overrides and strips a trailing slash from the base URL", () => {
    process.env.NVIDIA_API_KEY = "secret-key";
    process.env.NVIDIA_BASE_URL = "https://example.test/v1/";
    process.env.NVIDIA_MODEL = "my/model";
    const c = aiProviderConfig()!;
    expect(c.baseUrl).toBe("https://example.test/v1");
    expect(c.model).toBe("my/model");
  });
});
