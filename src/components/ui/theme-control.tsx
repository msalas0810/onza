"use client";
import { useSyncExternalStore } from "react";
function subscribe(callback: () => void) {
  window.addEventListener("onza-theme-change", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("onza-theme-change", callback);
    window.removeEventListener("storage", callback);
  };
}
function snapshot() {
  try {
    return localStorage.getItem("onza-theme") ?? "system";
  } catch {
    return "system";
  }
}
export function ThemeControl() {
  const theme = useSyncExternalStore(subscribe, snapshot, () => "system");
  return (
    <label className="theme-control">
      <span className="sr-only">Tema</span>
      <select
        aria-label="Tema"
        value={theme}
        onChange={(event) => {
          const value = event.target.value;
          try {
            localStorage.setItem("onza-theme", value);
          } catch {
            /* Apply the preference for this page even if storage is blocked. */
          }
          if (value === "system") delete document.documentElement.dataset.theme;
          else document.documentElement.dataset.theme = value;
          window.dispatchEvent(new Event("onza-theme-change"));
        }}
      >
        <option value="system">Sistema</option>
        <option value="light">Claro</option>
        <option value="dark">Oscuro</option>
      </select>
    </label>
  );
}
