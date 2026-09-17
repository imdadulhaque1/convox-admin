import { proxyToBackend } from "@/lib/backend";

/** PATCH /api/admin/users/:id/username { username } → PATCH /admin/users/:id/username.
 *  Same format/uniqueness rules as the self-service profile edit — a taken username
 *  comes back as a 409 from the backend, surfaced as-is. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  return proxyToBackend(`/admin/users/${id}/username`, { method: "PATCH", body });
}
