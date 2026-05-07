import { describe, expect, it } from "vitest";
import {
  ELEVENLABS_DEVELOPER_USAGE_ANALYTICS,
  OPENAI_PLATFORM_USAGE,
} from "./narrationProviderUsageUrls";

describe("narrationProviderUsageUrls", () => {
  it("uses stable HTTPS vendor usage dashboard URLs", () => {
    expect(ELEVENLABS_DEVELOPER_USAGE_ANALYTICS).toMatch(/^https:\/\/elevenlabs\.io\//);
    expect(ELEVENLABS_DEVELOPER_USAGE_ANALYTICS).toContain("/developers/analytics/usage");
    expect(OPENAI_PLATFORM_USAGE).toBe("https://platform.openai.com/usage");
  });
});
