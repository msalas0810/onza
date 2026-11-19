"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./access.module.css";

function accessDevice() {
  const { userAgent, platform, maxTouchPoints } = navigator;
  // iPadOS Safari can identify itself as a Mac when requesting desktop sites.
  if (
    /iPad/i.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  )
    return "tablet";
  return /iPhone|iPod|Android.*Mobile/i.test(userAgent) ? "phone" : "desktop";
}

export function AccessScreen({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  const screen = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const root = screen.current;
    const element = video.current;
    if (!root || !element) return;

    const device = accessDevice();
    root.dataset.accessDevice = device;
    const source =
      device === "phone"
        ? "/access/access-mobile.mp4"
        : "/access/access-horizontal.mp4";
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");

    element.defaultMuted = true;
    element.muted = true;
    element.defaultPlaybackRate = 0.75;

    const showVideo = () => {
      element.dataset.playing = "true";
    };
    const showPoster = () => {
      delete element.dataset.playing;
    };
    const sync = () => {
      if (reduce.matches || document.hidden) {
        element.pause();
        showPoster();
        return;
      }
      if (!element.hasAttribute("src")) element.src = source;
      element.playbackRate = 0.75;
      void element.play().catch(showPoster);
    };

    element.addEventListener("playing", showVideo);
    element.addEventListener("error", showPoster);
    reduce.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();

    return () => {
      element.removeEventListener("playing", showVideo);
      element.removeEventListener("error", showPoster);
      reduce.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      element.pause();
    };
  }, []);

  return (
    <div
      ref={screen}
      className={`access-screen ${styles.screen} ${compact ? styles.compact : styles.videoAccess}`}
    >
      <div className={styles.backdrop} aria-hidden="true">
        <div className={styles.film}>
          <svg width="0" height="0" className={styles.filter}>
            <filter id="access-duotone" colorInterpolationFilters="sRGB">
              <feColorMatrix
                type="matrix"
                values=".22 .55 .23 0 0 .22 .55 .23 0 0 .22 .55 .23 0 0 0 0 0 1 0"
              />
              <feComponentTransfer>
                <feFuncR type="table" tableValues="0 .88" />
                <feFuncG type="table" tableValues="0 .49" />
                <feFuncB type="table" tableValues="0 .53" />
              </feComponentTransfer>
            </filter>
          </svg>
          <video ref={video} muted loop playsInline preload="none" />
        </div>
        <div className={styles.shade} />
      </div>
      {children}
    </div>
  );
}
