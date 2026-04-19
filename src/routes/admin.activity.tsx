import { createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/lib/protected";
import { AppShell } from "@/components/app-shell";
import { ComingSoon } from "@/components/coming-soon";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/admin/activity")({
  head: () => ({ meta: [{ title: "Global Activity — Admin" }] }),
  component: () => (
    <Protected requiredRoles={["super_admin"]}>
      <AppShell>
        <ComingSoon icon={BarChart3} title="Global Activity" description="Cross-tenant email activity charts arrive in Phase 5." />
      </AppShell>
    </Protected>
  ),
});
