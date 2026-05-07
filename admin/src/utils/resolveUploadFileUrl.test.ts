import { describe, expect, it } from "vitest";

import {
  parseUploadFileFindOneResponse,
  resolveUploadFileAbsoluteUrl,
} from "./resolveUploadFileUrl";

describe("resolveUploadFileAbsoluteUrl", () => {
  it("joins relative paths to backend base", () => {
    expect(
      resolveUploadFileAbsoluteUrl("http://localhost:1337", {
        url: "/uploads/narration.mp3",
      })
    ).toBe("http://localhost:1337/uploads/narration.mp3");
  });

  it("preserves absolute http(s) urls (e.g. signed)", () => {
    expect(
      resolveUploadFileAbsoluteUrl("http://localhost:1337", {
        url: "https://cdn.example.com/x.mp3",
      })
    ).toBe("https://cdn.example.com/x.mp3");
  });

  it("returns null when url missing", () => {
    expect(resolveUploadFileAbsoluteUrl("http://x", {})).toBeNull();
  });
});

describe("parseUploadFileFindOneResponse", () => {
  it("parses sanitized file object", () => {
    expect(
      parseUploadFileFindOneResponse({
        id: 1,
        url: "/uploads/a.mp3",
        name: "a.mp3",
      })
    ).toEqual({ url: "/uploads/a.mp3", name: "a.mp3" });
  });

  it("returns null when url not a string", () => {
    expect(parseUploadFileFindOneResponse({ name: "x" })).toBeNull();
  });
});
