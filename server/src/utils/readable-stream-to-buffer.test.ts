import { describe, expect, it } from "vitest";

import { readableStreamToBuffer } from "./readable-stream-to-buffer";

describe("readableStreamToBuffer", () => {
  it("returns empty buffer for an empty stream", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    const buf = await readableStreamToBuffer(stream);
    expect(buf.byteLength).toBe(0);
  });

  it("concatenates chunks", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3]));
        controller.close();
      },
    });
    const buf = await readableStreamToBuffer(stream);
    expect([...buf]).toEqual([1, 2, 3]);
  });
});
