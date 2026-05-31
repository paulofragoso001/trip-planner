"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";

type PlacePhotoProps = {
  alt?: string | null;
  attribution?: string | null;
  className?: string;
  imgClassName?: string;
  src?: string | null;
};

export function PlacePhoto({
  alt,
  attribution,
  className = "h-20 w-20 rounded-2xl",
  imgClassName = "h-full w-full object-cover",
  src
}: PlacePhotoProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src && !failed);

  return (
    <figure className={`relative overflow-hidden bg-gradient-to-br from-slate-100 to-blue-50 ${className}`}>
      {showImage ? (
        <img
          alt={alt || "Place photo"}
          className={imgClassName}
          loading="lazy"
          onError={() => setFailed(true)}
          src={src || undefined}
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-blue-700">
          <ImageIcon className="h-6 w-6" aria-hidden="true" />
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
