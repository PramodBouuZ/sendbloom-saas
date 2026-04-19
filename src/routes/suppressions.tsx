import { createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/lib/protected";
import { AppShell } from "@/components/app-shell";
import { ComingSoon } from "@/components/coming-soon";
import { Ban } from "lucide-react";

export const Route = createFileRoute("/suppressions")({
  head: () => ({ meta: [{ title: "Suppressions — BANTConfirm" }] }),
  component: () => (
    <Protected>
      <AppShell>
        <ComingSoon icon={Ban} title="Suppression List" description="Bounced, complained, and unsubscribed addresses. Phase 2." />
      </AppShell>
    </Protected>
  ),
});
