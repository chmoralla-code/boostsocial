"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("site-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    if (savedTheme === "light" || (!savedTheme && !prefersDark)) {
      setTheme("light");
      document.documentElement.classList.add("light-mode");
      document.body.classList.add("light-mode");
    } else {
      setTheme("dark");
      document.documentElement.classList.remove("light-mode");
      document.body.classList.remove("light-mode");
    }
  }, []);

  const toggleTheme = () => {
    if (theme === "dark") {
      setTheme("light");
      localStorage.setItem("site-theme", "light");
      document.documentElement.classList.add("light-mode");
      document.body.classList.add("light-mode");
    } else {
      setTheme("dark");
      localStorage.setItem("site-theme", "dark");
      document.documentElement.classList.remove("light-mode");
      document.body.classList.remove("light-mode");
    }
  };

  if (!mounted) {
    return (
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800/80 bg-[#181818]/80 text-slate-400 transition-all duration-300 hover:border-[#1DB954]/40 hover:text-white"
        aria-label="Loading theme..."
      >
        <Moon size={18} />
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800/80 bg-[#181818]/80 text-slate-400 transition-all duration-300 hover:border-[#1DB954]/40 hover:text-white group"
      title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      {theme === "dark" ? (
        <Sun size={18} className="text-amber-400 group-hover:rotate-12 transition-transform duration-300" />
      ) : (
        <Moon size={18} className="text-indigo-400 group-hover:-rotate-12 transition-transform duration-300" />
      )}
    </button>
  );
}