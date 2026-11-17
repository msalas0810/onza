"use client";

import { useEffect, useRef } from "react";
import tokens from "../../../design/tokens.json";

// Particle Wave by Hossain Jahed, original Component.tsx supplied by Manu.
// https://21st.dev/@jahed/components/particle-wave
// Original wave equations, point shape, camera and desktop grid are preserved.
const particleVertex = `
  attribute float scale;
  uniform float uTime;
  void main() {
    vec3 p = position;
    float s = scale;
    p.y += (sin(p.x + uTime) * 0.5) + (cos(p.y + uTime) * 0.1) * 2.0;
    p.x += (sin(p.y + uTime) * 0.5);
    s += (sin(p.x + uTime) * 0.5) + (cos(p.y + uTime) * 0.1) * 2.0;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = s * 15.0 * (1.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const particleFragment = `
  uniform vec3 uColor;
  uniform float uIntensity;
  void main() {
    gl_FragColor = vec4(uColor, 0.5 * uIntensity);
  }
`;

type ParticleWaveProps = {
  className?: string;
  speed?: number;
  intensity?: number;
  color?: string;
};

export function ParticleWave({
  className,
  speed = 0.6,
  intensity = 1.5,
  color = tokens.access.accent,
}: ParticleWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const target = canvasRef.current;
    if (!target) return;
    const canvas = target;

    let disposed = false;
    let teardown = () => {};

    // Three.js is only downloaded on the screen that uses this background.
    void import("three")
      .then((THREE) => {
        if (disposed) return;
        let renderer: InstanceType<typeof THREE.WebGLRenderer>;
        try {
          renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
        } catch {
          // WebGL is decorative: the server-rendered access stays usable on black.
          canvas.hidden = true;
          return;
        }
        teardown = () => {
          renderer.dispose();
          renderer.forceContextLoss();
        };

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, 1, 0.01, 1000);
        camera.position.set(0, 6, 5);
        camera.lookAt(scene.position);
        renderer.setClearColor(tokens.access.bg);

        const mobile = window.matchMedia("(max-width: 767px)");
        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        );
        const geometry = new THREE.BufferGeometry();
        function setGrid() {
          const amount = mobile.matches ? 128 : 200;
          const gap = 60 / amount; // Same 60 × 60 world footprint as the original.
          const positions = new Float32Array(amount * amount * 3);
          const scales = new Float32Array(amount * amount).fill(1);
          let i = 0;
          for (let ix = 0; ix < amount; ix++) {
            for (let iy = 0; iy < amount; iy++) {
              positions[i] = ix * gap - (amount * gap) / 2;
              positions[i + 1] = 0;
              positions[i + 2] = iy * gap - (amount * gap) / 2;
              i += 3;
            }
          }
          // Release the old GPU buffers when changing between mobile and desktop.
          geometry.dispose();
          geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(positions, 3),
          );
          geometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));
        }
        setGrid();
        const rgb = new THREE.Color(color).convertLinearToSRGB();
        const material = new THREE.ShaderMaterial({
          transparent: true,
          vertexShader: particleVertex,
          fragmentShader: particleFragment,
          uniforms: {
            uTime: { value: 0 },
            uColor: { value: new THREE.Vector3(rgb.r, rgb.g, rgb.b) },
            uIntensity: { value: Math.max(0, Math.min(intensity, 2)) },
          },
        });
        const particles = new THREE.Points(geometry, material);
        // The vertex shader displaces the flat grid beyond its original bounds.
        particles.frustumCulled = false;
        scene.add(particles);

        let frame: number | null = null;
        let previous: number | null = null;
        let contextLost = false;
        function stop() {
          if (frame !== null) cancelAnimationFrame(frame);
          frame = null;
          previous = null;
        }
        function render() {
          if (disposed || contextLost || document.hidden) return;
          renderer.render(scene, camera);
        }
        function animate(now: number) {
          frame = null;
          if (
            disposed ||
            contextLost ||
            document.hidden ||
            reducedMotion.matches
          )
            return;
          // Original: 0.05/frame at 60 Hz = 3 units/s. Default: 60% of that.
          const delta =
            previous === null ? 0 : Math.min((now - previous) / 1000, 0.1);
          previous = now;
          material.uniforms.uTime.value += delta * 3 * Math.max(0, speed);
          render();
          frame = requestAnimationFrame(animate);
        }
        function syncMotion() {
          stop();
          if (disposed || contextLost || document.hidden) return;
          render();
          if (!reducedMotion.matches && speed > 0)
            frame = requestAnimationFrame(animate);
        }
        function resize() {
          const { width, height } = canvas.getBoundingClientRect();
          if (!width || !height || contextLost || disposed) return;
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setPixelRatio(
            Math.min(window.devicePixelRatio, mobile.matches ? 1 : 1.5),
          );
          renderer.setSize(width, height, false);
          render();
        }
        function changeDensity() {
          setGrid();
          resize();
        }
        function loseContext(event: Event) {
          event.preventDefault();
          contextLost = true;
          stop();
          canvas.hidden = true;
        }
        function restoreContext() {
          contextLost = false;
          canvas.hidden = false;
          resize();
          syncMotion();
        }
        const observer = new ResizeObserver(resize);
        teardown = () => {
          stop();
          observer.disconnect();
          document.removeEventListener("visibilitychange", syncMotion);
          reducedMotion.removeEventListener("change", syncMotion);
          mobile.removeEventListener("change", changeDensity);
          canvas.removeEventListener("webglcontextlost", loseContext);
          canvas.removeEventListener("webglcontextrestored", restoreContext);
          scene.remove(particles);
          geometry.dispose();
          material.dispose();
          renderer.dispose();
          renderer.forceContextLoss();
        };
        observer.observe(canvas);
        document.addEventListener("visibilitychange", syncMotion);
        reducedMotion.addEventListener("change", syncMotion);
        mobile.addEventListener("change", changeDensity);
        canvas.addEventListener("webglcontextlost", loseContext);
        canvas.addEventListener("webglcontextrestored", restoreContext);
        resize();
        syncMotion();
      })
      .catch(() => {
        teardown();
        if (!disposed) canvas.hidden = true;
      });

    return () => {
      disposed = true;
      teardown();
    };
  }, [speed, intensity, color]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
