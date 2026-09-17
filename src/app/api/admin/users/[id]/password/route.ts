import { proxyToBackend } from "@/lib/backend";

/** PATCH /api/admin/users/:id/password { password } → PATCH /admin/users/:id/password.
 *  Sets a new password directly (no old-password check) and revokes every existing
 *  session for the account, forcing re-login. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  return proxyToBackend(`/admin/users/${id}/password`, { method: "PATCH", body });
}
