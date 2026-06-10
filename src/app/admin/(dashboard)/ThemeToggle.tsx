"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("admin-theme");
    const currentTheme = document.documentElement.getAttribute("data-theme");
    
    if (savedTheme === "light" || currentTheme === "light") {
      setTheme("light");
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      setTheme("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("admin-theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
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
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-[#181818] text-slate-400 transition-all duration-300 hover:border-[#1DB954]/40 hover:text-white active:scale-95"
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
