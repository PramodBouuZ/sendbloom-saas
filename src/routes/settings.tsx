import { createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/lib/protected";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — BANTConfirm" }] }),
  component: () => (
    <Protected>
      <AppShell>
        <Settings />
      </AppShell>
    </Protected>
  ),
});

function Settings() {
  const { profile, roles, refresh } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim().slice(0, 80) })
      .eq("id", profile.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile updated");
      await refresh();
    }
    setSaving(false);
  };

  return (
    <div className="p-6 sm:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your profile and workspace.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profile?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dn">Display name</Label>
            <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Your roles</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {roles.length === 0 && <span className="text-sm text-muted-foreground">No roles assigned.</span>}
          {roles.map((r) => (
            <Badge key={r} variant="secondary" className="capitalize">{r.replace("_", " ")}</Badge>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
