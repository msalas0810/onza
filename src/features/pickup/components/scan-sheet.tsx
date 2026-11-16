"use client";
import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/primitives";
type Detector = {
  detect: (video: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};
type DetectorConstructor = new (options: { formats: string[] }) => Detector;
export default function ScanSheet({
  onClose,
  onResult,
}: {
  onClose: () => void;
  onResult: (value: string) => void;
}) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = video.current;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    async function start() {
      try {
        const Detector = (
          window as Window & { BarcodeDetector?: DetectorConstructor }
        ).BarcodeDetector;
        if (!Detector) {
          setError(
            "Este navegador no tiene escáner QR compatible. Cerrá y usá el código de 6 caracteres.",
          );
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
        }
        const detector = new Detector({ formats: ["qr_code"] });
        async function tick() {
          if (stopped || !video.current) return;
          try {
            const matches = await detector.detect(video.current);
            const value = matches.find((m) =>
              m.rawValue.startsWith("onza:"),
            )?.rawValue;
            if (value) {
              onResult(value);
              return;
            }
          } catch {
            /* A frame may not be ready yet. */
          }
          timer = setTimeout(() => void tick(), 250);
        }
        void tick();
      } catch {
        setError(
          "No pudimos acceder a la cámara. Cerrá y validá con el código manual.",
        );
      }
    }
    void start();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (element) element.srcObject = null;
    };
  }, [onResult]);
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="sheet">
          <Dialog.Title>Escanear retiro</Dialog.Title>
          <Dialog.Description>
            Apuntá al QR del pedido. La cámara requiere permiso y HTTPS o
            localhost.
          </Dialog.Description>
          <video ref={video} muted playsInline aria-label="Vista de cámara" />
          {error && <p role="alert">{error}</p>}
          <Dialog.Close asChild>
            <Button variant="secondary">Cerrar y usar código manual</Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
