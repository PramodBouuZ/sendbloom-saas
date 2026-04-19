-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('super_admin', 'tenant_owner', 'user');
CREATE TYPE public.tenant_plan AS ENUM ('free', 'starter', 'pro', 'enterprise');
CREATE TYPE public.campaign_status AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'paused', 'failed');
CREATE TYPE public.email_event_status AS ENUM ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed', 'unsubscribed');
CREATE TYPE public.suppression_reason AS ENUM ('unsubscribe', 'bounce', 'complaint', 'manual');

-- ============================================================
-- TENANTS
-- ============================================================
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  plan public.tenant_plan NOT NULL DEFAULT 'free',
  monthly_send_limit INTEGER NOT NULL DEFAULT 1000,
  emails_sent_this_month INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_profiles_tenant ON public.profiles(tenant_id);

-- ============================================================
-- USER ROLES (separate table — never store roles on profiles)
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, tenant_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- ============================================================
-- SECURITY DEFINER FUNCTIONS (avoid RLS recursion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant(_user_id UUID)
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND tenant_id = _tenant_id
  )
$$;

-- ============================================================
-- TENANT POLICIES
-- ============================================================
CREATE POLICY "Super admins manage all tenants"
ON public.tenants FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Members view their tenant"
ON public.tenants FOR SELECT
USING (id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Tenant owners update their tenant"
ON public.tenants FOR UPDATE
USING (
  id = public.get_user_tenant(auth.uid())
  AND public.has_role(auth.uid(), 'tenant_owner')
);

-- ============================================================
-- PROFILES POLICIES
-- ============================================================
CREATE POLICY "Users view own profile"
ON public.profiles FOR SELECT
USING (id = auth.uid());

CREATE POLICY "Users view tenant members"
ON public.profiles FOR SELECT
USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Super admins view all profiles"
ON public.profiles FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Users update own profile"
ON public.profiles FOR UPDATE
USING (id = auth.uid());

CREATE POLICY "Users insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (id = auth.uid());

-- ============================================================
-- USER_ROLES POLICIES (users CANNOT modify their own roles)
-- ============================================================
CREATE POLICY "Users view own roles"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Super admins manage all roles"
ON public.user_roles FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant owners view tenant roles"
ON public.user_roles FOR SELECT
USING (
  tenant_id = public.get_user_tenant(auth.uid())
  AND public.has_role(auth.uid(), 'tenant_owner')
);

CREATE POLICY "Tenant owners assign user role in their tenant"
ON public.user_roles FOR INSERT
WITH CHECK (
  tenant_id = public.get_user_tenant(auth.uid())
  AND public.has_role(auth.uid(), 'tenant_owner')
  AND role = 'user'
);

CREATE POLICY "Tenant owners remove user role in their tenant"
ON public.user_roles FOR DELETE
USING (
  tenant_id = public.get_user_tenant(auth.uid())
  AND public.has_role(auth.uid(), 'tenant_owner')
  AND role = 'user'
);

-- ============================================================
-- CONTACT LISTS
-- ============================================================
CREATE TABLE public.contact_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contact_lists ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_contact_lists_tenant ON public.contact_lists(tenant_id);

CREATE POLICY "Tenant members manage lists"
ON public.contact_lists FOR ALL
USING (tenant_id = public.get_user_tenant(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Super admins view all lists"
ON public.contact_lists FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- ============================================================
-- CONTACTS
-- ============================================================
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb,
  is_suppressed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_contacts_tenant ON public.contacts(tenant_id);
CREATE INDEX idx_contacts_email ON public.contacts(email);
CREATE INDEX idx_contacts_tags ON public.contacts USING GIN(tags);

CREATE POLICY "Tenant members manage contacts"
ON public.contacts FOR ALL
USING (tenant_id = public.get_user_tenant(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Super admins view all contacts"
ON public.contacts FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- ============================================================
-- CONTACT_LIST_MEMBERS (many-to-many)
-- ============================================================
CREATE TABLE public.contact_list_members (
  list_id UUID NOT NULL REFERENCES public.contact_lists(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, contact_id)
);
ALTER TABLE public.contact_list_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_clm_contact ON public.contact_list_members(contact_id);

CREATE POLICY "Tenant members manage list memberships"
ON public.contact_list_members FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.contact_lists l
    WHERE l.id = contact_list_members.list_id
    AND l.tenant_id = public.get_user_tenant(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contact_lists l
    WHERE l.id = contact_list_members.list_id
    AND l.tenant_id = public.get_user_tenant(auth.uid())
  )
);

-- ============================================================
-- CAMPAIGNS
-- ============================================================
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  preview_text TEXT,
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  reply_to TEXT,
  html_content TEXT,
  json_content JSONB,
  text_content TEXT,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  list_id UUID REFERENCES public.contact_lists(id) ON DELETE SET NULL,
  segment_tags TEXT[] DEFAULT '{}',
  total_recipients INTEGER NOT NULL DEFAULT 0,
  total_sent INTEGER NOT NULL DEFAULT 0,
  total_delivered INTEGER NOT NULL DEFAULT 0,
  total_opened INTEGER NOT NULL DEFAULT 0,
  total_clicked INTEGER NOT NULL DEFAULT 0,
  total_bounced INTEGER NOT NULL DEFAULT 0,
  total_unsubscribed INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_campaigns_tenant ON public.campaigns(tenant_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_campaigns_scheduled ON public.campaigns(scheduled_at) WHERE status = 'scheduled';

CREATE POLICY "Tenant members manage campaigns"
ON public.campaigns FOR ALL
USING (tenant_id = public.get_user_tenant(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Super admins view all campaigns"
ON public.campaigns FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- ============================================================
-- EMAIL LOGS (per-recipient, append-only audit trail)
-- ============================================================
CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  message_id TEXT,
  status public.email_event_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_email_logs_campaign ON public.email_logs(campaign_id);
CREATE INDEX idx_email_logs_tenant ON public.email_logs(tenant_id);
CREATE INDEX idx_email_logs_recipient ON public.email_logs(recipient_email);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);

CREATE POLICY "Tenant members view email logs"
ON public.email_logs FOR SELECT
USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Super admins view all email logs"
ON public.email_logs FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- ============================================================
-- SUPPRESSIONS (per-tenant unsubscribe / bounce list)
-- ============================================================
CREATE TABLE public.suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  reason public.suppression_reason NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);
ALTER TABLE public.suppressions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_suppressions_tenant ON public.suppressions(tenant_id);

CREATE POLICY "Tenant members manage suppressions"
ON public.suppressions FOR ALL
USING (tenant_id = public.get_user_tenant(auth.uid()))
WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

-- ============================================================
-- UNSUBSCRIBE TOKENS (one per recipient email per tenant)
-- ============================================================
CREATE TABLE public.unsubscribe_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);
ALTER TABLE public.unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_unsub_token ON public.unsubscribe_tokens(token);

-- No client-side policies; only service role / edge funcs touch this table.

-- ============================================================
-- TIMESTAMP TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_lists_updated BEFORE UPDATE ON public.contact_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_contacts_updated BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- AUTO-CREATE PROFILE + PERSONAL TENANT ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_tenant_id UUID;
  user_display_name TEXT;
BEGIN
  user_display_name := COALESCE(
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  -- Create personal tenant
  INSERT INTO public.tenants (name, plan, monthly_send_limit)
  VALUES (user_display_name || '''s Workspace', 'free', 1000)
  RETURNING id INTO new_tenant_id;

  -- Create profile linked to tenant
  INSERT INTO public.profiles (id, tenant_id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    new_tenant_id,
    NEW.email,
    user_display_name,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Assign tenant_owner role for their workspace
  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (NEW.id, 'tenant_owner', new_tenant_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();