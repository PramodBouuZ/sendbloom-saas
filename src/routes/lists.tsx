import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Protected } from "@/lib/protected";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Plus, ListChecks, Trash2, Users, Loader2, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/lists")({
  head: () => ({ meta: [{ title: "Lists — BANTConfirm" }] }),
  component: ListsPage,
});

interface ContactList {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  member_count?: number;
}

function ListsPage() {
  return (
    <Protected>
      <AppShell>
        <ListsView />
      </AppShell>
    </Protected>
  );
}

function ListsView() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;
  const [lists, setLists] = useState<ContactList[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeList, setActiveList] = useState<ContactList | null>(null);

  const loadLists = async () => {
    if (!tenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("contact_lists")
      .select("id,name,description,created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const ids = (data ?? []).map((l) => l.id);
    let counts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: members } = await supabase
        .from("contact_list_members")
        .select("list_id")
        .in("list_id", ids);
      (members ?? []).forEach((m) => {
        counts[m.list_id] = (counts[m.list_id] ?? 0) + 1;
      });
    }
    setLists((data ?? []).map((l) => ({ ...l, member_count: counts[l.id] ?? 0 })));
    setLoading(false);
  };

  useEffect(() => {
    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("contact_lists").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("List deleted");
    loadLists();
    if (activeList?.id === id) setActiveList(null);
  };

  if (activeList) {
    return (
      <ListDetail
        list={activeList}
        tenantId={tenantId}
        onBack={() => { setActiveList(null); loadLists(); }}
      />
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Contact Lists</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Group contacts into reusable lists for campaigns.
          </p>
        </div>
        <CreateListDialog tenantId={tenantId} onDone={loadLists} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : lists.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ListChecks className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
            <p className="text-muted-foreground">No lists yet. Create one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((list) => (
            <Card key={list.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate">{list.name}</CardTitle>
                    <CardDescription className="line-clamp-2 mt-1">
                      {list.description || "No description"}
                    </CardDescription>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="-mt-1 -mr-2">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete list?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove "{list.name}" and its memberships. Contacts are not deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(list.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {list.member_count} {list.member_count === 1 ? "contact" : "contacts"}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setActiveList(list)}>
                    Manage <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateListDialog({
  tenantId,
  onDone,
}: {
  tenantId: string | null | undefined;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("contact_lists").insert({
      tenant_id: tenantId,
      name: name.trim(),
      description: description.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("List created");
    setOpen(false);
    setName(""); setDescription("");
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> New List
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create list</DialogTitle>
            <DialogDescription>Group contacts together for targeted campaigns.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label htmlFor="list-name">Name *</Label>
              <Input
                id="list-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Newsletter subscribers"
                maxLength={100}
                required
              />
            </div>
            <div>
              <Label htmlFor="list-desc">Description</Label>
              <Textarea
                id="list-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes about this list"
                maxLength={500}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ContactRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

function ListDetail({
  list,
  tenantId,
  onBack,
}: {
  list: ContactList;
  tenantId: string | null | undefined;
  onBack: () => void;
}) {
  const [members, setMembers] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const loadMembers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contact_list_members")
      .select("contact:contacts(id,email,first_name,last_name)")
      .eq("list_id", list.id);
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? [])
      .map((d: any) => d.contact)
      .filter(Boolean) as ContactRow[];
    rows.sort((a, b) => a.email.localeCompare(b.email));
    setMembers(rows);
    setLoading(false);
  };

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.id]);

  const handleRemove = async (contactId: string) => {
    const { error } = await supabase
      .from("contact_list_members")
      .delete()
      .eq("list_id", list.id)
      .eq("contact_id", contactId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Removed from list");
    loadMembers();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground mb-1">
            ← Back to lists
          </button>
          <h1 className="text-2xl font-bold">{list.name}</h1>
          {list.description && (
            <p className="text-sm text-muted-foreground mt-1">{list.description}</p>
          )}
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Contacts
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {members.length} {members.length === 1 ? "member" : "members"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No contacts in this list yet.
            </p>
          ) : (
            <div className="divide-y">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="font-medium text-sm">{m.email}</div>
                    {(m.first_name || m.last_name) && (
                      <div className="text-xs text-muted-foreground">
                        {[m.first_name, m.last_name].filter(Boolean).join(" ")}
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRemove(m.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showAdd && (
        <AddContactsToListDialog
          listId={list.id}
          tenantId={tenantId}
          existingIds={new Set(members.map((m) => m.id))}
          onClose={() => setShowAdd(false)}
          onDone={() => { setShowAdd(false); loadMembers(); }}
        />
      )}
    </div>
  );
}

function AddContactsToListDialog({
  listId,
  tenantId,
  existingIds,
  onClose,
  onDone,
}: {
  listId: string;
  tenantId: string | null | undefined;
  existingIds: Set<string>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!tenantId) return;
      setLoading(true);
      let query = supabase
        .from("contacts")
        .select("id,email,first_name,last_name")
        .eq("tenant_id", tenantId)
        .eq("is_suppressed", false)
        .order("email")
        .limit(200);
      if (search) {
        const term = `%${search}%`;
        query = query.or(`email.ilike.${term},first_name.ilike.${term},last_name.ilike.${term}`);
      }
      const { data } = await query;
      setContacts((data ?? []).filter((c) => !existingIds.has(c.id)) as ContactRow[]);
      setLoading(false);
    };
    const id = setTimeout(load, 200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tenantId]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    const rows = Array.from(selected).map((cid) => ({ list_id: listId, contact_id: cid }));
    const { error } = await supabase.from("contact_list_members").insert(rows);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Added ${selected.size} ${selected.size === 1 ? "contact" : "contacts"}`);
    onDone();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add contacts to list</DialogTitle>
          <DialogDescription>Showing up to 200 matching contacts.</DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Search email or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-80 overflow-y-auto rounded-md border">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : contacts.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">
              No contacts available.
            </p>
          ) : (
            contacts.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-4 w-4"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.email}</div>
                  {(c.first_name || c.last_name) && (
                    <div className="text-xs text-muted-foreground truncate">
                      {[c.first_name, c.last_name].filter(Boolean).join(" ")}
                    </div>
                  )}
                </div>
              </label>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdd} disabled={saving || selected.size === 0}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
