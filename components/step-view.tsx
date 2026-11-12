"use client";

import type { BuildStep } from "@/lib/types";

export function StepImage({
  src,
  region,
  alt,
}: {
  src: string;
  region: BuildStep["region"];
  alt: string;
}) {
  if (!region) {
    return (
      <div data-testid="step-image" className="flex h-full items-center justify-center bg-[#efe6d6]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }
  return (
    <div data-testid="step-image" className="relative h-full overflow-hidden bg-[#efe6d6]">
      {/* Local booklet photos are data URLs positioned by the step region. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="absolute max-w-none"
        style={{
          width: `${100 / region.width}%`,
          height: `${100 / region.height}%`,
          left: `${(-region.x / region.width) * 100}%`,
          top: `${(-region.y / region.height) * 100}%`,
        }}
      />
    </div>
  );
}
