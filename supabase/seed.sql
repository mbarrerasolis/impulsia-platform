insert into public.pricing_rules(version,day_rate,min_implementation,min_maintenance,complexity_tiers,maintenance_brackets,expansion_discount_tiers,rounding_multiple,effective_from,published_at)
values ('2026-09-v1',200000,200000,65000,
  '{"standard":1,"medium":1.2,"high":1.5,"research":1.75,"advanced_research":2}',
  '[{"upTo":400000,"ratePercent":20,"floor":65000},{"upTo":1000000,"ratePercent":17.5,"floor":80000},{"upTo":2000000,"ratePercent":15,"floor":175000},{"upTo":4000000,"ratePercent":12,"floor":300000},{"upTo":null,"ratePercent":10,"floor":480000}]',
  '[{"fromSolution":1,"discountPercent":0},{"fromSolution":2,"discountPercent":25},{"fromSolution":3,"discountPercent":30},{"fromSolution":4,"discountPercent":35},{"fromSolution":5,"discountPercent":40}]',
  1000,'2026-09-01',now());

insert into public.accounts(id,legal_name,trade_name,industry,status) values
('10000000-0000-0000-0000-000000000001','Andina Logística SpA','Andina Logística','Logística','active'),
('10000000-0000-0000-0000-000000000002','Servicios NorteSalud Ltda.','NorteSalud','Salud','active'),
('10000000-0000-0000-0000-000000000003','Cobalto Arquitectura SpA','Estudio Cobalto','Arquitectura','prospect'),
('10000000-0000-0000-0000-000000000004','Comercial Litoral SpA','Mercado Litoral','Retail','active'),
('10000000-0000-0000-0000-000000000005','Agrícola Roble Sur Ltda.','Agrícola Roble','Agricultura','paused');

insert into public.contacts(account_id,first_name,last_name,email,job_title,is_primary_billing) values
('10000000-0000-0000-0000-000000000001','Camila','Rojas','camila@andina.example','Gerenta de Operaciones',false),
('10000000-0000-0000-0000-000000000001','Diego','Silva','diego@andina.example','Jefe de TI',false),
('10000000-0000-0000-0000-000000000001','Elena','Mora','elena@andina.example','Administración',true),
('10000000-0000-0000-0000-000000000002','Martín','Leiva','martin@nortesalud.example','Director',false),
('10000000-0000-0000-0000-000000000002','Josefina','Reyes','josefina@nortesalud.example','Finanzas',true);

insert into public.leads(source,name,company,email,raw_need_description,systems,api_knowledge,primary_goal,consent_given,status,score)
select (array['web','instagram','referral','outbound','email'])[1+(n%5)], 'Contacto Demo '||n, 'Empresa Demo '||n,
  'contacto'||n||'@example.com','Necesita automatizar un proceso repetitivo de traspaso y validación de información.',array['ERP','Email'],'unknown',
  'Ahorrar tiempo operativo',true,(array['new','contacted','qualified'])[1+(n%3)],35+n*5 from generate_series(1,10) n;

insert into public.solution_catalog(name,category,description,default_days,default_complexity,reusable_template_key) values
('Sincronización ERP + ecommerce','Integraciones','Sincroniza pedidos, stock y estados.',4,'medium','erp-ecommerce'),
('Conciliación automática','Finanzas','Compara pagos, documentos y movimientos.',5,'high','payment-reconciliation'),
('Reporte operativo diario','Datos','Consolida y distribuye indicadores.',2,'standard','daily-report');

insert into public.contact_roles(contact_id,role)
select id,case when is_primary_billing then 'billing' else 'commercial' end from public.contacts;

insert into public.opportunities(account_id,contact_id,stage,title,problem_summary,expected_value,probability,expected_close_date,next_action,next_action_at)
select a.id,c.id,(array['diagnosis','proposal_sent','negotiation','won'])[1+(row_number() over(order by a.id)::int%4)],
  'Automatización prioritaria','Reducir trabajo manual entre sistemas.',400000+(row_number() over(order by a.id))*150000,
  25+(row_number() over(order by a.id))*15,current_date+((row_number() over(order by a.id))*7)::int,
  'Validar alcance con cliente',now()+((row_number() over(order by a.id))*2||' days')::interval
from public.accounts a left join lateral(select id from public.contacts where account_id=a.id limit 1)c on true;

insert into public.client_solutions(account_id,name,problem_statement,scope,status,start_date,go_live_date,estimated_days,actual_days,
  complexity_factor,day_rate_snapshot,gross_implementation_price,expansion_discount_percent,net_implementation_price,
  gross_maintenance_increment,maintenance_discount_percent,net_maintenance_increment,pricing_snapshot)
select account_id,'Módulo '||module_number,'Eliminar tareas manuales repetitivas.','Integración y automatización acotada.','production',
  date '2026-01-01'+(module_number*20),date '2026-02-01'+(module_number*20),2+module_number,2+module_number,
  1.2,200000,(2+module_number)*240000,
  case module_number when 1 then 0 when 2 then 25 when 3 then 30 when 4 then 35 else 40 end,
  round((2+module_number)*240000*(1-(case module_number when 1 then 0 when 2 then 25 when 3 then 30 when 4 then 35 else 40 end)/100.0)),
  65000+module_number*30000,
  case module_number when 1 then 0 when 2 then 25 when 3 then 30 when 4 then 35 else 40 end,
  round((65000+module_number*30000)*(1-(case module_number when 1 then 0 when 2 then 25 when 3 then 30 when 4 then 35 else 40 end)/100.0)),
  jsonb_build_object(
    'version','2026-09-v1',
    'effectiveFrom','2026-09-01',
    'currency','CLP',
    'dayRate',200000,
    'minimumImplementation',200000,
    'minimumMaintenance',65000,
    'roundingMultiple',1000,
    'complexityFactors',jsonb_build_object(
      'standard',1,
      'medium',1.2,
      'high',1.5,
      'research',1.75,
      'advanced_research',2
    ),
    'maintenanceBrackets','[{"upTo":400000,"ratePercent":20,"floor":65000},{"upTo":1000000,"ratePercent":17.5,"floor":80000},{"upTo":2000000,"ratePercent":15,"floor":175000},{"upTo":4000000,"ratePercent":12,"floor":300000},{"upTo":null,"ratePercent":10,"floor":480000}]'::jsonb,
    'expansionDiscountTiers','[{"fromSolution":1,"discountPercent":0},{"fromSolution":2,"discountPercent":25},{"fromSolution":3,"discountPercent":30},{"fromSolution":4,"discountPercent":35},{"fromSolution":5,"discountPercent":40}]'::jsonb
  )
from (values
  ('10000000-0000-0000-0000-000000000001'::uuid,1),('10000000-0000-0000-0000-000000000001'::uuid,2),('10000000-0000-0000-0000-000000000001'::uuid,3),
  ('10000000-0000-0000-0000-000000000002'::uuid,1),('10000000-0000-0000-0000-000000000002'::uuid,2),
  ('10000000-0000-0000-0000-000000000004'::uuid,1),('10000000-0000-0000-0000-000000000004'::uuid,2),('10000000-0000-0000-0000-000000000004'::uuid,3),('10000000-0000-0000-0000-000000000004'::uuid,4),('10000000-0000-0000-0000-000000000004'::uuid,5),
  ('10000000-0000-0000-0000-000000000005'::uuid,1)
) as modules(account_id,module_number);

insert into public.subscriptions(account_id,status,billing_day,currency,started_at)
select id,case when status='paused' then 'paused' else 'active' end,20,'CLP','2026-01-01'
from public.accounts where status in ('active','paused');

insert into public.subscription_items(subscription_id,client_solution_id,type,name,quantity,unit_amount,discount_percent,net_amount,third_party,starts_at)
select sub.id,sol.id,'maintenance','Mantención · '||sol.name,1,sol.gross_maintenance_increment,
  sol.maintenance_discount_percent,sol.net_maintenance_increment,false,coalesce(sol.go_live_date,sol.start_date)
from public.client_solutions sol join public.subscriptions sub on sub.account_id=sol.account_id;

insert into public.subscription_items(subscription_id,type,name,quantity,unit_amount,discount_percent,net_amount,third_party,starts_at,metadata)
select id,'third_party','Servidor dedicado demo',1,45000,0,45000,true,'2026-03-01','{"provider":"Hosting Demo","paidBy":"rebilled"}'
from public.subscriptions where account_id='10000000-0000-0000-0000-000000000004';

insert into public.billing_periods(subscription_id,period_start,period_end,due_date,amount_due,amount_paid,status,pricing_snapshot)
select sub.id,period_start,period_end,due_date,
  (select coalesce(sum(net_amount),0) from public.subscription_items item where item.subscription_id=sub.id and item.starts_at<=period_end),
  case when state='paid' then (select coalesce(sum(net_amount),0) from public.subscription_items item where item.subscription_id=sub.id and item.starts_at<=period_end) else 0 end,
  state::public.billing_status,jsonb_build_object(
    'subscriptionItemIds',(
      select coalesce(jsonb_agg(item.id), '[]'::jsonb)
      from public.subscription_items item
      where item.subscription_id=sub.id and item.starts_at<=period_end
    ),
    'generatedAt','2026-09-01T00:00:00Z'
  )
from public.subscriptions sub cross join (values
  (date '2026-07-01',date '2026-07-31',date '2026-07-20','paid'),
  (date '2026-08-01',date '2026-08-31',date '2026-08-20','overdue'),
  (date '2026-09-01',date '2026-09-30',date '2026-09-20','pending')
) as periods(period_start,period_end,due_date,state);

insert into public.payments(billing_period_id,provider,external_payment_id,amount,currency,status,paid_at,raw_provider_payload)
select id,'mock','seed-payment-'||id,amount_due,'CLP','approved',due_date::timestamptz,'{"seed":true}'
from public.billing_periods where status='paid';

insert into public.payment_reminders(billing_period_id,scheduled_at,channel,template_key,status,contact_id)
select bp.id,bp.due_date::timestamptz+offset_days*interval '1 day','email',
  case offset_days when -5 then 'upcoming_payment' when 0 then 'due_today' when 3 then 'overdue_3' when 7 then 'overdue_7' else 'manual_alert' end,
  'scheduled',(select id from public.contacts where account_id=sub.account_id and is_primary_billing limit 1)
from public.billing_periods bp join public.subscriptions sub on sub.id=bp.subscription_id
cross join (values(-5),(0),(3),(7),(15)) offsets(offset_days) where bp.status in ('pending','overdue');

insert into public.integrations(account_id,provider,type,status,display_name,external_account_identifier)
select id,'demo','api','disabled','Integración de referencia','demo-'||replace(id::text,'-','') from public.accounts where status='active';

-- Seed intentionally uses only fictitious people and reserved example.com addresses.
