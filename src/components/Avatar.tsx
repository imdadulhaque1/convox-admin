"use client";

import { useState } from "react";
import { resolveMediaUrl } from "@/lib/media";

const SIZE_CLASSES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-xl",
} as const;

export function Avatar({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: keyof typeof SIZE_CLASSES;
}) {
  const [errored, setErrored] = useState(false);
  const url = resolveMediaUrl(avatarUrl);
  const initial = name?.trim()?.slice(0, 1)?.toUpperCase() || "?";

  if (!url || errored) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700 ${SIZE_CLASSES[size]}`}
      >
        {initial}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary/HTTP backend host, plain img keeps this simple
    <img
      src={url}
      alt={name}
      onError={() => setErrored(true)}
      className={`shrink-0 rounded-full object-cover ${SIZE_CLASSES[size]}`}
    />
  );
}
