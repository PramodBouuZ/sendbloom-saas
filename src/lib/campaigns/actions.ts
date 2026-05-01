import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendEmail, sendBulkEmails } from "@/lib/email-service";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const sendTestEmailInput = z.object({
  campaignId: z.string().uuid(),
  to: z.string().email(),
  subject: z.string(),
  html: z.string(),
  fromName: z.string(),
  fromEmail: z.string(),
});

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sendTestEmailInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify user belongs to the tenant of the campaign
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("tenant_id")
      .eq("id", data.campaignId)
      .single();

    if (!campaign) {
      throw new Response("Campaign not found", { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .single();

    if (profile?.tenant_id !== campaign.tenant_id) {
      throw new Response("Unauthorized", { status: 403 });
    }

    const result = await sendEmail({
      from: `${data.fromName} <${data.fromEmail}>`,
      to: data.to,
      subject: `[TEST] ${data.subject}`,
      html: data.html,
      tenantId: campaign.tenant_id,
      campaignId: data.campaignId,
      metadata: { isTest: true },
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    return { success: true };
  });

export const sendCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ campaignId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Fetch campaign and verify ownership
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", data.campaignId)
      .single();

    if (!campaign) throw new Response("Campaign not found", { status: 404 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .single();

    if (profile?.tenant_id !== campaign.tenant_id) {
      throw new Response("Unauthorized", { status: 403 });
    }

    if (campaign.status !== "draft" && campaign.status !== "scheduled") {
      throw new Error(`Cannot send campaign in status: ${campaign.status}`);
    }

    // 2. Update status to sending
    await supabaseAdmin
      .from("campaigns")
      .update({ status: "sending", started_at: new Date().toISOString() })
      .eq("id", campaign.id);

    // 3. Resolve audience (reusing logic or simplified for now)
    // For simplicity in this implementation, we'll fetch all contacts in the selected lists
    // or all contacts if no lists selected (same as resolveAudience)

    let recipientEmails: { id: string; email: string }[] = [];
    if (campaign.audience_list_ids && campaign.audience_list_ids.length > 0) {
      const { data: members } = await supabaseAdmin
        .from("contact_list_members")
        .select("contacts(id, email, is_suppressed)")
        .in("list_id", campaign.audience_list_ids);

      const seen = new Set<string>();
      for (const m of (members as unknown as { contacts: { id: string; email: string; is_suppressed: boolean } }[]) ?? []) {
        const c = m.contacts;
        if (c && !c.is_suppressed && !seen.has(c.id)) {
          seen.add(c.id);
          recipientEmails.push({ id: c.id, email: c.email });
        }
      }
    } else {
      const { data: contacts } = await supabaseAdmin
        .from("contacts")
        .select("id, email")
        .eq("tenant_id", campaign.tenant_id)
        .eq("is_suppressed", false);
      recipientEmails = contacts ?? [];
    }

    // 4. Send emails in batches
    const emailsToSend = recipientEmails.map((r) => ({
      from: `${campaign.from_name} <${campaign.from_email}>`,
      to: r.email,
      subject: campaign.subject,
      html: campaign.html_content || "",
      reply_to: campaign.reply_to || undefined,
      tenantId: campaign.tenant_id,
      campaignId: campaign.id,
      contactId: r.id,
    }));

    await sendBulkEmails(emailsToSend);

    // 5. Update campaign status
    await supabaseAdmin
      .from("campaigns")
      .update({
        status: "sent",
        completed_at: new Date().toISOString(),
        total_recipients: recipientEmails.length,
        total_sent: recipientEmails.length, // Simplified
      })
      .eq("id", campaign.id);

    // 6. Update tenant usage
    // We'll use a direct update for now as the RPC might not exist
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("emails_sent_this_month")
      .eq("id", campaign.tenant_id)
      .single();

    if (tenant) {
      await supabaseAdmin
        .from("tenants")
        .update({
          emails_sent_this_month: tenant.emails_sent_this_month + recipientEmails.length,
        })
        .eq("id", campaign.tenant_id);
    }

    return { success: true, count: recipientEmails.length };
  });
