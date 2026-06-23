import { Hono } from "hono";
import type { Env } from "./index";

// Used when the upstream FX API is unreachable or returns something implausible.
// Prices on this site are negotiable, so an approximate peso figure is acceptable.
export const FALLBACK_USD_MXN = 18.5;

const FX_URL = "https://open.er-api.com/v6/latest/USD";

// Returns the current USD→MXN rate, edge-cached (~12h) so this costs at most one
// upstream subrequest per location per half-day. Never throws: falls back to
// FALLBACK_USD_MXN on network/parse failure or an implausible value. Shared by the
// /api/fx route (client price displays) and the OG handler (link previews).
export async function getUsdMxnRate(): Promise<number> {
  try {
    const res = await fetch(FX_URL, {
      cf: { cacheTtl: 43200, cacheEverything: true },
      // Don't let a hung upstream stall first paint — fail over to the fallback fast.
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = (await res.json()) as { rates?: { MXN?: number } };
      const mxn = data?.rates?.MXN;
      // Sanity-bound the value so a garbage response can't show absurd prices.
      if (typeof mxn === "number" && mxn > 0 && mxn < 1000) return mxn;
    }
  } catch {
    /* network/parse failure — keep the fallback */
  }
  return FALLBACK_USD_MXN;
}

export const fx = new Hono<{ Bindings: Env }>();

fx.get("/api/fx", async (c) => {
  return c.json({ rate: await getUsdMxnRate() });
});
