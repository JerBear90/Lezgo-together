"use client";

import { useState, type ReactNode } from "react";
import type { BuildStep } from "@/lib/types";

export function StepImage({
  src,
  region,
  alt,
  children,
  fill = false,
}: {
  src: string;
  region: BuildStep["region"];
  alt: string;
  children?: ReactNode;
  fill?: boolean;
}) {
  const [ratio, setRatio] = useState(2.2);
  if (!region) {
    return (
      <div data-testid="step-image" className="flex h-full items-center justify-center bg-[#efe6d6]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
        {children}
      </div>
    );
  }
  return (
    <div
      data-testid="step-image"
      className={fill ? "relative h-full w-full overflow-hidden bg-[#efe6d6]" : "relative w-full overflow-hidden bg-[#efe6d6]"}
      style={fill ? undefined : { aspectRatio: ratio }}
    >
      {/* Local booklet photos are data URLs positioned by the step region. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="absolute max-w-none"
        onLoad={(event) => {
          const image = event.currentTarget;
          if (image.naturalWidth > 0 && image.naturalHeight > 0) {
            setRatio((region.width * image.naturalWidth) / (region.height * image.naturalHeight));
          }
        }}
        style={{
          width: `${100 / region.width}%`,
          height: `${100 / region.height}%`,
          left: `${(-region.x / region.width) * 100}%`,
          top: `${(-region.y / region.height) * 100}%`,
        }}
      />
      {children}
    </div>
  );
}
