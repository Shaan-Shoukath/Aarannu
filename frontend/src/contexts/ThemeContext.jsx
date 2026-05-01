import { useEffect, useMemo, useState } from "react";
import { ThemeContext } from "./themeContextValue";

const THEME_STORAGE_KEY = "aarannu-theme";

function getInitialTheme() {
  if (typeof window === "undefined") return "dark";

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;

  return window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);
  const isLightTheme = theme === "light";

  useEffect(() => {
    const root = document.documentElement;

    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    root.dataset.theme = theme;
    root.style.colorScheme = isLightTheme ? "light" : "dark";
    document.body.style.backgroundColor = isLightTheme ? "#ffffff" : "#000000";
  }, [isLightTheme, theme]);

  const value = useMemo(
    () => ({
      theme,
      isLightTheme,
      setTheme,
      toggleTheme: () => {
        setTheme((currentTheme) =>
          currentTheme === "light" ? "dark" : "light"
        );
      },
    }),
    [isLightTheme, theme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
