import dns from "node:dns";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applyElevenLabsOutboundDnsDefaults } from "./elevenlabs-dns";

function mockStrapi(log: {
  info: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
}) {
  return { log } as never;
}

describe("applyElevenLabsOutboundDnsDefaults", () => {
  const prev = process.env.ELEVENLABS_DNS_IPV4_FIRST;

  afterEach(() => {
    vi.restoreAllMocks();
    if (prev === undefined) delete process.env.ELEVENLABS_DNS_IPV4_FIRST;
    else process.env.ELEVENLABS_DNS_IPV4_FIRST = prev;
  });

  it("does NOT touch DNS result order when env is unset (opt-in default)", () => {
    delete process.env.ELEVENLABS_DNS_IPV4_FIRST;
    const spy = vi.spyOn(dns, "setDefaultResultOrder").mockImplementation(() => undefined);
    const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn() };
    applyElevenLabsOutboundDnsDefaults(mockStrapi(log));
    expect(spy).not.toHaveBeenCalled();
    expect(log.debug).toHaveBeenCalled();
    expect(log.info).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("does NOT touch DNS result order when env is 0/false/off/no", () => {
    const spy = vi.spyOn(dns, "setDefaultResultOrder").mockImplementation(() => undefined);
    const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn() };
    for (const v of ["0", "false", "off", "no", "anything-else"]) {
      process.env.ELEVENLABS_DNS_IPV4_FIRST = v;
      applyElevenLabsOutboundDnsDefaults(mockStrapi(log));
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("calls dns.setDefaultResultOrder('ipv4first') when env opts in (1/true/on/yes)", () => {
    const spy = vi.spyOn(dns, "setDefaultResultOrder").mockImplementation(() => undefined);
    const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn() };
    for (const v of ["1", "true", "on", "yes", "TRUE", "Yes"]) {
      process.env.ELEVENLABS_DNS_IPV4_FIRST = v;
      applyElevenLabsOutboundDnsDefaults(mockStrapi(log));
    }
    expect(spy).toHaveBeenCalledWith("ipv4first");
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(6);
    expect(log.info).toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("logs a warning when dns.setDefaultResultOrder throws", () => {
    process.env.ELEVENLABS_DNS_IPV4_FIRST = "1";
    const err = new Error("boom");
    vi.spyOn(dns, "setDefaultResultOrder").mockImplementation(() => {
      throw err;
    });
    const log = { info: vi.fn(), debug: vi.fn(), warn: vi.fn() };
    applyElevenLabsOutboundDnsDefaults(mockStrapi(log));
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("boom"));
  });
});
