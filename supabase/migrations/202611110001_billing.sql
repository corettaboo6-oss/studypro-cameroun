-- LEGACY: ancien schéma direct MTN MoMo / Orange Money.
-- Ne pas exécuter pour le flux CinetPay actuel : utiliser supabase/schema.sql puis supabase/monetization.sql.
-- Conservé uniquement pour référence historique; aucune fonctionnalité active ne lit ces tables.
-- STUDYPRO billing schema — Supabase PostgreSQL
-- Run only after enabling Supabase Auth and reviewing policies for your project.
create extension if not exists pgcrypto;

create table if not exists public.billing_plans (
  code text primary key check (code in ('free','premium','premium_plus')),
  label text not null,
  amount_xaf integer not null check (amount_xaf >= 0),
  interval_unit text not null check (interval_unit in ('none','month')),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.billing_plans (code,label,amount_xaf,interval_unit)
values
 ('free','Gratuit',0,'none'),
 ('premium','Premium',1500,'month'),
 ('premium_plus','Premium Plus',3000,'month')
on conflict (code) do update set
 label=excluded.label,
 amount_xaf=excluded.amount_xaf,
 interval_unit=excluded.interval_unit,
 updated_at=now();

create table if not exists public.billing_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  plan_code text not null references public.billing_plans(code),
  provider text not null check (provider in ('mtn_momo','orange_money')),
  provider_reference text,
  amount_xaf integer not null check (amount_xaf > 0),
  currency text not null default 'XAF' check (currency = 'XAF'),
  status text not null default 'pending' check (status in ('pending','processing','succeeded','failed','cancelled','refunded','expired')),
  idempotency_key uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique(provider, provider_reference)
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  plan_code text not null references public.billing_plans(code),
  status text not null check (status in ('active','past_due','cancelled','expired')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  last_payment_id uuid references public.billing_payments(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists billing_payments_user_created_idx
  on public.billing_payments(user_id, created_at desc);
create index if not exists billing_subscriptions_user_status_idx
  on public.billing_subscriptions(user_id, status, ends_at desc);

alter table public.billing_plans enable row level security;
alter table public.billing_payments enable row level security;
alter table public.billing_subscriptions enable row level security;

-- Plans may be read by visitors; writes are server/admin only.
drop policy if exists "Public can read active plans" on public.billing_plans;
create policy "Public can read active plans"
  on public.billing_plans for select using (active = true);

-- Users can read only their own payment history and subscriptions.
-- No client-side insert/update/delete policies are intentionally provided.
drop policy if exists "Users read own payments" on public.billing_payments;
create policy "Users read own payments"
  on public.billing_payments for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users read own subscriptions" on public.billing_subscriptions;
create policy "Users read own subscriptions"
  on public.billing_subscriptions for select to authenticated
  using (auth.uid() = user_id);

-- Service role operations must run only in trusted server functions.
-- Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.

-- Explicit client privileges: read-only from the browser.
grant select on public.billing_plans to anon, authenticated;
grant select on public.billing_payments to authenticated;
grant select on public.billing_subscriptions to authenticated;

-- No INSERT, UPDATE or DELETE grants are given to anon/authenticated.
-- Trusted server functions use the service role after verifying the user's JWT.
