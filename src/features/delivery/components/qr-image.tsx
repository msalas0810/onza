"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";

/** QR de un enlace público (menú del local o de una mesa). Solo codifica la dirección: nunca credenciales ni datos de pago. */
export function QrImage({ url, label, size = 220 }: { url: string; label: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let closed = false;
    QRCode.toDataURL(url, { width: size * 2, margin: 2, errorCorrectionLevel: "M" }).then(
      (data) => !closed && setSrc(data),
      () => !closed && setSrc(null),
    );
    return () => {
      closed = true;
    };
  }, [url, size]);
  if (!src) return <div className="sk" style={{ width: size, height: size }} aria-label="Preparando el QR" />;
  return <Image unoptimized src={src} width={size} height={size} alt={label} className="qr-img" />;
}
