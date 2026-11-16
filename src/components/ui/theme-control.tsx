"use client";
import { useSyncExternalStore } from "react";
import { Monitor, Sun, Moon } from "lucide-react";
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
const choices = [
  { value: "system", label: "Sistema", Icon: Monitor },
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon },
] as const;
export function ThemeControl() {
  const theme = useSyncExternalStore(subscribe, snapshot, () => "system");
  return (
    <div className="theme-choices" role="group" aria-label="Apariencia">
      {choices.map(({ value, label, Icon }) => (
        <button
          key={value}
          className="button secondary"
          aria-pressed={theme === value}
          onClick={() => {
            try {
              localStorage.setItem("onza-theme", value);
            } catch {
              /* The current page still applies the choice. */
            }
            if (value === "system")
              delete document.documentElement.dataset.theme;
            else document.documentElement.dataset.theme = value;
            window.dispatchEvent(new Event("onza-theme-change"));
          }}
        >
          <Icon size={20} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
