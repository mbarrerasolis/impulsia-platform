# ERP (FrutoFlow) — módulo financiero y de gastos (especificación)

Estado: **pendiente de recibir el código de FrutoFlow** (está en otro PC). Esta especificación se
adapta a las tablas reales de ventas, compras y caja de FrutoFlow cuando el código llegue. Vive en
el ERP, no en el CRM: el CRM sólo controla el gasto comercial (ver `/admin/marketing`).

## 1. Módulo de gastos

Registro de gastos para cuadrar el estado de resultados.

- **Gasto individual**: fecha, categoría, proveedor (opcional), descripción, monto neto, IVA,
  total, medio de pago, documento (boleta/factura/sin documento, folio) y adjunto (foto o PDF).
- **Gasto mensual recurrente**: igual que el anterior, más un día de cargo, inicio y término
  opcional. Genera un cargo por mes; cada cargo se puede marcar como pagado o ajustar su monto real
  (p. ej., la luz varía).
- **Categorías** (editables por cliente) agrupadas por línea del estado de resultados:
  - Costo de ventas: compras de mercadería, fletes de compra, mermas.
  - Gastos de operación: arriendo, sueldos y honorarios, servicios básicos, internet y telefonía,
    insumos y envases, transporte y despacho, mantención.
  - Gastos comerciales: publicidad, comisiones de pasarela (Flow, Transbank), plataformas.
  - Gastos administrativos: contador, software, bancos, patentes.
  - Gastos financieros e impuestos: intereses, créditos, impuesto a la renta.
- Mismo patrón de recurrencia que ya existe en el CRM (`domain/marketing/expenses.ts`,
  `expenseOccurrences`), para reutilizar la lógica y los tests.

## 2. Estado de resultados por fecha

Filtro por rango (mes, trimestre, año, desde–hasta) con comparación contra el período anterior.

```text
  Ventas netas (sin IVA, menos notas de crédito y devoluciones)
− Costo de ventas (costo de lo vendido: lotes/granel según FrutoFlow, + fletes y mermas)
= Margen bruto            (y % sobre ventas)
− Gastos de operación
− Gastos comerciales
− Gastos administrativos
= Resultado operacional (EBITDA simplificado)
− Gastos financieros e impuestos
= Resultado neto
```

- Desglose por categoría, por tienda/sucursal y por canal de venta (tienda física, web, WhatsApp).
- Margen por producto y por familia (frutos secos, deshidratados, mixes) usando el costo por lote.
- Base devengada (fecha de la venta o del gasto), no de caja.

## 3. Flujo de caja vs. ventas e ingresos

Base caja: cuándo entra y sale el dinero, conciliado con las ventas.

- **Entradas**: cobros de ventas por medio de pago (efectivo, débito/crédito, transferencia, Flow),
  con la fecha de abono real (las tarjetas y pasarelas abonan días después y con comisión).
- **Salidas**: pagos de gastos y de compras a proveedores.
- **Saldo**: inicial + entradas − salidas = final, por día, semana o mes.
- **Ventas vs. cobrado**: ventas del período, lo efectivamente cobrado y las cuentas por cobrar
  (ventas a crédito o abonos pendientes de la pasarela).
- **Cuadre de caja diario** por tienda: el arqueo de FrutoFlow contra los gastos pagados en efectivo.

## 4. Puntos de integración

- Las ventas web (tienda en la plataforma) se crean como ventas en FrutoFlow para que el estado de
  resultados las incluya.
- El gasto comercial del CRM (publicidad, IA, herramientas) se exporta al ERP como gastos de la
  categoría "Gastos comerciales", para no registrarlo dos veces.

## Siguiente paso

1. Subir el código de FrutoFlow a su carpeta (`clientes/…` o repo propio) y revisar su modelo de
   ventas, compras, lotes y caja.
2. Ajustar esta especificación a ese modelo y construir: gastos → estado de resultados → flujo de caja.
