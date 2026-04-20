-- Extend campaigns with audience config + MJML + scheduling timezone
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS mjml_content text,
  ADD COLUMN IF NOT EXISTS audience_list_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS audience_include_tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS audience_exclude_tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS audience_exclude_suppressed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS schedule_timezone text NOT NULL DEFAULT 'UTC';

-- Index for tenant + status queries (campaigns list page)
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_status
  ON public.campaigns (tenant_id, status, updated_at DESC);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
