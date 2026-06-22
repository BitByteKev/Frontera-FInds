import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { en, es } from "./strings";
import type { TranslationKey } from "./strings";
import { resolveInitialLang, translate } from "./translate";
import type { Lang } from "./translate";

const dict: Record<Lang, Record<string, string>> = { en, es };

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

function readStored(): string | null {
  try {
    return localStorage.getItem("ff_lang");
  } catch {
    return null; // private mode / storage disabled
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    resolveInitialLang(
      readStored(),
      typeof navigator !== "undefined" ? navigator.language : undefined,
    ),
  );

  function setLang(l: Lang) {
    setLangState(l);
    try {
      localStorage.setItem("ff_lang", l);
    } catch {
      /* ignore */
    }
  }

  // Keep the document language in sync for assistive tech and search engines.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key: TranslationKey, params?: Record<string, string | number>) =>
    translate(dict, lang, key, params);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang(): Ctx {
  const c = useContext(LanguageContext);
  if (!c) throw new Error("useLang must be used within a LanguageProvider");
  return c;
}
