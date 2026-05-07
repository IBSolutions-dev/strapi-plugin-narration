import { AsyncLocalStorage } from "node:async_hooks";

import type { Core } from "@strapi/strapi";
import { fetch as undiciFetch } from "undici";

import { createElevenLabsNetworkError } from "./elevenlabs-errors";
import { getElevenLabsProxyAgent, isElevenLabsProxyConfigured } from "./elevenlabs-proxy";
import { logNarrationEvent } from "./narration-telemetry";

export type ElevenLabsSdkFetchContext = {
  narrationRequestId: string;
  operation: string;
};

const ctx = new AsyncLocalStorage<ElevenLabsSdkFetchContext>();

/** Run `fn` while SDK HTTP calls include telemetry context for {@link createElevenLabsSdkFetch}. */
export async function withElevenLabsSdkFetchContext<T>(
  store: ElevenLabsSdkFetchContext,
  fn: () => Promise<T>
): Promise<T> {
  return ctx.run(store, fn);
}

/**
 * `fetch` implementation for {@link ElevenLabsClient} — proxy support and fetch failure mapping
 * match the previous `elevenLabsFetch` behavior.
 */
export function createElevenLabsSdkFetch(strapi: Core.Strapi): typeof globalThis.fetch {
  return async (input, init): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const store = ctx.getStore();
    const narrationRequestId = store?.narrationRequestId ?? "n/a";
    const operation = store?.operation ?? "sdk_http";
    const useProxy = isElevenLabsProxyConfigured();

    logNarrationEvent(strapi, "info", "elevenlabs.fetch.start", {
      narrationRequestId,
      operation,
      method: init?.method ?? "GET",
      url,
      httpsProxyConfigured: useProxy,
    });

    try {
      if (useProxy) {
        const dispatcher = getElevenLabsProxyAgent();
        /* undici Response is Web-compatible at runtime; package types can disagree with `dom` lib. */
        return (await undiciFetch(
          input as never,
          {
            ...(init ?? {}),
            dispatcher,
          } as never
        )) as Response;
      }
      return await fetch(input, init);
    } catch (cause) {
      logNarrationEvent(strapi, "error", "elevenlabs.fetch.failed", {
        narrationRequestId,
        operation,
        causeName: cause instanceof Error ? cause.name : typeof cause,
        causeMessage: cause instanceof Error ? cause.message : String(cause),
        causeStack: cause instanceof Error ? cause.stack : undefined,
      });
      throw createElevenLabsNetworkError(cause);
    }
  };
}
