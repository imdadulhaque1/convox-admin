import { redirect } from "next/navigation";
import { readWhoAmI } from "@/lib/session";

export default async function RootPage() {
  const who = await readWhoAmI();
  redirect(who?.role === "SUPER_ADMIN" ? "/dashboard" : "/users");
}
