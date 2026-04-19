import { createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/lib/protected";
import { AppShell } from "@/components/app-shell";
import { ComingSoon } from "@/components/coming-soon";
import { ListChecks } from "lucide-react";

export const Route = createFileRoute("/lists")({
  head: () => ({ meta: [{ title: "Lists — BANTConfirm" }] }),
  component: () => (
    <Protected>
      <AppShell>
        <ComingSoon icon={ListChecks} title="Contact Lists" description="Group contacts into reusable lists. Phase 2." />
      </AppShell>
    </Protected>
  ),
});
