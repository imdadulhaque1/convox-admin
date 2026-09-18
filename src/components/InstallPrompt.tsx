"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * A custom "Install app" banner — deliberately not relying on the browser's own install
 * UI, which only offers itself once per page load under its own engagement heuristics
 * (and Chrome hides its mini-infobar by default once you call preventDefault() on the
 * event, which capturing it here does). This renders on every fresh page load instead
 * (state resets on remount, so "every visit" falls out naturally — no dismissed-forever
 * flag is persisted on purpose), and shows nothing once the app is already installed.
 *
 * Android/desktop Chrome & Edge: captures `beforeinstallprompt` and drives the real
 * native prompt from our own button. iOS Safari has no such event — there's no
 * programmatic install API there at all — so it gets manual "Add to Home Screen"
 * instructions instead. Everything else (Firefox desktop, etc.) has no install path
 * either way, so it renders nothing rather than a dead-end button.
 */
export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const ua = window.navigator.userAgent;
    const iOSDevice = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
    if (iOSDevice) setIsIOS(true);

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  async function handleInstall() {
    if (!installEvent) return;
    setInstalling(true);
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
    } finally {
      setInstallEvent(null);
      setInstalling(false);
    }
  }

  if (dismissed || (!installEvent && !isIOS)) return null;

  return (
    <div className="flex items-center gap-3 border-b border-brand-100 bg-brand-50 px-4 py-2.5 text-sm sm:px-6 lg:px-8">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
        <Download size={14} />
      </div>
      <p className={`min-w-0 flex-1 text-brand-700 ${isIOS ? "" : "truncate"}`}>
        {isIOS ? (
          <>
            Install ConvoX Admin: tap <Share size={13} className="mb-0.5 inline" /> then{" "}
            <span className="font-medium">Add to Home Screen</span>.
          </>
        ) : (
          <>
            Install ConvoX Admin for quick, full-screen access.
          </>
        )}
      </p>
      {!isIOS && (
        <button
          onClick={handleInstall}
          disabled={installing}
          className="focus-ring shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {installing ? "Installing…" : "Install"}
        </button>
      )}
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="focus-ring shrink-0 rounded-md p-1 text-brand-400 transition hover:bg-brand-100 hover:text-brand-700"
      >
        <X size={15} />
      </button>
    </div>
  );
}
