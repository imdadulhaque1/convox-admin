import { proxyToBackend } from "@/lib/backend";

/** PATCH /api/admin/users/:id/deactivate { days } → PATCH /admin/users/:id/deactivate.
 *  A *timed* suspension (1-365 days) — auto-lifts on the user's next login attempt once
 *  that date passes. For a permanent lockout use DELETE /api/admin/users/:id instead. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  return proxyToBackend(`/admin/users/${id}/deactivate`, { method: "PATCH", body });
}
