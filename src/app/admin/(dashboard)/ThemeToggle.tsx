"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    // Read theme from localStorage or document class
    const savedTheme = localStorage.getItem("admin-theme");
    const hasLightClass = document.documentElement.classList.contains("light-mode") || document.body.classList.contains("light-mode");
    
    if (savedTheme === "light" || (!savedTheme && hasLightClass)) {
      setTheme("light");
      document.documentElement.classList.add("light-mode");
      document.body.classList.add("light-mode");
    } else {
      setTheme("dark");
      document.documentElement.classList.remove("light-mode");
      document.body.classList.add("dark-mode");
    }
  }, []);

  const toggleTheme = () => {
    if (theme === "dark") {
      setTheme("light");
      localStorage.setItem("admin-theme", "light");
      document.documentElement.classList.add("light-mode");
      document.body.classList.add("light-mode");
      document.documentElement.classList.remove("dark-mode");
      document.body.classList.remove("dark-mode");
    } else {
      setTheme("dark");
      localStorage.setItem("admin-theme", "dark");
      document.documentElement.classList.remove("light-mode");
      document.body.classList.remove("light-mode");
      document.documentElement.classList.add("dark-mode");
      document.body.classList.add("dark-mode");
    }
  };

  const icon =
    theme === "dark" ? (
      <Sun size={18} className="text-amber-500 group-hover:rotate-12 transition-transform duration-300" />
    ) : (
      <Moon size={18} className="text-indigo-400 group-hover:-rotate-12 transition-transform duration-300" />
    );

  if (compact) {
    return (
      <button
        onClick={toggleTheme}
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800/80 bg-[#181818]/80 text-slate-400 transition-all duration-300 hover:border-[#1DB954]/40 hover:text-white"
        title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {icon}
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="flex items-center gap-3 px-4 py-3 w-full rounded-xl hover:bg-slate-800/40 text-slate-400 hover:text-white transition-all duration-300 text-left cursor-pointer group"
      title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      {icon}
      <span className="font-semibold text-xs uppercase tracking-wider">
        {theme === "dark" ? "Light Mode" : "Dark Mode"}
      </span>
    </button>
  );
}
