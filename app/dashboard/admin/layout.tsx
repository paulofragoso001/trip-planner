import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/server/admin-auth";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const auth = await requireAdmin();

  if (auth.reason === "unauthorized") {
    redirect("/login");
  }

  if (!auth.isAdmin) {
    redirect("/dashboard");
  }

  return children;
}
