import { useState } from "react";

type Theme = "light" | "dark";

// The initial theme was already applied to <html data-theme> by the inline
// script in index.html (before first paint). Read it back from there.
function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

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
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
