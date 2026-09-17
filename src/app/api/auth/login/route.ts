import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import { setSessionCookies } from "@/lib/session";
import type { AdminAccountSummary, AdminWhoAmI } from "@/lib/types";

interface LoginBody {
  username: string;
  password: string;
}

interface AdminAuthData {
  admin: AdminAccountSummary;
  tokens: { accessToken: string; refreshToken: string };
}

/**
 * POST /api/auth/login — proxies POST /admin/auth/login, the separate admin-panel login
 * surface (its own Admin table, its own signing secret — entirely independent of the
 * ConnectX user /auth/login the mobile app uses). No probe step needed: this endpoint
 * only ever succeeds for a row in the Admin table, so a successful login already implies
 * panel access. Whether that access reaches anything (Users/Reports/Admins are all
 * SUPER_ADMIN-only today) is re-checked by the backend on every subsequent call.
 */
export async function POST(request: Request) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json(
      { success: false, message: "Malformed request." },
      { status: 400 },
    );
  }

  if (!body.username?.trim() || !body.password) {
    return NextResponse.json(
      { success: false, message: "Username and password are required." },
      { status: 400 },
    );
  }

  const loginResult = await backendFetch<AdminAuthData>("/admin/auth/login", {
    method: "POST",
    body: { username: body.username.trim(), password: body.password },
  });

  if (loginResult.status === 502) {
    return NextResponse.json(
      { success: false, message: "Could not reach the ConvoX backend. Is it running?" },
      { status: 502 },
    );
  }

  if (!loginResult.body?.success || !loginResult.body.data) {
    return NextResponse.json(
      { success: false, message: loginResult.body?.message ?? "Invalid username or password." },
      { status: loginResult.status >= 400 ? loginResult.status : 401 },
    );
  }

  const { admin, tokens } = loginResult.body.data;
  const who: AdminWhoAmI = { id: admin.id, username: admin.username, email: admin.email, role: admin.role };

  const response = NextResponse.json({ success: true, message: "Signed in", data: { who } });
  setSessionCookies(response, tokens, who);
  return response;
}
