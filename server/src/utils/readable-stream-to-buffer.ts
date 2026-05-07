/** Collect a byte stream into a single buffer (Node / undici streams). */
export async function readableStreamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const parts: Buffer[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value !== undefined && value.byteLength > 0) {
        parts.push(Buffer.from(value));
      }
    }
  } finally {
    reader.releaseLock();
  }
  return parts.length === 0 ? Buffer.alloc(0) : Buffer.concat(parts);
}
