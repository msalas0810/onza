"use client";
import { useSyncExternalStore } from "react";
import { SegmentedControl } from "./primitives";

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
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
] as const;
type Theme = (typeof choices)[number]["value"];

export function ThemeControl() {
  const theme = useSyncExternalStore(subscribe, snapshot, () => "system");
  return (
    <SegmentedControl<Theme>
      block
      label="Apariencia"
      value={(choices.some((c) => c.value === theme) ? theme : "system") as Theme}
      options={choices}
      onChange={(value) => {
        try {
          localStorage.setItem("onza-theme", value);
        } catch {
          /* La página actual igual aplica la elección. */
        }
        if (value === "system") delete document.documentElement.dataset.theme;
        else document.documentElement.dataset.theme = value;
        window.dispatchEvent(new Event("onza-theme-change"));
      }}
    />
  );
}
