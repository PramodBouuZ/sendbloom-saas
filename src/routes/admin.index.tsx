import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Protected } from "@/lib/protected";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Mail, Send } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin — BANTConfirm" }] }),
  component: () => (
    <Protected requiredRoles={["super_admin"]}>
      <AppShell>
        <AdminOverview />
      </AppShell>
    </Protected>
  ),
});

function AdminOverview() {
  const [stats, setStats] = useState({ tenants: 0, users: 0, campaigns: 0, sent: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [t, u, c, s] = await Promise.all([
        supabase.from("tenants").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("campaigns").select("id", { count: "exact", head: true }),
        supabase.from("email_logs").select("id", { count: "exact", head: true }).in("status", ["sent", "delivered", "opened", "clicked"]),
      ]);
      setStats({
        tenants: t.count ?? 0,
        users: u.count ?? 0,
        campaigns: c.count ?? 0,
        sent: s.count ?? 0,
      });
      setLoading(false);
    };
    load();
  }, []);

  const cards = [
    { label: "Tenants", value: stats.tenants, icon: Building2 },
    { label: "Total Users", value: stats.users, icon: Users },
    { label: "Campaigns", value: stats.campaigns, icon: Send },
    { label: "Emails Sent", value: stats.sent.toLocaleString(), icon: Mail },
  ];

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Platform Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Global view across all tenants.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                  <p className="mt-2 font-display text-3xl font-bold">{loading ? "—" : c.value}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <c.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Manage</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Link to="/admin/tenants" className="rounded-lg border p-4 hover:border-primary hover:bg-secondary/40 transition">
            <Building2 className="h-5 w-5 text-primary mb-2" />
            <p className="font-semibold">Tenants</p>
            <p className="text-sm text-muted-foreground">View workspaces, plans, and limits.</p>
          </Link>
          <Link to="/admin/activity" className="rounded-lg border p-4 hover:border-primary hover:bg-secondary/40 transition">
            <Mail className="h-5 w-5 text-primary mb-2" />
            <p className="font-semibold">Global Activity</p>
            <p className="text-sm text-muted-foreground">Email sending across the platform.</p>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
