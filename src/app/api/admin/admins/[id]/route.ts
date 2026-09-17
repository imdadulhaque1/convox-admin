import { proxyToBackend } from "@/lib/backend";

/** DELETE /api/admin/admins/:id → DELETE /admin/admins/:id. The backend refuses to
 *  delete your own account or the last remaining SUPER_ADMIN — surfaced as a normal
 *  error message, not special-cased here. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyToBackend(`/admin/admins/${id}`, { method: "DELETE" });
}
