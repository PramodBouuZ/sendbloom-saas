import { createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/lib/protected";
import { AppShell } from "@/components/app-shell";
import { ComingSoon } from "@/components/coming-soon";
import { Users } from "lucide-react";

export const Route = createFileRoute("/contacts")({
  head: () => ({ meta: [{ title: "Contacts — BANTConfirm" }] }),
  component: () => (
    <Protected>
      <AppShell>
        <ComingSoon
          icon={Users}
          title="Contacts"
          description="CSV upload, dedupe, tags, and search arrive in Phase 2 (next iteration)."
        />
      </AppShell>
    </Protected>
  ),
});
