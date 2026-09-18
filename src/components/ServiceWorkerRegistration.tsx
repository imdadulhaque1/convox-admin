"use client";

import { useEffect } from "react";

/** Registers public/sw.js once the page has loaded. A render-nothing component rather
 *  than inline layout.tsx code so the "use client" boundary stays as small as possible —
 *  the rest of the root layout is a Server Component. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Best-effort — a failed registration just means no install prompt, not a broken app.
    });
  }, []);

  return null;
}
