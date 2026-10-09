create or replace function public.sync_subscription_currency_from_solution()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
declare
  v_currency text;
  v_current_currency text;
  v_has_previous_items boolean;
begin
  if new.client_solution_id is null then return new; end if;

  select upper(pricing_snapshot->>'currency') into v_currency
  from public.client_solutions
  where id=new.client_solution_id;

  if v_currency is null or v_currency !~ '^[A-Z]{3}$' then
    raise exception 'invalid_or_missing_pricing_currency' using errcode='22023';
  end if;

  select currency into v_current_currency
  from public.subscriptions
  where id=new.subscription_id
  for update;

  select exists(
    select 1 from public.subscription_items
    where subscription_id=new.subscription_id and id<>new.id
  ) into v_has_previous_items;

  if v_has_previous_items and v_current_currency<>v_currency then
    raise exception 'subscription_currency_mismatch' using errcode='22000';
  end if;

  if v_current_currency<>v_currency then
    update public.subscriptions set currency=v_currency where id=new.subscription_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_subscription_currency_from_solution on public.subscription_items;
create trigger sync_subscription_currency_from_solution
after insert on public.subscription_items
for each row execute function public.sync_subscription_currency_from_solution();
