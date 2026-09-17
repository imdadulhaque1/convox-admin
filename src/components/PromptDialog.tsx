"use client";

import { useEffect, useId, useState } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Like ConfirmDialog, but for the handful of admin actions that need one piece of input
 * first — a day count, a new password, a new username. Keeps the same confirm/cancel
 * shell so these don't need a one-off modal each; validity gates the confirm button
 * rather than failing after submit where that's cheap to check client-side (matches the
 * backend DTO's own constraints — see each call site).
 */
export function PromptDialog({
  open,
  title,
  description,
  label,
  type = "text",
  defaultValue = "",
  placeholder,
  confirmLabel = "Confirm",
  loading = false,
  validate,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  type?: "text" | "password" | "number";
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  loading?: boolean;
  /** Returns an error message to block submission, or null when the value is fine. */
  validate?: (value: string) => string | null;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const inputId = useId();
  const [value, setValue] = useState(defaultValue);

  // Reset to the caller's default each time the dialog is (re)opened for a new target,
  // rather than carrying over whatever was typed for the previous one.
  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  if (!open) return null;

  const validationError = validate?.(value) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!validationError) onConfirm(value);
        }}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <AlertTriangle size={18} />
        </div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1.5 text-sm text-slate-500">{description}</p>}

        <label htmlFor={inputId} className="mb-1.5 mt-4 block text-sm font-medium text-slate-700">
          {label}
        </label>
        <input
          id={inputId}
          type={type}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="focus-ring w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink placeholder:text-slate-400"
        />
        {validationError && value !== "" && (
          <p className="mt-1.5 text-xs text-red-600">{validationError}</p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="focus-ring rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || value === "" || Boolean(validationError)}
            className="focus-ring rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
