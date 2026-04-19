import { createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/lib/protected";
import { AppShell } from "@/components/app-shell";
import { ComingSoon } from "@/components/coming-soon";
import { Send } from "lucide-react";

export const Route = createFileRoute("/campaigns")({
  head: () => ({ meta: [{ title: "Campaigns — BANTConfirm" }] }),
  component: () => (
    <Protected>
      <AppShell>
        <ComingSoon
          icon={Send}
          title="Campaigns"
          description="Campaign builder with drag-and-drop editor, scheduling, and A/B testing arrives in Phase 3."
        />
      </AppShell>
    </Protected>
  ),
});
