import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

/** POST /api/auth/forgot-password { email } → POST /admin/auth/forgot-password.
 *  Public — always resolves the same way regardless of whether the email exists, to
 *  avoid leaking which addresses have an admin account. */
export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ success: false, message: "Malformed request." }, { status: 400 });
  }

  if (!body.email?.trim()) {
    return NextResponse.json({ success: false, message: "Email is required." }, { status: 400 });
  }

  const result = await backendFetch("/admin/auth/forgot-password", {
    method: "POST",
    body: { email: body.email.trim() },
  });

  return NextResponse.json(
    result.body ?? { success: false, statusCode: result.status, message: "Unexpected response from backend.", data: null },
    { status: result.status },
  );
}
