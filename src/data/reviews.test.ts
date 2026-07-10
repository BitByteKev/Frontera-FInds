import { describe, it, expect } from "vitest";
import data from "./reviews.json";

const TAGS = ["communication", "pricing", "punctuality", "itemDescription"];

describe("reviews.json", () => {
  it("has a numeric summary with all four strengths", () => {
    expect(data.summary.rating).toBeGreaterThan(0);
    expect(data.summary.rating).toBeLessThanOrEqual(5);
    expect(data.summary.count).toBeGreaterThan(0);
    for (const k of TAGS) {
      expect(typeof (data.summary.strengths as Record<string, number>)[k]).toBe("number");
    }
  });

  it("has well-formed written reviews, newest first", () => {
    expect(data.reviews.length).toBeGreaterThan(0);
    let prev = Infinity;
    for (const r of data.reviews) {
      expect(r.name.trim()).not.toBe("");
      expect(r.text.trim()).not.toBe("");
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const ts = new Date(r.date + "T12:00:00Z").getTime();
      expect(Number.isNaN(ts)).toBe(false);
      expect(ts).toBeLessThanOrEqual(prev);
      prev = ts;
      for (const tag of r.tags) expect(TAGS).toContain(tag);
    }
  });
});
