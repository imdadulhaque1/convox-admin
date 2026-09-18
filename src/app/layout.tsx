import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

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
      <body className="font-sans antialiased">
        <ServiceWorkerRegistration />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
