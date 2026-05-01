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
  metadata: z.record(z.any()).optional(),
});

export const sendTransactionalEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => sendInput.parse(input))
  .handler(async ({ data: parsed, context }) => {
    // In a real app, we would verify an API key.
    // Since this is a server function, we can't easily use it as a REST API for external clients
    // without more setup, but we can use it from our own frontend or other server functions.

    // For external REST API, TanStack Start supports API routes but it seems my version
    // or configuration has issues with `@tanstack/react-start/api`.

    // We'll skip the tenant verification here or assume it's passed in metadata for now
    // if we were to call this internally.

    const tenantId = (parsed.metadata?.tenantId as string);
    if (!tenantId) {
       throw new Error("tenantId is required in metadata for this demo action");
    }

    const { data, error } = await sendEmail({
      ...parsed,
      tenantId,
      metadata: { ...parsed.metadata, type: "transactional" },
    });

    if (error) {
      throw new Error(error.message);
    }

    return { data };
  });
