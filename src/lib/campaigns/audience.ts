import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const audienceInput = z.object({
  listIds: z.array(z.string().uuid()).max(50).default([]),
  includeTags: z.array(z.string().min(1).max(64)).max(20).default([]),
  excludeTags: z.array(z.string().min(1).max(64)).max(20).default([]),
  excludeSuppressed: z.boolean().default(true),
});

export type AudienceConfig = z.infer<typeof audienceInput>;

export interface AudiencePreview {
  total: number;
  suppressed: number;
  sampleEmails: string[];
}

/**
 * Resolves the audience config to a deduplicated list of contact IDs for
 * the authenticated user's tenant.
 */
async function resolveAudience(
  supabase: import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >,
  tenantId: string,
  cfg: AudienceConfig,
): Promise<{ contactIds: Set<string>; suppressedCount: number }> {
  // 1. Seed pool: union of list members OR all tenant contacts when no lists chosen
  let pool: { id: string; tags: string[] | null; is_suppressed: boolean; email: string }[] = [];

  if (cfg.listIds.length > 0) {
    const { data: members } = await supabase
      .from("contact_list_members")
      .select("contact_id, contacts!inner(id, tags, is_suppressed, email, tenant_id)")
      .in("list_id", cfg.listIds);
    const seen = new Set<string>();
    for (const m of members ?? []) {
      // Supabase nested join shape
      const c = (m as unknown as {
        contacts: { id: string; tags: string[] | null; is_suppressed: boolean; email: string; tenant_id: string };
      }).contacts;
      if (c && c.tenant_id === tenantId && !seen.has(c.id)) {
        seen.add(c.id);
        pool.push({ id: c.id, tags: c.tags, is_suppressed: c.is_suppressed, email: c.email });
      }
    }
  } else {
    const { data } = await supabase
      .from("contacts")
      .select("id, tags, is_suppressed, email")
      .eq("tenant_id", tenantId)
      .limit(50000);
    pool = (data ?? []) as typeof pool;
  }

  // 2. Apply tag filters in JS (RLS is already scoping)
  const filtered = pool.filter((c) => {
    const tags = c.tags ?? [];
    if (cfg.includeTags.length > 0 && !cfg.includeTags.some((t) => tags.includes(t))) {
      return false;
    }
    if (cfg.excludeTags.length > 0 && cfg.excludeTags.some((t) => tags.includes(t))) {
      return false;
    }
    return true;
  });

  // 3. Suppression
  const suppressedCount = filtered.filter((c) => c.is_suppressed).length;
  const final = cfg.excludeSuppressed ? filtered.filter((c) => !c.is_suppressed) : filtered;

  return {
    contactIds: new Set(final.map((c) => c.id)),
    suppressedCount,
  };
}

export const previewAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => audienceInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.tenant_id) {
      throw new Response("No tenant for user", { status: 403 });
    }

    const { contactIds, suppressedCount } = await resolveAudience(
      supabase,
      profile.tenant_id,
      data,
    );

    // Fetch sample emails (max 5) for preview
    let sampleEmails: string[] = [];
    if (contactIds.size > 0) {
      const ids = Array.from(contactIds).slice(0, 5);
      const { data: sample } = await supabase
        .from("contacts")
        .select("email")
        .in("id", ids);
      sampleEmails = (sample ?? []).map((s) => s.email);
    }

    return {
      total: contactIds.size,
      suppressed: suppressedCount,
      sampleEmails,
    } satisfies AudiencePreview;
  });
