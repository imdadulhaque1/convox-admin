import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { InstallPrompt } from "@/components/InstallPrompt";

export const metadata: Metadata = {
  title: "ConvoX Admin",
  description: "Super-admin console for ConvoX",
  // manifest.ts is picked up automatically by the App Router convention — no explicit
  // `manifest:` entry needed here. apple-icon.png / icon.png likewise auto-link.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ConvoX Admin",
  },
};

export const viewport: Viewport = {
  themeColor: "#4F46E5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Browser extensions (ColorZilla, Grammarly, etc.) inject attributes like
          cz-shortcut-listen onto <body> before React hydrates, which React then reports
          as a hydration mismatch — it's not an app bug, so this attribute is deliberately
          exempted rather than "fixed". suppressHydrationWarning is shallow (this element
          only), so a real mismatch elsewhere in the tree still gets a warning. */}
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ServiceWorkerRegistration />
        <InstallPrompt />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
