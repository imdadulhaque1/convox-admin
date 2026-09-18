"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldAlert } from "lucide-react";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

/** POST /admin/auth/reset-password, via /api/auth/reset-password. Success revokes every
 *  existing session for the account server-side, so this always ends at /login rather
 *  than trying to sign the admin back in automatically. */
function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message ?? "Something went wrong.");
        return;
      }
      router.push("/login");
    } catch {
      setError("Could not reach the admin server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no need for next/image here */}
          <img src="/convox-logo.png" alt="ConvoX" className="mb-4 h-12 w-12 rounded-2xl shadow-card" />
          <h1 className="text-xl font-semibold text-ink">Enter your reset code</h1>
          <p className="mt-1 text-sm text-slate-500">Check your email for the 4-digit code</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
        >
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <ShieldAlert size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="focus-ring mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink placeholder:text-slate-400"
          />

          <label className="mb-1.5 block text-sm font-medium text-slate-700">Reset code</label>
          <input
            type="text"
            required
            autoFocus
            inputMode="numeric"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="1234"
            className="focus-ring mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-[0.3em] text-ink placeholder:text-slate-400 placeholder:tracking-normal"
          />

          <label className="mb-1.5 block text-sm font-medium text-slate-700">New password</label>
          <input
            type="password"
            required
            minLength={4}
            maxLength={72}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            className="focus-ring mb-6 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink placeholder:text-slate-400"
          />

          <button
            type="submit"
            disabled={loading}
            className="focus-ring flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Resetting…" : "Reset password"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          <Link href="/login" className="focus-ring rounded font-medium text-brand-600 hover:text-brand-700">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
