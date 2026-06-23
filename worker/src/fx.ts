import { Hono } from "hono";
import type { Env } from "./index";

// Used when the upstream FX API is unreachable or returns something implausible.
// Prices on this site are negotiable, so an approximate peso figure is acceptable.
export const FALLBACK_USD_MXN = 18.5;

const FX_URL = "https://open.er-api.com/v6/latest/USD";

export const fx = new Hono<{ Bindings: Env }>();

// Returns the current USD→MXN rate. The upstream response is cached at Cloudflare's
// edge (~12h) so this costs at most one subrequest per location per half-day.
fx.get("/api/fx", async (c) => {
  let rate = FALLBACK_USD_MXN;
  try {
    const res = await fetch(FX_URL, {
      cf: { cacheTtl: 43200, cacheEverything: true },
    } as RequestInit);
    if (res.ok) {
      const data = (await res.json()) as { rates?: { MXN?: number } };
      const mxn = data?.rates?.MXN;
      // Sanity-bound the value so a garbage response can't show absurd prices.
      if (typeof mxn === "number" && mxn > 0 && mxn < 1000) rate = mxn;
    }
  } catch {
    /* network/parse failure — keep the fallback */
  }
  return c.json({ rate });
});
