import { proxyToBackend } from "@/lib/backend";

/** GET /api/admin/users/:id → GET /admin/users/:id */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyToBackend(`/admin/users/${id}`, { method: "GET" });
}

/** DELETE /api/admin/users/:id → DELETE /admin/users/:id — permanent, distinct from the
 *  timed suspension at PATCH .../deactivate. Still reversible via .../reactivate. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxyToBackend(`/admin/users/${id}`, { method: "DELETE" });
}
