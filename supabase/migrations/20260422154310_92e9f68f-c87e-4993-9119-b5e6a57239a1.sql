-- Status enum for tenant domains
CREATE TYPE public.tenant_domain_status AS ENUM (
  'pending',
  'verifying',
  'verified',
  'failed',
  'temporary_failure'
);

CREATE TABLE public.tenant_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain text NOT NULL,
  status public.tenant_domain_status NOT NULL DEFAULT 'pending',

  -- SES region this identity lives in
  aws_region text NOT NULL DEFAULT 'us-east-1',

  -- Easy DKIM: SES returns 3 tokens. Each becomes:
  -- <token>._domainkey.<domain>  CNAME  <token>.dkim.amazonses.com
  dkim_tokens text[] NOT NULL DEFAULT '{}'::text[],

  -- Custom MAIL FROM (bounce return-path) — recommended for deliverability
  mail_from_domain text,
  mail_from_mx_record text,
  mail_from_spf_record text,

  -- SNS topic for bounce/complaint notifications
  sns_topic_arn text,
  sns_subscription_arn text,

  -- Diagnostic
  last_error text,
  last_polled_at timestamptz,
  verified_at timestamptz,

  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, domain)
);

CREATE INDEX idx_tenant_domains_tenant ON public.tenant_domains(tenant_id);
CREATE INDEX idx_tenant_domains_status ON public.tenant_domains(status);

-- Keep updated_at fresh
CREATE TRIGGER trg_tenant_domains_updated_at
BEFORE UPDATE ON public.tenant_domains
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.tenant_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members manage domains"
  ON public.tenant_domains
  FOR ALL
  USING (tenant_id = public.get_user_tenant(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Super admins view all domains"
  ON public.tenant_domains
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));