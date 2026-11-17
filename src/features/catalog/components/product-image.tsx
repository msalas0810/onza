"use client";
import Image from "next/image";
import { PhotoFallback } from "@/components/ui/primitives";
import { useImageFailure } from "@/lib/use-image-failure";

/**
 * Fixed-size, rounded drink image. Without an image, or if it fails to load, the placeholder takes exactly the same
 * space, so the list never shifts or shows a broken box. `thumb` is the 72 px square of the menu rows; `detail` fills the
 * 4:3 frame of the product page.
 */
export function ProductImage({
  name,
  src,
  size = "thumb",
  eager = false,
}: {
  name: string;
  src: string | null;
  size?: "thumb" | "detail";
  eager?: boolean;
}) {
  const image = useImageFailure(src);
  if (!image.usable)
    return <PhotoFallback name={name} large={size === "detail"} />;
  return (
    <span className={`product-image ${size}`}>
      <Image
        unoptimized
        fill
        sizes={size === "thumb" ? "72px" : "(min-width: 480px) 480px, 100vw"}
        src={image.usable}
        alt={size === "detail" ? name : ""}
        loading={eager ? "eager" : undefined}
        {...image.props}
      />
    </span>
  );
}
