import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Protected } from "@/lib/protected";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Search, Trash2, Ban, Loader2 } from "lucide-react";

export const Route = createFileRoute("/suppressions")({
  head: () => ({ meta: [{ title: "Suppressions — BANTConfirm" }] }),
  component: SuppressionsPage,
});

interface Suppression {
  id: string;
  email: string;
  reason: "unsubscribe" | "bounce" | "complaint" | "manual";
  created_at: string;
}

const emailSchema = z.string().trim().toLowerCase().email().max(255);

const reasonColors: Record<Suppression["reason"], string> = {
  unsubscribe: "secondary",
  bounce: "destructive",
  complaint: "destructive",
  manual: "outline",
};

function SuppressionsPage() {
  return (
    <Protected>
      <AppShell>
        <SuppressionsView />
      </AppShell>
    </Protected>
  );
}

function SuppressionsView() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;
  const [items, setItems] = useState<Suppression[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    let query = supabase
      .from("suppressions")
      .select("id,email,reason,created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (search) {
      query = query.ilike("email", `%${search}%`);
    }
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setItems((data ?? []) as Suppression[]);
    setLoading(false);
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, search]);

  const handleRemove = async (item: Suppression) => {
    if (!tenantId) return;
    const { error } = await supabase.from("suppressions").delete().eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Also unsuppress matching contact
    await supabase
      .from("contacts")
      .update({ is_suppressed: false })
      .eq("tenant_id", tenantId)
      .eq("email", item.email);
    toast.success(`Removed ${item.email} from suppression list`);
    load();
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Suppression List</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Emails that will be excluded from all campaigns.
          </p>
        </div>
        <AddSuppressionDialog tenantId={tenantId} onDone={load} />
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  <Ban className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No suppressed emails.
                </TableCell>
              </TableRow>
            ) : (
              items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.email}</TableCell>
                  <TableCell>
                    <Badge variant={reasonColors[s.reason] as any} className="capitalize text-xs">
                      {s.reason}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(s.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => handleRemove(s)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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

function AddSuppressionDialog({
  tenantId,
  onDone,
}: {
  tenantId: string | null | undefined;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      toast.error("Invalid email address");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("suppressions").insert({
      tenant_id: tenantId,
      email: parsed.data,
      reason: "manual",
    });
    if (!error) {
      // Mirror to contact
      await supabase
        .from("contacts")
        .update({ is_suppressed: true })
        .eq("tenant_id", tenantId)
        .eq("email", parsed.data);
    }
    setSubmitting(false);
    if (error) {
      if (error.code === "23505") {
        toast.error("This email is already suppressed");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Email suppressed");
    setOpen(false);
    setEmail("");
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> Add Suppression
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Suppress an email</DialogTitle>
            <DialogDescription>
              This email will be excluded from all future campaigns.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label htmlFor="supp-email">Email *</Label>
              <Input
                id="supp-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Suppress
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
