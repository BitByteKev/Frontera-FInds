import { describe, it, expect } from "vitest";
import { money, pesosFromCents, formatDual } from "./format";

describe("money", () => {
  it("formats USD cents with the dollar sign and cents", () => {
    expect(money(12000)).toBe("$120.00");
  });
});

describe("pesosFromCents", () => {
  it("converts USD cents to whole pesos at the rate", () => {
    expect(pesosFromCents(12000, 18.5)).toBe(2220);
  });
  it("rounds to the nearest peso", () => {
    expect(pesosFromCents(999, 18.5)).toBe(Math.round(9.99 * 18.5)); // 185
  });
});

describe("formatDual", () => {
  it("shows both currencies with the peso approximate and thousands separators", () => {
    expect(formatDual(12000, 18.5)).toBe("$120.00 · ~$2,220 MXN");
  });
});
