import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Protected } from "@/lib/protected";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Send, Users, Mail, TrendingUp, Plus } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — BANTConfirm" }] }),
  component: () => (
    <Protected>
      <AppShell>
        <Dashboard />
      </AppShell>
    </Protected>
  ),
});

interface Stats {
  campaigns: number;
  contacts: number;
  sent: number;
  openRate: number;
}

function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Stats>({ campaigns: 0, contacts: 0, sent: 0, openRate: 0 });
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<{ name: string; plan: string; monthly_send_limit: number; emails_sent_this_month: number } | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!profile?.tenant_id) return;
      const [{ count: campaignCount }, { count: contactCount }, { count: sentCount }, { count: openedCount }, { data: t }] = await Promise.all([
        supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("tenant_id", profile.tenant_id),
        supabase.from("contacts").select("id", { count: "exact", head: true }).eq("tenant_id", profile.tenant_id),
        supabase.from("email_logs").select("id", { count: "exact", head: true }).eq("tenant_id", profile.tenant_id).in("status", ["sent", "delivered", "opened", "clicked"]),
        supabase.from("email_logs").select("id", { count: "exact", head: true }).eq("tenant_id", profile.tenant_id).in("status", ["opened", "clicked"]),
        supabase.from("tenants").select("name, plan, monthly_send_limit, emails_sent_this_month").eq("id", profile.tenant_id).maybeSingle(),
      ]);
      const sent = sentCount ?? 0;
      const opened = openedCount ?? 0;
      setStats({
        campaigns: campaignCount ?? 0,
        contacts: contactCount ?? 0,
        sent,
        openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
      });
      setTenant(t);
      setLoading(false);
    };
    load();
  }, [profile?.tenant_id]);

  const usagePct = tenant ? Math.min(100, Math.round((tenant.emails_sent_this_month / tenant.monthly_send_limit) * 100)) : 0;

  const cards = [
    { label: "Campaigns", value: stats.campaigns, icon: Send, hint: "Total campaigns" },
    { label: "Contacts", value: stats.contacts.toLocaleString(), icon: Users, hint: "In your lists" },
    { label: "Emails Sent", value: stats.sent.toLocaleString(), icon: Mail, hint: "All time" },
    { label: "Open Rate", value: `${stats.openRate}%`, icon: TrendingUp, hint: "Across campaigns" },
  ];

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {profile?.display_name ?? "There"} 👋
          </h1>
          {tenant && (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{tenant.name}</span> · {tenant.plan} plan
            </p>
          )}
        </div>
        <Button asChild size="lg">
          <Link to="/campaigns"><Plus className="mr-2 h-4 w-4" /> New Campaign</Link>
        </Button>
      </div>

      {/* Usage bar */}
      {tenant && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Monthly send quota</span>
              <span className="text-sm text-muted-foreground">
                {tenant.emails_sent_this_month.toLocaleString()} / {tenant.monthly_send_limit.toLocaleString()}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full transition-all"
                style={{
                  width: `${usagePct}%`,
                  background: usagePct > 80 ? "var(--color-warning)" : "var(--gradient-brand)",
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="overflow-hidden">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                  <p className="mt-2 font-display text-3xl font-bold">{loading ? "—" : c.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <c.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle>Get started</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Link to="/contacts" className="rounded-lg border p-4 hover:border-primary hover:bg-secondary/40 transition">
            <Users className="h-5 w-5 text-primary mb-2" />
            <p className="font-semibold">Import contacts</p>
            <p className="text-sm text-muted-foreground">Upload a CSV to build your list.</p>
          </Link>
          <Link to="/campaigns" className="rounded-lg border p-4 hover:border-primary hover:bg-secondary/40 transition">
            <Send className="h-5 w-5 text-primary mb-2" />
            <p className="font-semibold">Create a campaign</p>
            <p className="text-sm text-muted-foreground">Design an email and schedule the send.</p>
          </Link>
          <Link to="/analytics" className="rounded-lg border p-4 hover:border-primary hover:bg-secondary/40 transition">
            <TrendingUp className="h-5 w-5 text-primary mb-2" />
            <p className="font-semibold">View analytics</p>
            <p className="text-sm text-muted-foreground">Track opens, clicks, and bounces.</p>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
