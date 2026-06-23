export function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// Snap a peso amount to a tidier figure: round to the nearest ten, but keep
// anything that already lands on $x5 (e.g. 185 stays 185). So 86→90, 84→80, 85→85.
export function roundPesos(pesos: number): number {
  const rem = pesos % 10;
  if (rem === 5) return pesos; // $x5 stays put
  if (rem < 5) return pesos - rem; // round down to the ten
  return pesos + (10 - rem); // round up to the next ten
}

// Convert a USD-cent price to tidied whole Mexican pesos at the given rate.
export function pesosFromCents(cents: number, usdMxn: number): number {
  return roundPesos(Math.round((cents / 100) * usdMxn));
}

// Show a price in both currencies, e.g. "$120.00 · ~$2,220 MXN". The peso figure is
// approximate (rounded, live-rate) so it carries a "~"; the dollar figure is exact.
export function formatDual(cents: number, usdMxn: number): string {
  const mxn = pesosFromCents(cents, usdMxn).toLocaleString("en-US");
  return `${money(cents)} · ~$${mxn} MXN`;
}
export function imgUrl(key: string): string {
  return `/img/${key}`;
}
