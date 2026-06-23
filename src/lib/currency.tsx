import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { api } from "./api";

// Seed with an approximate rate so dual prices render on first paint; the live rate
// from /api/fx replaces it once fetched (and is edge-cached server-side).
const DEFAULT_USD_MXN = 18.5;

const CurrencyContext = createContext<number>(DEFAULT_USD_MXN);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [rate, setRate] = useState(DEFAULT_USD_MXN);

  useEffect(() => {
    api.fx()
      .then((r) => { if (typeof r.rate === "number" && r.rate > 0) setRate(r.rate); })
      .catch(() => { /* keep the default */ });
  }, []);

  return <CurrencyContext.Provider value={rate}>{children}</CurrencyContext.Provider>;
}

// The current USD→MXN rate. Read by price displays to render the peso figure.
export const useRate = () => useContext(CurrencyContext);
