"use client";

import type { AdminWhoAmI } from "./types";

/** Reads the non-httpOnly cx_admin_who cookie client-side — display only, never used for
 *  authorization (see lib/session.ts's doc comment on the same cookie). */
export function readWhoAmIClient(): AdminWhoAmI | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )cx_admin_who=([^;]*)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1])) as AdminWhoAmI;
  } catch {
    return null;
  }
}
