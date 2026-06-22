import { env } from "cloudflare:test";
import { describe, it, expect, vi } from "vitest";

vi.mock("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    messages = {
      create: vi.fn(async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              title_en: "Red Bike",
              title_es: "Bicicleta Roja",
              description_en: "A nice red bike.",
              description_es: "Una linda bici roja.",
            }),
          },
        ],
      })),
    };
    constructor(_opts: unknown) {}
  }
  return { default: FakeAnthropic };
});

const { translateListing } = await import("../src/translate");

describe("translateListing", () => {
  it("returns clean EN and ES title/description", async () => {
    const out = await translateListing(env as any, "bici roja", "una linda bici roja");
    expect(out.title_en).toBe("Red Bike");
    expect(out.title_es).toBe("Bicicleta Roja");
    expect(out.description_en).toBe("A nice red bike.");
    expect(out.description_es).toBe("Una linda bici roja.");
  });
});
