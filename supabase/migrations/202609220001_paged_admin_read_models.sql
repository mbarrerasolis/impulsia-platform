create index if not exists accounts_created_desc_idx
  on public.accounts(created_at desc, id desc);
create index if not exists leads_created_desc_idx
  on public.leads(created_at desc, id desc);
create index if not exists client_solutions_created_desc_idx
  on public.client_solutions(created_at desc, id desc);
create index if not exists conversations_last_message_desc_idx
  on public.conversations(last_message_at desc nulls last, created_at desc, id desc);
create index if not exists messages_conversation_sent_desc_idx
  on public.messages(conversation_id, sent_at desc)
  include (body);

create or replace function public.list_conversation_summaries_page(p_offset integer, p_limit integer)
returns table (
  id uuid,
  profile_name text,
  external_participant_id text,
  status text,
  last_message_at timestamptz,
  human_handoff_requested boolean,
  last_message text,
  total_count bigint
)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select
    c.id,
    c.profile_name,
    c.external_participant_id,
    c.status,
    c.last_message_at,
    c.human_handoff_requested,
    (
      select m.body
      from public.messages m
      where m.conversation_id=c.id and m.body is not null
      order by m.sent_at desc
      limit 1
    ) as last_message,
    count(*) over() as total_count
  from public.conversations c
  order by c.last_message_at desc nulls last, c.created_at desc, c.id desc
  offset greatest(p_offset,0)
  limit least(greatest(p_limit,1),100);
$$;

create or replace function public.list_account_summaries_page(p_offset integer, p_limit integer, p_search text)
returns table (
  id uuid,
  legal_name text,
  trade_name text,
  status public.account_status,
  industry text,
  contact_count bigint,
  active_solutions bigint,
  mrr bigint,
  total_count bigint
)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  with filtered as (
    select a.*, count(*) over() as total_count
    from public.accounts a
    where p_search is null
       or a.trade_name ilike '%' || p_search || '%'
       or a.legal_name ilike '%' || p_search || '%'
    order by a.created_at desc, a.id desc
    offset greatest(p_offset,0)
    limit least(greatest(p_limit,1),100)
  )
  select
    a.id,
    a.legal_name,
    a.trade_name,
    a.status,
    coalesce(a.industry,'Sin industria') as industry,
    (select count(*) from public.contacts c where c.account_id=a.id) as contact_count,
    (select count(*) from public.client_solutions cs where cs.account_id=a.id and cs.status<>'cancelled') as active_solutions,
    coalesce((
      select sum(si.net_amount)::bigint
      from public.subscriptions s
      join public.subscription_items si on si.subscription_id=s.id
      where s.account_id=a.id
        and s.status='active'
        and si.starts_at<=current_date
        and (si.ends_at is null or si.ends_at>=current_date)
    ),0)::bigint as mrr,
    a.total_count
  from filtered a
  order by a.created_at desc, a.id desc;
$$;

create or replace function public.list_solution_summaries_page(p_offset integer, p_limit integer)
returns table (
  id uuid,
  account_id uuid,
  account_name text,
  name text,
  status public.solution_status,
  estimated_days numeric,
  net_implementation_price bigint,
  net_maintenance_increment bigint,
  pricing_version text,
  created_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select
    cs.id,
    cs.account_id,
    a.trade_name as account_name,
    cs.name,
    cs.status,
    cs.estimated_days,
    cs.net_implementation_price,
    cs.net_maintenance_increment,
    coalesce(cs.pricing_snapshot->>'version','—') as pricing_version,
    cs.created_at,
    count(*) over() as total_count
  from public.client_solutions cs
  join public.accounts a on a.id=cs.account_id
  where cs.status<>'proposed'
  order by cs.created_at desc, cs.id desc
  offset greatest(p_offset,0)
  limit least(greatest(p_limit,1),100);
$$;

create or replace function public.list_billing_period_summaries_page(p_offset integer, p_limit integer)
returns table (
  id uuid,
  account_id uuid,
  account_name text,
  period_start date,
  period_end date,
  due_date date,
  amount_due bigint,
  amount_paid bigint,
  status public.billing_status,
  total_count bigint
)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select
    bp.id,
    s.account_id,
    a.trade_name as account_name,
    bp.period_start,
    bp.period_end,
    bp.due_date,
    bp.amount_due,
    bp.amount_paid,
    bp.status,
    count(*) over() as total_count
  from public.billing_periods bp
  join public.subscriptions s on s.id=bp.subscription_id
  join public.accounts a on a.id=s.account_id
  order by bp.due_date desc, bp.id desc
  offset greatest(p_offset,0)
  limit least(greatest(p_limit,1),100);
$$;

create or replace function public.get_dashboard_metrics()
returns table (
  current_mrr bigint,
  active_clients bigint,
  account_total bigint,
  expansion_mrr_this_month bigint,
  active_implementations bigint,
  receivable_amount bigint,
  overdue_amount bigint,
  overdue_periods bigint,
  blocked_tasks bigint,
  overdue_tasks bigint,
  new_leads bigint,
  lead_total bigint,
  sold_solutions_this_month bigint,
  billing_by_month jsonb,
  pipeline_counts jsonb
)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select
    coalesce((
      select sum(si.net_amount)::bigint
      from public.subscriptions s
      join public.subscription_items si on si.subscription_id=s.id
      where s.status='active'
        and si.starts_at<=current_date
        and (si.ends_at is null or si.ends_at>=current_date)
    ),0)::bigint,
    (select count(*) from public.accounts where status='active'),
    (select count(*) from public.accounts),
    coalesce((select sum(net_maintenance_increment)::bigint from public.client_solutions where status<>'cancelled' and created_at>=date_trunc('month',current_date)),0)::bigint,
    (select count(*) from public.client_solutions where status in ('approved','development','testing')),
    coalesce((select sum(greatest(amount_due-amount_paid,0))::bigint from public.billing_periods where status not in ('paid','void')),0)::bigint,
    coalesce((select sum(greatest(amount_due-amount_paid,0))::bigint from public.billing_periods where status='overdue'),0)::bigint,
    (select count(*) from public.billing_periods where status='overdue'),
    (select count(*) from public.implementation_tasks where status='blocked'),
    (select count(*) from public.implementation_tasks where status<>'done' and due_date<current_date),
    (select count(*) from public.leads where status='new'),
    (select count(*) from public.leads),
    (select count(*) from public.client_solutions where status<>'cancelled' and created_at>=date_trunc('month',current_date)),
    (
      select coalesce(jsonb_object_agg(month_key,amount order by month_key),'{}'::jsonb)
      from (
        select to_char(month_start,'YYYY-MM') as month_key, coalesce(sum(bp.amount_due) filter (where bp.status<>'void'),0)::bigint as amount
        from generate_series(date_trunc('month',current_date)-interval '5 months',date_trunc('month',current_date),interval '1 month') month_start
        left join public.billing_periods bp on date_trunc('month',bp.period_start)=month_start
        group by month_start
      ) months
    ),
    jsonb_build_object(
      'new',(select count(*) from public.leads where status='new'),
      'contacted',(select count(*) from public.leads where status='contacted'),
      'qualified',(select count(*) from public.leads where status='qualified'),
      'converted',(select count(*) from public.leads where status='converted'),
      'lost',(select count(*) from public.leads where status='lost')
    );
$$;

revoke execute on function public.list_conversation_summaries_page(integer,integer) from public,anon;
revoke execute on function public.list_account_summaries_page(integer,integer,text) from public,anon;
revoke execute on function public.list_solution_summaries_page(integer,integer) from public,anon;
revoke execute on function public.list_billing_period_summaries_page(integer,integer) from public,anon;
revoke execute on function public.get_dashboard_metrics() from public,anon;

grant execute on function public.list_conversation_summaries_page(integer,integer) to authenticated;
grant execute on function public.list_account_summaries_page(integer,integer,text) to authenticated;
grant execute on function public.list_solution_summaries_page(integer,integer) to authenticated;
grant execute on function public.list_billing_period_summaries_page(integer,integer) to authenticated;
grant execute on function public.get_dashboard_metrics() to authenticated;
