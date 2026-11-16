"use client";
import { useState } from "react";
import type { Ref } from "react";

/**
 * Tracks whether an image failed to load. An error can happen before React hydrates (server-rendered <img>), so besides
 * onError the ref callback checks the already-finished element. A new src starts fresh.
 * Returns the usable src (null once it failed) and the props to spread on the <img>/<Image>.
 */
export function useImageFailure(src: string | null) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const ref: Ref<HTMLImageElement> = (img) => {
    if (img && src && img.complete && img.naturalWidth === 0) setFailedSrc(src);
  };
  return {
    usable: src && failedSrc !== src ? src : null,
    props: { ref, onError: () => setFailedSrc(src) },
  };
}
