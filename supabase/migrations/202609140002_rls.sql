create or replace function public.current_role() returns public.app_role language sql stable security definer set search_path=public as $$
  select role from public.profiles where id = auth.uid()
$$;
create or replace function public.current_account_id() returns uuid language sql stable security definer set search_path=public as $$
  select account_id from public.profiles where id = auth.uid()
$$;
create or replace function public.is_internal() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(public.current_role() in ('owner_admin','sales','technical','finance','support'),false)
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(public.current_role() = 'owner_admin',false)
$$;

revoke all on function public.current_role() from public;
revoke all on function public.current_account_id() from public;
revoke all on function public.is_internal() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.current_role(),public.current_account_id(),public.is_internal(),public.is_admin() to authenticated;

alter table public.accounts enable row level security;
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_roles enable row level security;
alter table public.leads enable row level security;
alter table public.opportunities enable row level security;
alter table public.activities enable row level security;
alter table public.solution_catalog enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.client_solutions enable row level security;
alter table public.implementation_tasks enable row level security;
alter table public.third_party_cost_items enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_items enable row level security;
alter table public.billing_periods enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.payment_reminders enable row level security;
alter table public.channels enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.integrations enable row level security;
alter table public.credential_metadata enable row level security;
alter table public.audit_log enable row level security;
alter table public.marketing_spend enable row level security;

create policy accounts_internal_all on public.accounts for all to authenticated using(public.is_internal()) with check(public.is_internal());
create policy accounts_client_read on public.accounts for select to authenticated using(id=public.current_account_id());
create policy profiles_self_read on public.profiles for select to authenticated using(id=auth.uid());
create policy profiles_admin_all on public.profiles for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy contacts_internal_all on public.contacts for all to authenticated using(public.is_internal()) with check(public.is_internal());
create policy contacts_client_read on public.contacts for select to authenticated using(account_id=public.current_account_id() and public.current_role() in ('client_admin','client_technical'));
create policy contact_roles_internal_all on public.contact_roles for all to authenticated using(public.is_internal()) with check(public.is_internal());
create policy contact_roles_client_read on public.contact_roles for select to authenticated using(exists(select 1 from public.contacts c where c.id=contact_id and c.account_id=public.current_account_id()) and public.current_role()='client_admin');
create policy leads_public_insert on public.leads for insert to anon,authenticated with check(consent_given=true and source='web' and owner_user_id is null and converted_account_id is null);
create policy leads_internal_all on public.leads for all to authenticated using(public.is_internal()) with check(public.is_internal());
create policy opportunities_internal_all on public.opportunities for all to authenticated using(public.is_internal()) with check(public.is_internal());
create policy activities_internal_all on public.activities for all to authenticated using(public.is_internal()) with check(public.is_internal());
create policy catalog_authenticated_read on public.solution_catalog for select to authenticated using(active or public.is_internal());
create policy catalog_admin_write on public.solution_catalog for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy pricing_authenticated_read on public.pricing_rules for select to authenticated using(published_at is not null or public.is_admin());
create policy pricing_admin_write on public.pricing_rules for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy solutions_internal_all on public.client_solutions for all to authenticated using(public.is_internal()) with check(public.is_internal());
create policy solutions_client_read on public.client_solutions for select to authenticated using(account_id=public.current_account_id() and public.current_role()='client_admin');
create policy tasks_internal_all on public.implementation_tasks for all to authenticated using(public.is_internal()) with check(public.is_internal());
create policy tasks_client_read on public.implementation_tasks for select to authenticated using(exists(select 1 from public.client_solutions s where s.id=client_solution_id and s.account_id=public.current_account_id()) and public.current_role() in ('client_admin','client_technical','client_viewer'));
create policy third_party_internal_all on public.third_party_cost_items for all to authenticated using(public.is_internal()) with check(public.is_internal());
create policy third_party_client_read on public.third_party_cost_items for select to authenticated using(exists(select 1 from public.client_solutions s where s.id=client_solution_id and s.account_id=public.current_account_id()) and public.current_role()='client_admin');
create policy subscriptions_internal_all on public.subscriptions for all to authenticated using(public.is_internal()) with check(public.is_internal());
create policy subscriptions_client_read on public.subscriptions for select to authenticated using(account_id=public.current_account_id() and public.current_role() in ('client_admin','client_billing'));
create policy subscription_items_internal_all on public.subscription_items for all to authenticated using(public.is_internal()) with check(public.is_internal());
create policy subscription_items_client_read on public.subscription_items for select to authenticated using(exists(select 1 from public.subscriptions s where s.id=subscription_id and s.account_id=public.current_account_id()) and public.current_role() in ('client_admin','client_billing'));
create policy billing_internal_all on public.billing_periods for all to authenticated using(public.is_internal()) with check(public.is_internal());
create policy billing_client_read on public.billing_periods for select to authenticated using(exists(select 1 from public.subscriptions s where s.id=subscription_id and s.account_id=public.current_account_id()) and public.current_role() in ('client_admin','client_billing'));
create policy invoice_internal_all on public.invoices for all to authenticated using(public.is_internal()) with check(public.is_internal());
create policy invoice_client_read on public.invoices for select to authenticated using(exists(select 1 from public.billing_periods b join public.subscriptions s on s.id=b.subscription_id where b.id=billing_period_id and s.account_id=public.current_account_id()) and public.current_role() in ('client_admin','client_billing'));
create policy payment_internal_read on public.payments for select to authenticated using(public.is_internal());
create policy payment_client_read on public.payments for select to authenticated using(exists(select 1 from public.billing_periods b join public.subscriptions s on s.id=b.subscription_id where b.id=billing_period_id and s.account_id=public.current_account_id()) and public.current_role() in ('client_admin','client_billing'));
create policy reminder_internal_all on public.payment_reminders for all to authenticated using(public.is_internal()) with check(public.is_internal());
create policy channels_internal_all on public.channels for all to authenticated using(public.is_internal()) with check(public.is_internal());
create policy conversations_internal_all on public.conversations for all to authenticated using(public.is_internal()) with check(public.is_internal());
create policy conversations_client_read on public.conversations for select to authenticated using(account_id=public.current_account_id() and public.current_role() in ('client_admin','client_technical'));
create policy messages_internal_all on public.messages for all to authenticated using(public.is_internal()) with check(public.is_internal());
create policy messages_client_read on public.messages for select to authenticated using(exists(select 1 from public.conversations c where c.id=conversation_id and c.account_id=public.current_account_id()) and public.current_role() in ('client_admin','client_technical'));
create policy integrations_internal_read on public.integrations for select to authenticated using(public.is_internal());
create policy integrations_technical_write on public.integrations for all to authenticated using(public.current_role() in ('owner_admin','technical')) with check(public.current_role() in ('owner_admin','technical'));
create policy integrations_client_read on public.integrations for select to authenticated using(account_id=public.current_account_id() and public.current_role() in ('client_admin','client_technical'));
create policy credentials_authorized_only on public.credential_metadata for all to authenticated using(public.current_role() in ('owner_admin','technical')) with check(public.current_role() in ('owner_admin','technical'));
create policy audit_authorized_read on public.audit_log for select to authenticated using(public.current_role() in ('owner_admin','finance'));
create policy marketing_internal_read on public.marketing_spend for select to authenticated using(public.is_internal());
create policy marketing_admin_write on public.marketing_spend for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- Payment mutation and provider events deliberately have no client policies.
-- Only trusted server-side service-role handlers may write them after validating provider signatures and amounts.
