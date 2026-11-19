"use client";

import { useEffect, useRef, useState } from "react";
import { ParticleWave } from "@/components/backgrounds/particle-wave";
import styles from "./access.module.css";

/** No video source is attached until the mobile, motion and visibility checks pass. */
export function AccessBackground() {
  const video = useRef<HTMLVideoElement>(null);
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const small = matchMedia("(max-width: 600px)");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const element = video.current;
    let generation = 0;
    const sync = () => {
      const current = ++generation;
      setDesktop(!small.matches);
      const el = video.current;
      if (!el) return;
      el.style.opacity = "0";
      if (!small.matches || reduce.matches) {
        el.pause();
        if (el.hasAttribute("src")) {
          el.removeAttribute("src");
          el.load();
        }
        return;
      }
      el.defaultMuted = true;
      el.muted = true;
      el.defaultPlaybackRate = 0.75;
      el.playbackRate = 0.75;
      if (document.hidden) {
        el.pause();
        return;
      }
      el.defaultMuted = true;
      el.muted = true;
      el.playbackRate = 0.75;
      if (!el.hasAttribute("src")) el.src = "/access/access-mobile.mp4";
      void el
        .play()
        .then(() => {
          if (generation === current) el.style.opacity = "0.88";
        })
        .catch(() => {
          /* The poster stays visible when autoplay is denied. */
        });
    };
    sync();
    small.addEventListener("change", sync);
    reduce.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      generation++;
      small.removeEventListener("change", sync);
      reduce.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      element?.pause();
    };
  }, []);
  return (
    <>
      {desktop && (
        <div className={styles.desktopWave} aria-hidden="true">
          <ParticleWave className={styles.canvas} />
        </div>
      )}
      <div className={styles.film} aria-hidden="true">
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
        <video
          ref={video}
          muted
          loop
          playsInline
          autoPlay
          preload="none"
          poster="/access/access-poster.jpg"
        />
      </div>
      <div className={styles.vignette} aria-hidden="true" />
      <div className={styles.shade} aria-hidden="true" />
    </>
  );
}
