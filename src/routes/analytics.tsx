import { createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/lib/protected";
import { AppShell } from "@/components/app-shell";
import { ComingSoon } from "@/components/coming-soon";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics — BANTConfirm" }] }),
  component: () => (
    <Protected>
      <AppShell>
        <ComingSoon
          icon={BarChart3}
          title="Analytics"
          description="Open rate, click rate, bounce rate, daily charts. Phase 5."
        />
      </AppShell>
    </Protected>
  ),
});
