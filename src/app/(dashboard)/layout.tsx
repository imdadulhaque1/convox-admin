import { DashboardShell } from "@/components/DashboardShell";
import { readWhoAmI } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const who = await readWhoAmI();
  return <DashboardShell who={who}>{children}</DashboardShell>;
}
