import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sendEmail } from "@/lib/email-service";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const sendInput = z.object({
  from: z.string(),
  to: z.string().email(),
  subject: z.string(),
  html: z.string(),
  text: z.string().optional(),
  reply_to: z.string().email().optional(),
  tenantId: z.string().uuid(),
  metadata: z.record(z.any()).optional(),
});

export const sendTransactionalEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => sendInput.parse(input))
  .handler(async ({ data: parsed }) => {
    // Basic tenant verification
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id, is_active")
      .eq("id", parsed.tenantId)
      .single();

    if (!tenant || !tenant.is_active) {
      throw new Error("Invalid or inactive tenant");
    }

    const { data, error } = await sendEmail({
      ...parsed,
      tenantId: tenant.id,
      metadata: { ...parsed.metadata, type: "transactional" },
    });

    if (error) {
      throw new Error(error.message);
    }

    return { data };
  });
