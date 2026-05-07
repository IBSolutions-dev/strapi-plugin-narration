import { describe, expect, it } from "vitest";
import {
  extractNarrationPlainText,
  formatNarrationSourceBreakTime,
  joinNarrationSourcesWithPause,
  stripByDelimiterPairs,
} from "./extract-plain-text";
import { mergeNarrationOptions } from "./narration-options";

describe("stripByDelimiterPairs", () => {
  it("removes from open through close inclusive (repeated)", () => {
    expect(
      stripByDelimiterPairs("a {{component:hr}} b", [{ open: "{{component:", close: "}}" }])
    ).toBe("a  b");
    expect(
      stripByDelimiterPairs("{{component:x}}mid{{component:y}}", [
        { open: "{{component:", close: "}}" },
      ])
    ).toBe("mid");
  });

  it("applies pairs in configured order", () => {
    const out = stripByDelimiterPairs("[a]<<b>>", [
      { open: "<<", close: ">>" },
      { open: "[", close: "]" },
    ]);
    expect(out).toBe("");
  });

  it("leaves tail when close is missing", () => {
    expect(
      stripByDelimiterPairs("x {{component: orphan", [{ open: "{{component:", close: "}}" }])
    ).toBe("x {{component: orphan");
  });

  it("skips pairs with empty open or close", () => {
    expect(stripByDelimiterPairs("hello", [{ open: "", close: "}}" }])).toBe("hello");
  });
});

describe("joinNarrationSourcesWithPause", () => {
  it("joins with paragraph breaks only when pause is 0", () => {
    expect(joinNarrationSourcesWithPause(["a", "b"], 0)).toBe("a\n\nb");
  });

  it("inserts SSML break between parts when pause is positive", () => {
    expect(joinNarrationSourcesWithPause(["a", "b"], 0.5)).toBe('a\n\n<break time="0.5s" />\n\nb');
    expect(joinNarrationSourcesWithPause(["x", "y", "z"], 1)).toContain('<break time="1s" />');
  });

  it("returns empty string for no parts", () => {
    expect(joinNarrationSourcesWithPause([], 1)).toBe("");
  });
});

describe("formatNarrationSourceBreakTime", () => {
  it("rounds and clamps to configured limits", () => {
    expect(formatNarrationSourceBreakTime(0.506)).toBe("0.51s");
    expect(formatNarrationSourceBreakTime(99)).toBe("3s");
  });
});

describe("extractNarrationPlainText", () => {
  it("inserts configured pause between multiple sources", () => {
    const opts = mergeNarrationOptions({
      narrationSources: [
        { field: "title", kind: "scalar" },
        { field: "description", kind: "scalar" },
      ],
      narrationSourcePauseSeconds: 0.75,
    });
    const text = extractNarrationPlainText({ title: "Hello", description: "World" }, opts);
    expect(text).toContain('<break time="0.75s" />');
    expect(text.indexOf("Hello")).toBeLessThan(text.indexOf("World"));
  });

  it("concatenates sources in configured order (legacy merge)", () => {
    const opts = mergeNarrationOptions({
      narrationSources: [
        { field: "title", kind: "scalar" },
        { field: "description", kind: "scalar" },
        { field: "content", kind: "blocks" },
      ],
    });
    const text = extractNarrationPlainText(
      {
        title: "Hello",
        description: "World",
        content: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "First para." }],
          },
        ],
      },
      opts
    );
    expect(text.indexOf("Hello")).toBeLessThan(text.indexOf("World"));
    expect(text).toContain("First para.");
  });

  it("respects interleaved order (blocks before scalar)", () => {
    const opts = mergeNarrationOptions({
      narrationSources: [
        { field: "content", kind: "blocks" },
        { field: "title", kind: "scalar" },
      ],
    });
    const text = extractNarrationPlainText(
      {
        title: "T",
        content: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "B" }],
          },
        ],
      },
      opts
    );
    expect(text.indexOf("B")).toBeLessThan(text.indexOf("T"));
  });

  it("skips code blocks", () => {
    const opts = mergeNarrationOptions({
      narrationSources: [{ field: "content", kind: "blocks" }],
    });
    const text = extractNarrationPlainText(
      {
        content: [
          {
            type: "code",
            children: [{ type: "text", text: "secret" }],
          },
          {
            type: "paragraph",
            children: [{ type: "text", text: "visible" }],
          },
        ],
      },
      opts
    );
    expect(text).not.toContain("secret");
    expect(text).toContain("visible");
  });

  it("does not strip when stripDelimiterPairs is empty", () => {
    const opts = mergeNarrationOptions({
      narrationSources: [{ field: "content", kind: "blocks" }],
    });
    const text = extractNarrationPlainText(
      {
        content: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Before {{component:hr}} After" }],
          },
        ],
      },
      opts
    );
    expect(text).toContain("{{component:hr}}");
  });

  it("strips using merged delimiter pairs", () => {
    const opts = mergeNarrationOptions({
      narrationSources: [{ field: "content", kind: "blocks" }],
      stripDelimiterPairs: [{ open: "{{component:", close: "}}" }],
    });
    const text = extractNarrationPlainText(
      {
        content: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Hi {{component:hr}} bye" }],
          },
        ],
      },
      opts
    );
    expect(text.replace(/\s+/g, " ").trim()).toBe("Hi bye");
  });
});
