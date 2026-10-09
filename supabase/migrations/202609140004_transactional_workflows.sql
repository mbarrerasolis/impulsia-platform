create or replace function public.convert_lead_to_account(p_lead_id uuid,p_industry text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_lead public.leads%rowtype;
  v_account_id uuid;
  v_contact_id uuid;
  v_first_name text;
  v_last_name text;
begin
  if coalesce(public.current_role() in ('owner_admin','sales'),false)=false then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select * into v_lead from public.leads where id=p_lead_id for update;
  if not found then raise exception 'lead_not_found' using errcode='P0002'; end if;
  if v_lead.status='converted' or v_lead.converted_account_id is not null then
    raise exception 'lead_already_converted' using errcode='23505';
  end if;
  if length(trim(coalesce(p_industry,'')))<2 then raise exception 'invalid_industry' using errcode='22023'; end if;

  insert into public.accounts(legal_name,trade_name,industry,status)
  values(v_lead.company,v_lead.company,trim(p_industry),'prospect') returning id into v_account_id;
  v_first_name=split_part(trim(v_lead.name),' ',1);
  v_last_name=trim(substr(trim(v_lead.name),length(v_first_name)+1));
  if v_last_name='' then v_last_name='Contacto'; end if;
  insert into public.contacts(account_id,first_name,last_name,email,phone,job_title)
  values(v_account_id,v_first_name,v_last_name,v_lead.email,v_lead.phone,'Contacto principal') returning id into v_contact_id;
  insert into public.contact_roles(contact_id,role) values(v_contact_id,'commercial'),(v_contact_id,'management');
  update public.leads set status='converted',converted_account_id=v_account_id where id=v_lead.id;
  insert into public.audit_log(actor_user_id,account_id,entity_type,entity_id,action,before_data,after_data)
  values(auth.uid(),v_account_id,'lead',v_lead.id::text,'lead.converted',jsonb_build_object('status',v_lead.status),jsonb_build_object('status','converted','accountId',v_account_id));
  return jsonb_build_object('accountId',v_account_id,'contactId',v_contact_id);
end;
$$;

create or replace function public.approve_quote_transaction(p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  q public.quotes%rowtype;
  v_active_count integer;
  v_solution_id uuid;
  v_subscription_id uuid;
  v_billing_day integer;
  v_item_ids uuid[]='{}';
  v_item_id uuid;
  v_cost jsonb;
  v_period_id uuid;
  v_period_status public.billing_status;
  v_period_start date;
  v_period_end date;
  v_due_date date;
  v_amount_due bigint;
  v_offset integer;
  v_template text;
begin
  if coalesce(public.current_role() in ('owner_admin','sales'),false)=false then
    raise exception 'forbidden' using errcode='42501';
  end if;
  select * into q from public.quotes where id=p_quote_id for update;
  if not found then raise exception 'quote_not_found' using errcode='P0002'; end if;
  if q.status<>'draft' then raise exception 'quote_already_processed' using errcode='23505'; end if;

  select count(*) into v_active_count from public.client_solutions
  where account_id=q.account_id and status<>'cancelled';
  if q.active_solutions_after_addition<>v_active_count+1 then
    raise exception 'account_solution_count_changed_requote_required' using errcode='40001';
  end if;

  insert into public.client_solutions(account_id,quote_id,name,status,start_date,estimated_days,complexity_factor,
    day_rate_snapshot,gross_implementation_price,expansion_discount_percent,net_implementation_price,
    gross_maintenance_increment,maintenance_discount_percent,net_maintenance_increment,pricing_snapshot,owner_user_id)
  values(q.account_id,q.id,q.name,'approved',current_date,q.estimated_days,q.complexity_factor,q.day_rate_snapshot,
    q.gross_implementation_price,q.expansion_discount_percent,q.net_implementation_price,q.gross_maintenance_increment,
    q.maintenance_discount_percent,q.net_maintenance_increment,q.pricing_snapshot,auth.uid()) returning id into v_solution_id;

  select id,billing_day into v_subscription_id,v_billing_day from public.subscriptions
  where account_id=q.account_id and status='active' order by created_at limit 1 for update;
  if v_subscription_id is null then
    insert into public.subscriptions(account_id,status,billing_day,currency,started_at)
    values(q.account_id,'active',20,'CLP',current_date) returning id,billing_day into v_subscription_id,v_billing_day;
  end if;

  insert into public.subscription_items(subscription_id,client_solution_id,type,name,quantity,unit_amount,discount_percent,net_amount,third_party,starts_at)
  values(v_subscription_id,v_solution_id,'maintenance','Mantención · '||q.name,1,q.gross_maintenance_increment,
    q.maintenance_discount_percent,q.net_maintenance_increment,false,current_date) returning id into v_item_id;
  v_item_ids=array_append(v_item_ids,v_item_id);

  for v_cost in select value from jsonb_array_elements(q.third_party_costs) loop
    insert into public.third_party_cost_items(client_solution_id,provider,description,cost,currency,periodicity,paid_by,markup_percent,starts_at)
    values(v_solution_id,v_cost->>'provider',v_cost->>'description',(v_cost->>'cost')::numeric,v_cost->>'currency',
      v_cost->>'periodicity',v_cost->>'paidBy',coalesce((v_cost->>'markupPercent')::numeric,0),current_date);
    if v_cost->>'periodicity'='monthly' and v_cost->>'paidBy'='rebilled' then
      insert into public.subscription_items(subscription_id,client_solution_id,type,name,quantity,unit_amount,discount_percent,net_amount,third_party,starts_at,metadata)
      values(v_subscription_id,v_solution_id,'third_party',(v_cost->>'provider')||' · '||(v_cost->>'description'),1,
        (v_cost->>'cost')::bigint,0,(v_cost->>'cost')::bigint,true,current_date,v_cost) returning id into v_item_id;
      v_item_ids=array_append(v_item_ids,v_item_id);
    end if;
  end loop;

  v_period_start=date_trunc('month',current_date)::date;
  v_period_end=(v_period_start+interval '1 month - 1 day')::date;
  select id,status into v_period_id,v_period_status from public.billing_periods
  where subscription_id=v_subscription_id and period_start=v_period_start for update;
  if v_period_id is not null and v_period_status in ('paid','void') then
    v_period_start=(v_period_start+interval '1 month')::date;
    v_period_end=(v_period_start+interval '1 month - 1 day')::date;
    v_period_id=null;
    select id,status into v_period_id,v_period_status from public.billing_periods
    where subscription_id=v_subscription_id and period_start=v_period_start for update;
  end if;
  v_due_date=make_date(extract(year from v_period_start)::int,extract(month from v_period_start)::int,v_billing_day);
  select coalesce(sum(net_amount),0)::bigint into v_amount_due from public.subscription_items
  where subscription_id=v_subscription_id and starts_at<=v_period_end and (ends_at is null or ends_at>=v_period_start);

  if v_period_id is null then
    insert into public.billing_periods(subscription_id,period_start,period_end,due_date,amount_due,amount_paid,status,pricing_snapshot)
    values(v_subscription_id,v_period_start,v_period_end,v_due_date,v_amount_due,0,'pending',
      jsonb_build_object('subscriptionItemIds',(select jsonb_agg(id) from public.subscription_items where subscription_id=v_subscription_id),'generatedAt',now()))
    returning id into v_period_id;
    foreach v_offset in array array[-5,-1,0,3,7,15] loop
      v_template=case v_offset when -5 then 'upcoming_payment' when -1 then 'upcoming_payment' when 0 then 'due_today' when 3 then 'overdue_3' when 7 then 'overdue_7' else 'manual_alert' end;
      insert into public.payment_reminders(billing_period_id,scheduled_at,channel,template_key,status,contact_id)
      values(v_period_id,v_due_date::timestamptz+v_offset*interval '1 day','email',v_template,'scheduled',
        (select contacts.id from public.contacts
         where contacts.account_id=q.account_id
           and contacts.is_active
           and exists (
             select 1 from public.contact_roles
             where contact_roles.contact_id=contacts.id and contact_roles.role='billing'
           )
         order by contacts.is_primary_billing desc
         limit 1));
    end loop;
  else
    update public.billing_periods set amount_due=v_amount_due,
      pricing_snapshot=jsonb_build_object('subscriptionItemIds',(select jsonb_agg(id) from public.subscription_items where subscription_id=v_subscription_id),'generatedAt',now())
    where id=v_period_id;
  end if;

  update public.quotes set status='approved',approved_at=now() where id=q.id;
  update public.accounts set status='active' where id=q.account_id;
  insert into public.audit_log(actor_user_id,account_id,entity_type,entity_id,action,before_data,after_data)
  values(auth.uid(),q.account_id,'quote',q.id::text,'quote.approved',jsonb_build_object('status','draft'),
    jsonb_build_object('status','approved','solutionId',v_solution_id,'subscriptionId',v_subscription_id,'billingPeriodId',v_period_id));
  return jsonb_build_object('solutionId',v_solution_id,'subscriptionId',v_subscription_id,'billingPeriodId',v_period_id,'amountDue',v_amount_due);
end;
$$;

create or replace function public.process_payment_event_transaction(
  p_provider text,p_external_event_id text,p_external_payment_id text,p_status public.payment_status,
  p_amount bigint,p_currency text,p_normalized_payload jsonb default '{}')
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_payment public.payments%rowtype;
  v_period public.billing_periods%rowtype;
  v_event_id uuid;
  v_cancelled integer=0;
  v_account_id uuid;
begin
  select * into v_payment from public.payments where provider=p_provider and external_payment_id=p_external_payment_id for update;
  if not found then raise exception 'payment_not_found' using errcode='P0002'; end if;
  select * into v_period from public.billing_periods where id=v_payment.billing_period_id for update;
  select account_id into v_account_id from public.subscriptions where id=v_period.subscription_id;
  if p_amount<>v_payment.amount or p_amount<>v_period.amount_due or p_currency<>v_payment.currency then
    raise exception 'payment_amount_or_currency_mismatch' using errcode='22000';
  end if;
  insert into public.payment_events(provider,external_event_id,payment_id,normalized_payload)
  values(p_provider,p_external_event_id,v_payment.id,p_normalized_payload)
  on conflict(provider,external_event_id) do nothing returning id into v_event_id;
  if v_event_id is null then return jsonb_build_object('idempotent',true,'cancelledReminders',0); end if;

  if p_status='approved' and v_payment.status in ('pending','rejected') then
    update public.payments set status='approved',paid_at=now(),raw_provider_payload=p_normalized_payload where id=v_payment.id;
    update public.billing_periods set status='paid',amount_paid=amount_due where id=v_period.id;
    update public.payment_reminders set status='cancelled',cancelled_at=now()
    where billing_period_id=v_period.id and status='scheduled';
    get diagnostics v_cancelled=row_count;
  elsif p_status='rejected' and v_payment.status='pending' then
    update public.payments set status='rejected',raw_provider_payload=p_normalized_payload where id=v_payment.id;
  elsif p_status='refunded' and v_payment.status='approved' then
    update public.payments set status='refunded',raw_provider_payload=p_normalized_payload where id=v_payment.id;
  elsif p_status='cancelled' and v_payment.status in ('pending','rejected') then
    update public.payments set status='cancelled',raw_provider_payload=p_normalized_payload where id=v_payment.id;
  elsif p_status<>v_payment.status then
    raise exception 'invalid_payment_transition' using errcode='22000';
  end if;
  insert into public.audit_log(account_id,entity_type,entity_id,action,before_data,after_data)
  values(v_account_id,'payment',v_payment.id::text,'payment.'||p_status,
    jsonb_build_object('status',v_payment.status),jsonb_build_object('status',p_status,'amount',p_amount,'cancelledReminders',v_cancelled));
  return jsonb_build_object('idempotent',false,'paymentId',v_payment.id,'cancelledReminders',v_cancelled);
end;
$$;

create or replace function public.list_portal_solutions()
returns table(id uuid,account_id uuid,name text,status public.solution_status,estimated_days numeric)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select s.id,s.account_id,s.name,s.status,s.estimated_days
  from public.client_solutions s
  where s.account_id=public.current_account_id()
    and public.current_role() in ('client_admin','client_technical','client_viewer')
  order by s.created_at desc
$$;

revoke all on function public.convert_lead_to_account(uuid,text) from public,anon;
revoke all on function public.approve_quote_transaction(uuid) from public,anon;
revoke all on function public.process_payment_event_transaction(text,text,text,public.payment_status,bigint,text,jsonb) from public,anon,authenticated;
revoke all on function public.list_portal_solutions() from public,anon;
grant execute on function public.convert_lead_to_account(uuid,text) to authenticated;
grant execute on function public.approve_quote_transaction(uuid) to authenticated;
grant execute on function public.process_payment_event_transaction(text,text,text,public.payment_status,bigint,text,jsonb) to service_role;
grant execute on function public.list_portal_solutions() to authenticated;
