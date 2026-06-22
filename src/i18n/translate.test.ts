import { describe, it, expect } from "vitest";
import { resolveInitialLang, translate } from "./translate";
import { en, es } from "./strings";

describe("resolveInitialLang", () => {
  it("prefers a valid stored value", () => {
    expect(resolveInitialLang("es", "en-US")).toBe("es");
    expect(resolveInitialLang("en", "es-MX")).toBe("en");
  });
  it("falls back to navigator language when nothing valid is stored", () => {
    expect(resolveInitialLang(null, "es-MX")).toBe("es");
    expect(resolveInitialLang("garbage", "es")).toBe("es");
    expect(resolveInitialLang(null, "en-US")).toBe("en");
    expect(resolveInitialLang(null, undefined)).toBe("en");
  });
});

describe("translate", () => {
  const dict = {
    en: { greet: "Hello {name}", plain: "Hi" },
    es: { greet: "Hola {name}", plain: "Hola" },
  };
  it("returns the string for the active language", () => {
    expect(translate(dict, "es", "plain")).toBe("Hola");
  });
  it("interpolates {tokens}", () => {
    expect(translate(dict, "en", "greet", { name: "Ana" })).toBe("Hello Ana");
  });
  it("falls back to english when a key is missing in the target language", () => {
    const partial = { en: { only: "English" }, es: {} as Record<string, string> };
    expect(translate(partial, "es", "only")).toBe("English");
  });
  it("returns the key itself when it exists nowhere", () => {
    expect(translate(dict, "en", "missing")).toBe("missing");
  });
});

describe("dictionary completeness", () => {
  it("es defines every key that en does", () => {
    const missing = Object.keys(en).filter((k) => !(k in es));
    expect(missing).toEqual([]);
  });
});
