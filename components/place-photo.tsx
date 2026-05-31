"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";

type PlacePhotoProps = {
  alt?: string | null;
  attribution?: string | null;
  className?: string;
  fallbackLabel?: string | null;
  imgClassName?: string;
  src?: string | null;
};

export function PlacePhoto({
  alt,
  attribution,
  className = "h-20 w-20 rounded-2xl",
  fallbackLabel = "Photo pending",
  imgClassName = "h-full w-full object-cover",
  src
}: PlacePhotoProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src && !failed);

  return (
    <figure
      className={`relative overflow-hidden bg-gradient-to-br from-slate-100 via-blue-50 to-emerald-50 ${className}`}
      data-has-photo={showImage ? "true" : "false"}
      data-testid="place-photo"
    >
      {showImage ? (
        <img
          alt={alt || "Place photo"}
          className={imgClassName}
          loading="lazy"
          onError={() => setFailed(true)}
          src={src || undefined}
        />
      ) : (
        <div className="grid h-full w-full place-items-center p-2 text-center text-blue-800">
          <div className="grid gap-1">
            <span className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-white/75 shadow-sm">
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
            </span>
            {fallbackLabel ? (
              <span className="line-clamp-2 text-[0.65rem] font-black uppercase tracking-[0.12em] text-blue-900/70">
                {fallbackLabel}
              </span>
            ) : null}
          </div>
        </div>
      )}
      {showImage && attribution ? (
        <figcaption className="absolute bottom-0 left-0 right-0 truncate bg-black/45 px-2 py-1 text-[0.62rem] font-semibold text-white">
          Photo: {attribution}
        </figcaption>
      ) : null}
    </figure>
  );
}
