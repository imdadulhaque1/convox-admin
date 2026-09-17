import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

interface ResetBody {
  email?: string;
  code?: string;
  newPassword?: string;
}

/** POST /api/auth/reset-password { email, code, newPassword } → POST
 *  /admin/auth/reset-password. Public. On success the backend revokes every existing
 *  admin session, so the caller must log back in. */
export async function POST(request: Request) {
  let body: ResetBody;
  try {
    body = (await request.json()) as ResetBody;
  } catch {
    return NextResponse.json({ success: false, message: "Malformed request." }, { status: 400 });
  }

  if (!body.email?.trim() || !body.code?.trim() || !body.newPassword) {
    return NextResponse.json(
      { success: false, message: "Email, code, and a new password are required." },
      { status: 400 },
    );
  }

  const result = await backendFetch("/admin/auth/reset-password", {
    method: "POST",
    body: { email: body.email.trim(), code: body.code.trim(), newPassword: body.newPassword },
  });

  return NextResponse.json(
    result.body ?? { success: false, statusCode: result.status, message: "Unexpected response from backend.", data: null },
    { status: result.status },
  );
}
