import { useState } from "react";
import { useLang } from "../i18n/LanguageContext";

type Theme = "light" | "dark";

// The initial theme was already applied to <html data-theme> by the inline
// script in index.html (before first paint). Read it back from there.
function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const { t } = useLang();

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("ff_theme", next);
    } catch {
      /* private mode / storage disabled — ignore */
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      className="ff-theme-toggle"
      onClick={toggle}
      aria-label={theme === "dark" ? t("theme.toLight") : t("theme.toDark")}
      title={theme === "dark" ? t("theme.lightTitle") : t("theme.darkTitle")}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
