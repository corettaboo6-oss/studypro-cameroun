-- STUDYPRO CAMEROUN — abonnements et paiements CinetPay
-- À exécuter après supabase/schema.sql dans le SQL Editor Supabase.

create table if not exists public.studypro_payment_orders (
  merchant_transaction_id text primary key check (char_length(merchant_transaction_id) between 8 and 40),
  provider_transaction_id text unique,
  payment_token text,
  notify_token text,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('premium','premium_plus')),
  amount integer not null check (amount in (2000,3500)),
  currency text not null default 'XAF' check (currency = 'XAF'),
  status text not null default 'pending' check (status in ('pending','succeeded','failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create table if not exists public.studypro_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check (plan in ('free','premium','premium_plus')),
  status text not null default 'active' check (status in ('active','expired','cancelled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  last_payment_id text references public.studypro_payment_orders(merchant_transaction_id),
  updated_at timestamptz not null default now()
);
alter table public.studypro_payment_orders enable row level security;
alter table public.studypro_subscriptions enable row level security;
revoke all on public.studypro_payment_orders from anon, authenticated;
revoke all on public.studypro_subscriptions from anon, authenticated;

-- Tous les traitements d'argent sont déclenchés uniquement par le backend avec la clé service-role.
create or replace function public.studypro_activate_subscription(
  p_merchant_transaction_id text,
  p_provider_transaction_id text,
  p_user_id uuid,
  p_plan text,
  p_amount integer,
  p_currency text
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_order public.studypro_payment_orders%rowtype;
  v_end timestamptz;
begin
  select * into v_order from public.studypro_payment_orders
    where merchant_transaction_id = p_merchant_transaction_id for update;
  if not found then raise exception 'Payment order not found'; end if;
  if v_order.user_id <> p_user_id or v_order.plan <> p_plan
     or v_order.amount <> p_amount or v_order.currency <> p_currency
     or v_order.provider_transaction_id <> p_provider_transaction_id then
    raise exception 'Payment details mismatch';
  end if;
  if v_order.status = 'succeeded' then
    return jsonb_build_object('activated', false, 'already_processed', true);
  end if;
  if v_order.status <> 'pending' then raise exception 'Payment is not pending'; end if;

  update public.studypro_payment_orders set status='succeeded', paid_at=now()
    where merchant_transaction_id=p_merchant_transaction_id;

  insert into public.studypro_subscriptions(
    user_id, plan, status, current_period_start, current_period_end, last_payment_id, updated_at
  ) values (
    p_user_id, p_plan, 'active', now(), now() + interval '30 days',
    p_merchant_transaction_id, now()
  )
  on conflict(user_id) do update set
    plan=excluded.plan,
    status='active',
    current_period_start=case
      when studypro_subscriptions.status='active' and studypro_subscriptions.current_period_end>now()
      then studypro_subscriptions.current_period_start
      else now()
    end,
    current_period_end=greatest(
      coalesce(studypro_subscriptions.current_period_end,now()),
      now()
    ) + interval '30 days',
    last_payment_id=excluded.last_payment_id,
    updated_at=now();

  return jsonb_build_object('activated', true, 'plan', p_plan);
end;
$$;
revoke all on function public.studypro_activate_subscription(text,text,uuid,text,integer,text) from public, anon, authenticated;
grant execute on function public.studypro_activate_subscription(text,text,uuid,text,integer,text) to service_role;

-- Les abonnements expirés ne donnent plus accès aux contenus Premium.
create or replace function public.studypro_get_my_subscription()
returns table(plan text,status text,current_period_end timestamptz)
language sql stable security definer set search_path=public as $$
  select s.plan,
    case when s.status='active' and s.current_period_end>now() then 'active' else 'expired' end,
    s.current_period_end
  from public.studypro_subscriptions s
  where s.user_id=auth.uid()
  limit 1;
$$;
revoke all on function public.studypro_get_my_subscription() from public, anon;
grant execute on function public.studypro_get_my_subscription() to authenticated;

-- Contenus Premium : conservés côté serveur et servis uniquement après contrôle d'abonnement.
create table if not exists public.studypro_premium_content (
  content_key text primary key,
  title text not null,
  required_plan text not null check (required_plan in ('premium','premium_plus')),
  body jsonb not null,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.studypro_premium_content enable row level security;
revoke all on public.studypro_premium_content from anon, authenticated;

-- Agrégats complets du tableau de bord administrateur (pas de limite arbitraire de 1 000 lignes).
create or replace function public.studypro_admin_revenue_summary()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'total_xaf', coalesce(sum(amount) filter (where status='succeeded'),0),
    'successful_payments', count(*) filter (where status='succeeded'),
    'pending_payments', count(*) filter (where status='pending'),
    'by_plan', coalesce((
      select jsonb_object_agg(plan, n) from (
        select plan, count(*) as n from public.studypro_payment_orders
        where status='succeeded' group by plan
      ) grouped
    ), '{}'::jsonb)
  )
  from public.studypro_payment_orders;
$$;
revoke all on function public.studypro_admin_revenue_summary() from public, anon, authenticated;
grant execute on function public.studypro_admin_revenue_summary() to service_role;
