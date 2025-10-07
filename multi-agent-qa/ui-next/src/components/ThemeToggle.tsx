"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("qa_theme");
      const prefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
      if (saved === "light") setTheme("light");
      else if (saved === "dark") setTheme("dark");
      else setTheme(prefersLight ? "light" : "dark");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
    try {
      localStorage.setItem("qa_theme", theme);
      // emit a small event so other parts (editor) can react immediately
      try {
        window.dispatchEvent(new CustomEvent('qa:theme-change', { detail: { theme } }));
      } catch {}
    } catch {
      // ignore
    }
  }, [theme]);

  return (
    <button
      aria-label="Toggle theme"
      title="Toggle Light/Dark theme"
      onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      className="btn btn-ghost theme-toggle rounded-full"
      style={{ transition: "transform .12s ease, background-color .12s ease" }}
    >
      {theme === "dark" ? <Moon className="h-6 w-6" /> : <Sun className="h-6 w-6" />}
    </button>
  );
}
