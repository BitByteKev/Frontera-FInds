export function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
export function imgUrl(key: string): string {
  return `/img/${key}`;
}
