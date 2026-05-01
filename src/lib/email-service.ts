import { resend } from "./resend";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

type EmailEventStatus = Database["public"]["Enums"]["email_event_status"];

interface SendEmailOptions {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  reply_to?: string;
  tenantId: string;
  campaignId?: string;
  contactId?: string;
  metadata?: Record<string, any>;
}

export async function sendEmail(options: SendEmailOptions) {
  const { from, to, subject, html, text, reply_to, tenantId, campaignId, contactId, metadata } =
    options;

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
      reply_to,
      headers: {
        "X-Tenant-ID": tenantId,
        ...(campaignId && { "X-Campaign-ID": campaignId }),
      },
    });

    const status: EmailEventStatus = error ? "failed" : "sent";
    const errorMessage = error ? error.message : null;
    const messageId = data?.id || null;

    // Log the email attempt in Supabase
    const recipients = Array.isArray(to) ? to : [to];

    const logs = recipients.map((recipient) => ({
      tenant_id: tenantId,
      campaign_id: campaignId || null,
      contact_id: contactId || null,
      recipient_email: recipient,
      status,
      message_id: messageId,
      error_message: errorMessage,
      metadata: metadata || {},
    }));

    await supabaseAdmin.from("email_logs").insert(logs);

    if (error) {
      throw new Error(`Resend error: ${error.message}`);
    }

    return { data, error: null };
  } catch (error: any) {
    console.error("Failed to send email:", error);
    return { data: null, error };
  }
}

export async function sendBulkEmails(emails: Omit<SendEmailOptions, "to"> & { to: string }[]) {
  // Resend supports batch sending (up to 100 emails per batch)
  const batchSize = 100;
  const results = [];

  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);

    const { data, error } = await resend.batch.send(
      batch.map((email) => ({
        from: email.from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        reply_to: email.reply_to,
        headers: {
          "X-Tenant-ID": email.tenantId,
          ...(email.campaignId && { "X-Campaign-ID": email.campaignId }),
        },
      })),
    );

    // Log each email in the batch
    if (data) {
      const logs = batch.map((email, index) => ({
        tenant_id: email.tenantId,
        campaign_id: email.campaignId || null,
        contact_id: email.contactId || null,
        recipient_email: email.to,
        status: "sent" as EmailEventStatus,
        message_id: data.data?.[index]?.id || null,
        metadata: email.metadata || {},
      }));
      await supabaseAdmin.from("email_logs").insert(logs);
    } else if (error) {
      const logs = batch.map((email) => ({
        tenant_id: email.tenantId,
        campaign_id: email.campaignId || null,
        contact_id: email.contactId || null,
        recipient_email: email.to,
        status: "failed" as EmailEventStatus,
        error_message: error.message,
        metadata: email.metadata || {},
      }));
      await supabaseAdmin.from("email_logs").insert(logs);
    }

    results.push({ data, error });
  }

  return results;
}
