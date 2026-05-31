"use client";

import { useCallback, useEffect, useState } from "react";

export const SIMPLE_MODE_STORAGE_KEY = "pinoyboosting_simple_mode";
export const SIMPLE_MODE_EVENT = "pinoyboosting-simple-mode-change";

function readInitialSimpleMode() {
  if (typeof window === "undefined") return false;

  try {
    return (
      window.localStorage.getItem(SIMPLE_MODE_STORAGE_KEY) === "1" ||
      document.documentElement.classList.contains("simple-mode")
    );
  } catch {
    return document.documentElement.classList.contains("simple-mode");
  }
}

function applySimpleMode(enabled: boolean) {
  document.documentElement.classList.toggle("simple-mode", enabled);
}

export function useSimpleMode() {
  const [simpleMode, setSimpleModeState] = useState(false);

  const setSimpleMode = useCallback((enabled: boolean) => {
    setSimpleModeState(enabled);

    if (typeof window === "undefined") return;

    applySimpleMode(enabled);
    try {
      window.localStorage.setItem(SIMPLE_MODE_STORAGE_KEY, enabled ? "1" : "0");
    } catch {}

    window.dispatchEvent(new CustomEvent(SIMPLE_MODE_EVENT, { detail: { enabled } }));
  }, []);

  useEffect(() => {
    const enabled = readInitialSimpleMode();
    setSimpleModeState(enabled);
    applySimpleMode(enabled);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === SIMPLE_MODE_STORAGE_KEY) {
        const nextEnabled = event.newValue === "1";
        setSimpleModeState(nextEnabled);
        applySimpleMode(nextEnabled);
      }
    };

    const handleModeEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      if (typeof detail?.enabled === "boolean") {
        setSimpleModeState(detail.enabled);
        applySimpleMode(detail.enabled);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(SIMPLE_MODE_EVENT, handleModeEvent);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(SIMPLE_MODE_EVENT, handleModeEvent);
    };
  }, []);

  const toggleSimpleMode = useCallback(() => {
    setSimpleMode(!simpleMode);
  }, [setSimpleMode, simpleMode]);

  return { simpleMode, setSimpleMode, toggleSimpleMode };
}
