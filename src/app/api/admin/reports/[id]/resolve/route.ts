import { proxyToBackend } from "@/lib/backend";
import type { ReportStatus } from "@/lib/types";

/** PATCH /api/admin/reports/:id/resolve { status } → PATCH /admin/reports/:id/resolve */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as { status: Extract<ReportStatus, "REVIEWED" | "DISMISSED"> };
  return proxyToBackend(`/admin/reports/${id}/resolve`, { method: "PATCH", body });
}
