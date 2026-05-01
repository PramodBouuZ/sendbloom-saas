import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { z } from "zod";
import { sendCampaign } from "@/lib/campaigns/actions";

import { Protected } from "@/lib/protected";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Loader2,
  Eye,
  Calendar as CalendarIcon,
  Send,
  Beaker,
} from "lucide-react";

import { MjmlEditor } from "@/components/campaigns/mjml-editor";
import { AudiencePicker, DEFAULT_AUDIENCE } from "@/components/campaigns/audience-picker";
import type { AudienceConfig } from "@/lib/campaigns/audience";
import type { Database } from "@/integrations/supabase/types";

type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];

const META_SCHEMA = z.object({
  name: z.string().min(1, "Name is required").max(200),
  subject: z.string().min(1, "Subject is required").max(200),
  preview_text: z.string().max(200).optional().or(z.literal("")),
  from_name: z.string().min(1).max(100),
  from_email: z.string().email().max(255),
  reply_to: z.string().email().max(255).optional().or(z.literal("")),
});

export const Route = createFileRoute("/campaigns/$campaignId")({
  head: () => ({ meta: [{ title: "Edit campaign — BANTConfirm" }] }),
  component: () => (
    <Protected>
      <AppShell>
        <CampaignEditor />
      </AppShell>
    </Protected>
  ),
});

function CampaignEditor() {
  const { campaignId } = Route.useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [testEmailOpen, setTestEmailOpen] = useState(false);

  // Local editable state
  const [meta, setMeta] = useState({
    name: "",
    subject: "",
    preview_text: "",
    from_name: "",
    from_email: "",
    reply_to: "",
  });
  const [mjml, setMjml] = useState("");
  const [html, setHtml] = useState("");
  const [audience, setAudience] = useState<AudienceConfig>(DEFAULT_AUDIENCE);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaignId)
        .maybeSingle();
      if (error || !data) {
        toast.error(error?.message ?? "Campaign not found");
        navigate({ to: "/campaigns" });
        return;
      }
      setCampaign(data);
      setMeta({
        name: data.name,
        subject: data.subject ?? "",
        preview_text: data.preview_text ?? "",
        from_name: data.from_name,
        from_email: data.from_email,
        reply_to: data.reply_to ?? "",
      });
      setMjml(data.mjml_content ?? "");
      setHtml(data.html_content ?? "");
      setAudience({
        listIds: data.audience_list_ids ?? [],
        includeTags: data.audience_include_tags ?? [],
        excludeTags: data.audience_exclude_tags ?? [],
        excludeSuppressed: data.audience_exclude_suppressed,
      });
      setLoading(false);
    })();
  }, [campaignId, navigate]);

  const persist = async (extras?: Partial<Campaign>) => {
    if (!campaign) return null;
    const parsed = META_SCHEMA.safeParse(meta);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid form data");
      return null;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("campaigns")
      .update({
        name: parsed.data.name,
        subject: parsed.data.subject,
        preview_text: parsed.data.preview_text || null,
        from_name: parsed.data.from_name,
        from_email: parsed.data.from_email,
        reply_to: parsed.data.reply_to || null,
        mjml_content: mjml || null,
        html_content: html || null,
        audience_list_ids: audience.listIds,
        audience_include_tags: audience.includeTags,
        audience_exclude_tags: audience.excludeTags,
        audience_exclude_suppressed: audience.excludeSuppressed,
        ...extras,
      })
      .eq("id", campaign.id)
      .select("*")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "Save failed");
      return null;
    }
    setCampaign(data);
    return data;
  };

  const handleSave = async () => {
    const result = await persist();
    if (result) toast.success("Saved");
  };

  const handleSchedule = async (when: Date) => {
    // If scheduling for "now", trigger immediate send
    const isNow = Math.abs(when.getTime() - Date.now()) < 5000;

    if (isNow) {
      const saved = await persist();
      if (!saved) return;

      setSaving(true);
      try {
        await sendCampaign({ data: { campaignId } });
        toast.success("Campaign is being sent!");
        setScheduleOpen(false);
        navigate({ to: "/campaigns" });
      } catch (error: any) {
        toast.error(error.message || "Failed to send campaign");
      } finally {
        setSaving(false);
      }
      return;
    }

    const result = await persist({
      status: "scheduled",
      scheduled_at: when.toISOString(),
      schedule_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    if (result) {
      toast.success(`Scheduled for ${format(when, "PPpp")}`);
      setScheduleOpen(false);
      navigate({ to: "/campaigns" });
    }
  };

  if (loading || !profile?.tenant_id) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b bg-card px-6 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button asChild variant="ghost" size="icon">
            <Link to="/campaigns">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Input
            value={meta.name}
            onChange={(e) => setMeta({ ...meta, name: e.target.value })}
            className="h-9 max-w-md font-medium"
            placeholder="Campaign name"
          />
          {campaign && (
            <Badge variant="outline" className="capitalize shrink-0">
              {campaign.status}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setTestEmailOpen(true)}
            disabled={saving || !mjml}
          >
            <Beaker className="h-4 w-4 mr-2" />
            Send test
          </Button>
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save draft
          </Button>
          <Button onClick={() => setScheduleOpen(true)} disabled={saving || !mjml || !meta.subject}>
            <Send className="h-4 w-4 mr-2" />
            Send / Schedule
          </Button>
        </div>
      </div>

      <Tabs defaultValue="design" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-6 mt-3 self-start">
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="h-3.5 w-3.5 mr-1.5" /> Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="design" className="flex-1 m-0 mt-3 px-6 pb-6 min-h-0">
          <div className="h-full rounded-lg border overflow-hidden bg-card">
            <MjmlEditor
              value={mjml}
              onChange={(nextMjml, nextHtml) => {
                setMjml(nextMjml);
                setHtml(nextHtml);
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="settings" className="flex-1 m-0 mt-3 px-6 pb-6 overflow-auto">
          <div className="max-w-2xl mx-auto space-y-5">
            <div>
              <Label htmlFor="subject">Subject line *</Label>
              <Input
                id="subject"
                value={meta.subject}
                onChange={(e) => setMeta({ ...meta, subject: e.target.value })}
                placeholder="Your weekly update is here"
              />
            </div>
            <div>
              <Label htmlFor="preview">Preview text</Label>
              <Input
                id="preview"
                value={meta.preview_text}
                onChange={(e) => setMeta({ ...meta, preview_text: e.target.value })}
                placeholder="Shown after the subject in inbox preview"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="from_name">From name *</Label>
                <Input
                  id="from_name"
                  value={meta.from_name}
                  onChange={(e) => setMeta({ ...meta, from_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="from_email">From email *</Label>
                <Input
                  id="from_email"
                  type="email"
                  value={meta.from_email}
                  onChange={(e) => setMeta({ ...meta, from_email: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="reply_to">Reply-to (optional)</Label>
              <Input
                id="reply_to"
                type="email"
                value={meta.reply_to}
                onChange={(e) => setMeta({ ...meta, reply_to: e.target.value })}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="audience" className="flex-1 m-0 mt-3 px-6 pb-6 overflow-auto">
          <div className="max-w-2xl mx-auto">
            <AudiencePicker tenantId={profile.tenant_id} value={audience} onChange={setAudience} />
          </div>
        </TabsContent>

        <TabsContent value="preview" className="flex-1 m-0 mt-3 px-6 pb-6 overflow-auto">
          <div className="max-w-2xl mx-auto space-y-3">
            <div className="rounded-lg border bg-card p-4 space-y-1">
              <div className="text-xs uppercase text-muted-foreground tracking-wide">From</div>
              <div className="font-medium">
                {meta.from_name}{" "}
                <span className="text-muted-foreground">&lt;{meta.from_email}&gt;</span>
              </div>
              <div className="text-xs uppercase text-muted-foreground tracking-wide pt-2">
                Subject
              </div>
              <div className="font-medium">
                {meta.subject || <span className="italic text-muted-foreground">No subject</span>}
              </div>
              {meta.preview_text && (
                <div className="text-sm text-muted-foreground">{meta.preview_text}</div>
              )}
            </div>
            <div className="rounded-lg border bg-white overflow-hidden">
              {html ? (
                <iframe
                  title="Email preview"
                  srcDoc={html}
                  className="w-full"
                  style={{ height: "70vh", border: 0 }}
                />
              ) : (
                <div className="p-12 text-center text-muted-foreground text-sm">
                  Add some content in the Design tab to see a preview.
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onConfirm={handleSchedule}
        saving={saving}
      />

      <TestEmailDialog
        open={testEmailOpen}
        onOpenChange={setTestEmailOpen}
        campaignId={campaignId}
        subject={meta.subject}
        html={html}
        fromName={meta.from_name}
        fromEmail={meta.from_email}
      />
    </div>
  );
}

import { sendTestEmail } from "@/lib/campaigns/actions";

function TestEmailDialog({
  open,
  onOpenChange,
  campaignId,
  subject,
  html,
  fromName,
  fromEmail,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId: string;
  subject: string;
  html: string;
  fromName: string;
  fromEmail: string;
}) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!email) return;
    setSending(true);
    try {
      await sendTestEmail({
        data: {
          campaignId,
          to: email,
          subject,
          html,
          fromName,
          fromEmail,
        },
      });
      toast.success("Test email sent");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to send test email");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send test email</DialogTitle>
          <DialogDescription>
            Send a test version of this campaign to yourself or a colleague.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="test-email">Recipient email</Label>
            <Input
              id="test-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !email}>
            {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Send test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({
  open,
  onOpenChange,
  onConfirm,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (when: Date) => void;
  saving: boolean;
}) {
  const [mode, setMode] = useState<"now" | "later">("now");
  // Default to 1 hour from now, in local-time string
  const [whenStr, setWhenStr] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    // datetime-local needs YYYY-MM-DDTHH:mm
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const submit = () => {
    if (mode === "now") {
      // Schedule "now" still creates a scheduled record at this instant — Phase 4 sender picks it up.
      onConfirm(new Date());
    } else {
      const dt = new Date(whenStr);
      if (isNaN(dt.getTime())) {
        toast.error("Pick a valid date and time");
        return;
      }
      if (dt.getTime() < Date.now() - 60_000) {
        toast.error("Pick a time in the future");
        return;
      }
      onConfirm(dt);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send campaign</DialogTitle>
          <DialogDescription>
            Sending happens via the queue worker (coming in Phase 4). Your choice here is recorded
            on the campaign.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={mode}
          onValueChange={(v) => setMode(v as "now" | "later")}
          className="space-y-3 py-2"
        >
          <label className="flex items-start gap-3 cursor-pointer">
            <RadioGroupItem value="now" id="now" className="mt-1" />
            <div>
              <div className="font-medium">Send now</div>
              <div className="text-xs text-muted-foreground">Queue immediately for delivery.</div>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <RadioGroupItem value="later" id="later" className="mt-1" />
            <div className="flex-1">
              <div className="font-medium">Schedule for later</div>
              <div className="text-xs text-muted-foreground mb-2">
                Stored in your timezone ({tz}).
              </div>
              {mode === "later" && (
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="datetime-local"
                    value={whenStr}
                    onChange={(e) => setWhenStr(e.target.value)}
                  />
                </div>
              )}
            </div>
          </label>
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
