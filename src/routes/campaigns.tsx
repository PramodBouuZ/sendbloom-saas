import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

import { Protected } from "@/lib/protected";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Send, Loader2, Trash2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type CampaignRow = Pick<
  Database["public"]["Tables"]["campaigns"]["Row"],
  "id" | "name" | "subject" | "status" | "scheduled_at" | "updated_at" | "total_recipients"
>;

const STATUS_VARIANT: Record<CampaignRow["status"], "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  scheduled: "secondary",
  sending: "default",
  sent: "default",
  paused: "secondary",
  failed: "destructive",
};

export const Route = createFileRoute("/campaigns")({
  head: () => ({ meta: [{ title: "Campaigns — BANTConfirm" }] }),
  component: () => (
    <Protected>
      <AppShell>
        <CampaignsList />
      </AppShell>
    </Protected>
  ),
});

function CampaignsList() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const tenantId = profile?.tenant_id;

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("campaigns")
      .select("id,name,subject,status,scheduled_at,updated_at,total_recipients")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    else setCampaigns((data ?? []) as CampaignRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const handleCreate = async () => {
    if (!tenantId || !profile) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        tenant_id: tenantId,
        created_by: profile.id,
        name: "Untitled campaign",
        subject: "",
        from_name: profile.display_name ?? "Your team",
        from_email: profile.email ?? "noreply@example.com",
        status: "draft",
      })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) {
      toast.error(error?.message ?? "Failed to create");
      return;
    }
    navigate({ to: "/campaigns/$campaignId", params: { campaignId: data.id } });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Campaign deleted");
      void load();
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Design, schedule, and track your email campaigns.
          </p>
        </div>
        <Button onClick={handleCreate} disabled={creating || !tenantId}>
          {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          New campaign
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </TableCell>
              </TableRow>
            ) : campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                  <Send className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No campaigns yet. Create your first one.
                </TableCell>
              </TableRow>
            ) : (
              campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link
                      to="/campaigns/$campaignId"
                      params={{ campaignId: c.id }}
                      className="hover:underline"
                    >
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {c.subject || <span className="italic">No subject</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[c.status]} className="capitalize">
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{c.total_recipients.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently removes &ldquo;{c.name}&rdquo;.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(c.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
