import { useLang } from "../i18n/LanguageContext";

export default function LanguageToggle() {
  const { lang, setLang } = useLang();
  const targetIsSpanish = lang === "en";

  return (
    <button
      type="button"
      className="ff-lang-toggle"
      onClick={() => setLang(targetIsSpanish ? "es" : "en")}
      aria-label={targetIsSpanish ? "Cambiar a español" : "Switch to English"}
      title={targetIsSpanish ? "Cambiar a español" : "Switch to English"}
    >
      {targetIsSpanish ? "ES" : "EN"}
    </button>
  );
}
