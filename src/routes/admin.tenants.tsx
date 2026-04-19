import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Protected } from "@/lib/protected";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface TenantRow {
  id: string;
  name: string;
  plan: string;
  monthly_send_limit: number;
  emails_sent_this_month: number;
  is_active: boolean;
  created_at: string;
}

export const Route = createFileRoute("/admin/tenants")({
  head: () => ({ meta: [{ title: "Tenants — Admin" }] }),
  component: () => (
    <Protected requiredRoles={["super_admin"]}>
      <AppShell>
        <Tenants />
      </AppShell>
    </Protected>
  ),
});

function Tenants() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tenants")
      .select("id,name,plan,monthly_send_limit,emails_sent_this_month,is_active,created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setTenants((data ?? []) as TenantRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updatePlan = async (id: string, plan: string) => {
    const limits: Record<string, number> = { free: 1000, starter: 25000, pro: 250000, enterprise: 1000000 };
    const { error } = await supabase
      .from("tenants")
      .update({ plan: plan as TenantRow["plan"], monthly_send_limit: limits[plan] })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Plan updated"); load(); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("tenants").update({ is_active: !current }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(current ? "Tenant suspended" : "Tenant activated"); load(); }
  };

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Tenants</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage workspaces, plans, and limits.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>{tenants.length} workspaces</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : tenants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tenants yet.</p>
          ) : (
            <div className="space-y-3">
              {tenants.map((t) => {
                const usage = Math.min(100, Math.round((t.emails_sent_this_month / t.monthly_send_limit) * 100));
                return (
                  <div key={t.id} className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between rounded-lg border p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold truncate">{t.name}</p>
                        {!t.is_active && <Badge variant="destructive">Suspended</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t.emails_sent_this_month.toLocaleString()} / {t.monthly_send_limit.toLocaleString()} emails ({usage}%)
                      </p>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div className="h-full bg-primary" style={{ width: `${usage}%` }} />
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Select value={t.plan} onValueChange={(v) => updatePlan(t.id, v)}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="starter">Starter</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" onClick={() => toggleActive(t.id, t.is_active)}>
                        {t.is_active ? "Suspend" : "Activate"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
