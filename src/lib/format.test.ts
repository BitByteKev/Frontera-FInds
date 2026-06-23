import { describe, it, expect } from "vitest";
import { money, pesosFromCents, formatDual, roundPesos } from "./format";

describe("roundPesos", () => {
  it("rounds up to the next ten when above x5", () => {
    expect(roundPesos(86)).toBe(90);
    expect(roundPesos(89)).toBe(90);
    expect(roundPesos(187)).toBe(190);
  });
  it("rounds down to the ten when below x5", () => {
    expect(roundPesos(81)).toBe(80);
    expect(roundPesos(84)).toBe(80);
    expect(roundPesos(183)).toBe(180);
  });
  it("keeps values that land on $x5", () => {
    expect(roundPesos(85)).toBe(85);
    expect(roundPesos(185)).toBe(185);
    expect(roundPesos(2225)).toBe(2225);
  });
  it("leaves exact tens unchanged", () => {
    expect(roundPesos(80)).toBe(80);
    expect(roundPesos(2220)).toBe(2220);
  });
});

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
