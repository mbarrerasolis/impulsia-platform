# Motor de pricing

La implementación está en `domain/pricing` y no depende de UI ni base de datos.

## Fórmulas

```text
bruto implementación = jornadas × valor jornada × factor complejidad
implementación = max(mínimo, redondeo comercial del bruto)
mantención = max(mínimo global, piso del tramo, implementación × tasa del tramo)
neto expansión = redondeo(bruto × (1 - descuento))
```

Regla `2026-09-v1`: jornada $200.000, implementación mínima $200.000, mantención mínima $65.000 y redondeo al múltiplo de $1.000 más cercano.

El descuento depende de las soluciones activas después de agregar la nueva: 0%, 25%, 30%, 35% y 40% desde la quinta. Se aplica sólo a la nueva implementación y a su incremento de mantención. Los costos externos jamás reciben el descuento.

## Históricos

`calculateExpansionQuote` devuelve `pricingRuleVersion` y una copia completa `pricingSnapshot`. Publicar reglas nuevas no modifica cotizaciones, soluciones o mensualidades previas.

## Cobertura

Las pruebas recorren factores, mínimo, bordes de todos los tramos, un peso sobre cada borde, monotonicidad, niveles de expansión, terceros y snapshot histórico.
