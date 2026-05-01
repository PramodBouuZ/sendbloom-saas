import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Upload, Plus, Search, Trash2, Users, Loader2, Ban } from "lucide-react";

const PAGE_SIZE = 25;

const searchSchema = z.object({
  q: z.string().optional().default(""),
  page: z.number().int().min(1).optional().default(1),
  tag: z.string().optional().default(""),
});

type SearchParams = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/contacts")({
  head: () => ({ meta: [{ title: "Contacts — BANTConfirm" }] }),
  validateSearch: (input: Record<string, unknown>): SearchParams => searchSchema.parse(input),
  component: ContactsPage,
});

interface Contact {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  tags: string[] | null;
  is_suppressed: boolean;
  created_at: string;
}

const emailSchema = z.string().trim().toLowerCase().email().max(255);

function ContactsPage() {
  return (
    <Protected>
      <AppShell>
        <ContactsView />
      </AppShell>
    </Protected>
  );
}

function ContactsView() {
  const { profile } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/contacts" });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [qInput, setQInput] = useState(search.q);

  const tenantId = profile?.tenant_id;

  // Debounce search input -> URL
  useEffect(() => {
    const id = setTimeout(() => {
      if (qInput !== search.q) {
        navigate({ search: (s: SearchParams) => ({ ...s, q: qInput, page: 1 }) });
      }
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  const loadContacts = async () => {
    if (!tenantId) return;
    setLoading(true);
    const from = (search.page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("contacts")
      .select("id,email,first_name,last_name,tags,is_suppressed,created_at", { count: "exact" })
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (search.q) {
      const term = `%${search.q}%`;
      query = query.or(`email.ilike.${term},first_name.ilike.${term},last_name.ilike.${term}`);
    }
    if (search.tag) {
      query = query.contains("tags", [search.tag]);
    }

    const { data, count, error } = await query;
    if (error) {
      toast.error("Failed to load contacts: " + error.message);
    } else {
      setContacts((data ?? []) as Contact[]);
      setTotal(count ?? 0);
    }
    setLoading(false);
  };

  const loadTags = async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("contacts")
      .select("tags")
      .eq("tenant_id", tenantId)
      .not("tags", "is", null)
      .limit(1000);
    const set = new Set<string>();
    (data ?? []).forEach((row) => (row.tags ?? []).forEach((t: string) => set.add(t)));
    setAllTags(Array.from(set).sort());
  };

  useEffect(() => {
    loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, search.q, search.page, search.tag]);

  useEffect(() => {
    loadTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Contact deleted");
    loadContacts();
  };

  const handleSuppress = async (c: Contact) => {
    if (!tenantId) return;
    const { error: e1 } = await supabase
      .from("contacts")
      .update({ is_suppressed: true })
      .eq("id", c.id);
    if (e1) {
      toast.error(e1.message);
      return;
    }
    await supabase.from("suppressions").insert({
      tenant_id: tenantId,
      email: c.email,
      reason: "manual",
    });
    toast.success(`Suppressed ${c.email}`);
    loadContacts();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total.toLocaleString()} total {total === 1 ? "contact" : "contacts"}
          </p>
        </div>
        <div className="flex gap-2">
          <UploadCsvDialog
            tenantId={tenantId}
            onDone={() => {
              loadContacts();
              loadTags();
            }}
          />
          <AddContactDialog
            tenantId={tenantId}
            onDone={() => {
              loadContacts();
              loadTags();
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search email or name..."
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={search.tag}
          onChange={(e) =>
            navigate({ search: (s: SearchParams) => ({ ...s, tag: e.target.value, page: 1 }) })
          }
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[120px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No contacts. Upload a CSV or add one manually.
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.email}</TableCell>
                  <TableCell>
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(c.tags ?? []).map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {c.is_suppressed ? (
                      <Badge variant="destructive" className="text-xs">
                        Suppressed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      {!c.is_suppressed && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSuppress(c)}
                          title="Suppress"
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove {c.email} from your contacts.
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
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {search.page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={search.page <= 1}
              onClick={() =>
                navigate({ search: (s: SearchParams) => ({ ...s, page: s.page - 1 }) })
              }
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={search.page >= totalPages}
              onClick={() =>
                navigate({ search: (s: SearchParams) => ({ ...s, page: s.page + 1 }) })
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddContactDialog({
  tenantId,
  onDone,
}: {
  tenantId: string | null | undefined;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [tags, setTags] = useState("");
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
    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const { error } = await supabase.from("contacts").insert({
      tenant_id: tenantId,
      email: parsed.data,
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      tags: tagList.length ? tagList : null,
    });
    setSubmitting(false);
    if (error) {
      if (error.code === "23505") {
        toast.error("This email already exists");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Contact added");
    setOpen(false);
    setEmail("");
    setFirstName("");
    setLastName("");
    setTags("");
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4 mr-2" /> Add Contact
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add contact</DialogTitle>
            <DialogDescription>Add a single contact to your workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fn">First name</Label>
                <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ln">Last name</Label>
                <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="tg">Tags (comma-separated)</Label>
              <Input
                id="tg"
                placeholder="lead, vip"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface CsvRow {
  email: string;
  first_name?: string;
  last_name?: string;
  tags?: string[];
}

function UploadCsvDialog({
  tenantId,
  onDone,
}: {
  tenantId: string | null | undefined;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<CsvRow[] | null>(null);
  const [invalid, setInvalid] = useState(0);
  const [extraTags, setExtraTags] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (result) => {
        const rows: CsvRow[] = [];
        const seen = new Set<string>();
        let invalidCount = 0;
        for (const row of result.data) {
          const rawEmail = (row.email ?? row.email_address ?? "").trim();
          const valid = emailSchema.safeParse(rawEmail);
          if (!valid.success) {
            invalidCount++;
            continue;
          }
          const email = valid.data;
          if (seen.has(email)) continue;
          seen.add(email);
          const tagsRaw = (row.tags ?? "").trim();
          rows.push({
            email,
            first_name: (row.first_name ?? row.firstname ?? row.fname ?? "").trim() || undefined,
            last_name: (row.last_name ?? row.lastname ?? row.lname ?? "").trim() || undefined,
            tags: tagsRaw
              ? tagsRaw
                  .split(/[,;|]/)
                  .map((t) => t.trim())
                  .filter(Boolean)
              : undefined,
          });
        }
        setParsed(rows);
        setInvalid(invalidCount);
      },
      error: (err) => toast.error("CSV parse error: " + err.message),
    });
  };

  const handleUpload = async () => {
    if (!tenantId || !parsed) return;
    setUploading(true);
    setProgress(0);
    const extras = extraTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const BATCH = 200;
    let done = 0;
    let success = 0;
    let failed = 0;

    for (let i = 0; i < parsed.length; i += BATCH) {
      const slice = parsed.slice(i, i + BATCH);
      const payload = slice.map((r) => ({
        tenant_id: tenantId,
        email: r.email,
        first_name: r.first_name ?? null,
        last_name: r.last_name ?? null,
        tags: [...new Set([...(r.tags ?? []), ...extras])].length
          ? [...new Set([...(r.tags ?? []), ...extras])]
          : null,
      }));
      const { error, count } = await supabase.from("contacts").upsert(payload, {
        onConflict: "tenant_id,email",
        ignoreDuplicates: false,
        count: "exact",
      });
      if (error) {
        failed += slice.length;
      } else {
        success += count ?? slice.length;
      }
      done += slice.length;
      setProgress(Math.round((done / parsed.length) * 100));
    }

    setUploading(false);
    toast.success(`Imported ${success} contacts${failed ? ` · ${failed} failed` : ""}`);
    setOpen(false);
    setParsed(null);
    setExtraTags("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onDone();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setParsed(null);
          setExtraTags("");
          setInvalid(0);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4 mr-2" /> Upload CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload contacts CSV</DialogTitle>
          <DialogDescription>
            Headers should include <code>email</code> (required), <code>first_name</code>,{" "}
            <code>last_name</code>, <code>tags</code> (comma/semicolon-separated).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!parsed ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div>
                  <strong>{parsed.length}</strong> valid unique contacts ready to import
                </div>
                {invalid > 0 && (
                  <div className="text-destructive mt-1">
                    {invalid} rows skipped (invalid email)
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="extra-tags">Apply tags to all imported contacts (optional)</Label>
                <Input
                  id="extra-tags"
                  placeholder="newsletter, q1-2026"
                  value={extraTags}
                  onChange={(e) => setExtraTags(e.target.value)}
                />
              </div>
              {uploading && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Importing... {progress}%</div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={uploading}>
            Cancel
          </Button>
          {parsed && (
            <Button onClick={handleUpload} disabled={uploading || parsed.length === 0}>
              {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import {parsed.length}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
