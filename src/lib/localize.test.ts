import { describe, it, expect } from "vitest";
import { pickText, localizeItem } from "./localize";
import type { Item } from "./types";

const base: Item = {
  id: "1", slug: "1", title: "Bike", description: "A bike",
  priceCents: 100, category: "misc", shipsUsa: true, localSdtj: true,
  status: "published", createdAt: 0, updatedAt: 0, photoKeys: [],
  titleEn: "Bike", titleEs: "Bicicleta", descriptionEn: "A bike", descriptionEs: "Una bici",
};

describe("pickText", () => {
  it("picks Spanish in es mode", () => {
    expect(pickText(base, "title", "es")).toBe("Bicicleta");
    expect(pickText(base, "description", "es")).toBe("Una bici");
  });
  it("picks English in en mode", () => {
    expect(pickText(base, "title", "en")).toBe("Bike");
  });
  it("falls back to raw when the translation is missing", () => {
    const legacy = { ...base, titleEs: null, titleEn: undefined };
    expect(pickText(legacy, "title", "es")).toBe("Bike");
    expect(pickText(legacy, "title", "en")).toBe("Bike");
  });
});

describe("localizeItem", () => {
  it("swaps title/description to the active language", () => {
    const es = localizeItem(base, "es");
    expect(es.title).toBe("Bicicleta");
    expect(es.description).toBe("Una bici");
    // Raw fields remain available
    expect(es.titleEn).toBe("Bike");
  });
});
