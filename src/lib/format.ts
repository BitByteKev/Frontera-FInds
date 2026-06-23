export function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// Convert a USD-cent price to whole Mexican pesos at the given rate.
export function pesosFromCents(cents: number, usdMxn: number): number {
  return Math.round((cents / 100) * usdMxn);
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
