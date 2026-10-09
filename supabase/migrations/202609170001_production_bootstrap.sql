insert into public.pricing_rules(
  version,
  day_rate,
  min_implementation,
  min_maintenance,
  complexity_tiers,
  maintenance_brackets,
  expansion_discount_tiers,
  rounding_multiple,
  effective_from,
  published_at
)
values (
  '2026-09-v1',
  200000,
  200000,
  65000,
  '{"standard":1,"medium":1.2,"high":1.5,"research":1.75,"advanced_research":2}',
  '[{"upTo":400000,"ratePercent":20,"floor":65000},{"upTo":1000000,"ratePercent":17.5,"floor":80000},{"upTo":2000000,"ratePercent":15,"floor":175000},{"upTo":4000000,"ratePercent":12,"floor":300000},{"upTo":null,"ratePercent":10,"floor":480000}]',
  '[{"fromSolution":1,"discountPercent":0},{"fromSolution":2,"discountPercent":25},{"fromSolution":3,"discountPercent":30},{"fromSolution":4,"discountPercent":35},{"fromSolution":5,"discountPercent":40}]',
  1000,
  '2026-09-01',
  now()
)
on conflict (version) do nothing;

insert into public.solution_catalog(
  name,
  category,
  description,
  default_days,
  default_complexity,
  reusable_template_key
)
select *
from (
  values
    ('Sincronización ERP + ecommerce', 'Integraciones', 'Sincroniza pedidos, stock y estados.', 4, 'medium', 'erp-ecommerce'),
    ('Conciliación automática', 'Finanzas', 'Compara pagos, documentos y movimientos.', 5, 'high', 'payment-reconciliation'),
    ('Reporte operativo diario', 'Datos', 'Consolida y distribuye indicadores.', 2, 'standard', 'daily-report')
) as bootstrap(name, category, description, default_days, default_complexity, reusable_template_key)
where not exists (
  select 1
  from public.solution_catalog existing
  where existing.reusable_template_key = bootstrap.reusable_template_key
);
