# Diccionario de datos R2

Referencia obligatoria para el cargador del simulador. Los campos derivados no existen como columnas: hay que calcularlos, y la forma de calcularlos no es obvia.

## Archivo 1: `R2_MX_ETF_Bank_Causal_Analysis_MBA.xlsx`

Hoja única: `MX CAMPUS`. 1,500 filas, 23 columnas, encabezados en inglés.

| Columna | Tipo | Notas |
|---|---|---|
| `Application #` | entero | 1 a 1500, único |
| `Customer #` | entero | identificador de cliente |
| `Age` | entero | 18 a 78. **Trampa** |
| `Marital Status` | texto | `married`, `single`. Trae basura: `married ` con espacio, `solero`. **Trampa** |
| `Gender` | texto | `male`, `female`. Trae `maculino`. **Trampa** |
| `State` | texto | 8 estados. Algunos con espacio final |
| `Branch #` | entero | 18 sucursales |
| `Years as customer` | entero | 1 a 20. **Trampa** |
| `Credit Bureau Score` | decimal | 33 a 97. Nulo si nunca se corrió buró. **Trampa** |
| `ETFBank Score` | decimal | 12 a 29. Nulo si no llegó a esa etapa. **Trampa** |
| `Date of first data input` | fecha | Inicio del proceso en sucursal |
| `Date of last data input` | fecha | Fin de la captura |
| `# of tries` | entero | 1 a 6. Intentos de captura |
| `Date documents sent` | fecha | Envío de sucursal a CrOP |
| `Date documents Received at CrOP` | fecha | Recepción en CrOP |
| `Credit Bureau result` | texto | `Accepted`, `Rejected`, nulo |
| `Credit Bureau run date` | fecha | Nulo si nunca se consultó |
| `ETFBank Score result` | texto | `Accepted`, `Rejected`, nulo |
| `ETFB Score Date` | fecha o texto | **Puede venir el literal `na`.** Parsear con tolerancia |
| `Date Plastic Sent` | fecha | Nulo si nunca se envió la tarjeta |
| `Last Status` | texto | 7 valores, ver abajo |
| `Credit Line Granted` | decimal | Nulo si no se aprobó. **Trampa** |
| `Comments` | texto | Bitácora del proceso. Ver parseo abajo |

### Valores de `Last Status`

`Card Sent`, `Score Accepted`, `Authorized`, `Score Rejected`, `Bureau Rejected`, `Documents received`, `Branch Executive task`.

Hay **dos filas con inconsistencia deliberada**: `Last Status = Card Sent` con `ETFBank Score result = Rejected`. No las corrijas. Existen porque los sistemas reales tienen inconsistencias y detectarlas es parte del ejercicio.

### Parseo de `Comments`

Es el campo más importante y el único que registra los errores. Formato: eventos separados por punto, cada uno con fecha y descripción.

```
20 jul. illegible document. 27 jul incomplete documents. 6 ago input error. 15 oct authorized for 39,500.
```

**Vocabulario de error, exhaustivo.** Solo estos cuentan como error:

| Evento | Cuenta como |
|---|---|
| `input error` | Error de captura |
| `error de catura` | Error de captura (typo presente en la base real) |
| `incomplete documents` | Documentos incompletos |
| `illegible document` | Documento ilegible |
| `invalid id` | Documentos incompletos (variante rara) |

**Eventos de cierre, no son errores:** `authorized for ...`, `authorized for loan for ...`, `de autoriza el loan for ...`, `Envío de plástico. Authorized for ...`, `bureau rejected`, `Bureau Rejected`, `Score Rejected`.

**Reglas de parseo:**
- Comparar en minúsculas. La capitalización es inconsistente a propósito.
- Las fechas vienen como `3 sep`, `05 oct`, `15-ago`, `15 jul.`, `23 Oct`. Meses en español abreviados.
- Los montos vienen con y sin coma de millares.
- Puede haber espacio final en la cadena.
- Un `Comments` vacío significa que no hubo eventos registrados.

**Invariante:** `# of tries` = 1 + número de eventos de error en `Comments`.

## Campos derivados

Ninguno existe como columna. El motor los necesita todos.

| Campo | Cálculo | Por qué importa |
|---|---|---|
| **Ventana de captura** | `Date of last data input` − `Date of first data input`, en días | Es la variable objetivo. **No confundir con el ciclo total** |
| Ciclo total | `Date Plastic Sent` − `Date of first data input` | Solo existe para las 731 filas con plástico enviado. Sesga hacia casos exitosos |
| Errores por caso | Conteo por vocabulario sobre `Comments` | |
| Tiene reproceso | Errores por caso ≥ 1 | |
| Está atorado | `ETFBank Score result = Accepted` **y** `Date Plastic Sent` nulo | El segundo problema del caso |
| Trabajo perdido | Ventana de captura de las filas con `Credit Bureau result = Rejected` | El tercer problema |
| Mes | `Date of first data input` truncado a mes | Necesario para el diagrama de corrida |

**Advertencia central:** la ventana de captura es el 64% del ciclo mediano. El ciclo total es la métrica intuitiva y la equivocada, porque falta en la mitad de la base.

## Etapas del proceso (medianas en días)

| Etapa | Mediana |
|---|---|
| Captura en sucursal | 11 |
| Última captura a envío de documentos | 3 |
| Envío a recepción en CrOP | 3 |
| Recepción a consulta de buró | 3 |
| Buró a score del banco | 1 |
| Score a envío de plástico | 5 |

La captura en sucursal domina. Todo el back office junto suma 15 días medianos contra 11 de captura, pero la captura tiene una cola larguísima: media de 18.9 contra mediana de 11.

## Valores de verificación de carga

El cargador debe reproducir exactamente estos números. Si no, el parseo está mal.

| Medida | Valor |
|---|---|
| Filas | 1,500 |
| Sucursales | 18 |
| Estados | 8 |
| Meses distintos | 18 |
| Errores totales | 1,318 |
| Errores de captura | 659 |
| Documentos incompletos | 472 |
| Documentos ilegibles | 187 |
| Casos con al menos un error | 897 |
| Intentos, media | 1.96 |
| Intentos, desviación | 0.89 |
| Ventana de captura, media | 18.9 |
| Ventana de captura, mediana | 11 |
| Correlación intentos-captura | 0.786 |
| Buró corrido | 1,397 |
| Buró aceptado | 1,022 |
| Score aceptado | 873 |
| Plástico enviado | 731 |
| **Atorados** | **142** |
| Días perdidos en rechazados por buró | 6,758 |
| Top 3 sucursales por errores | 110, 676, 728 |
| % de errores en el top 3 | 40.2% |

## Archivo 2: `R2_ETF_Bank_Comentarios_Clientes.xlsx`

Tres hojas.

**`Comentarios`**: encabezados en la fila 4, datos de la fila 5 a la 94. 90 registros.

| Columna | Notas |
|---|---|
| `ID` | `C-001` a `C-090` |
| `Solicitud #` | Llave hacia `Application #` de la base |
| `Estado`, `Sucursal #`, `Intentos` | Redundantes con la base, para conveniencia |
| `Canal de captacion` | Encuesta, call center, queja escrita, redes |
| `Fecha del comentario` | |
| `Categoria primaria` | 6 categorías |
| `Categoria secundaria` | Puede estar vacía |
| `Comentario del cliente` | El texto que se convierte en voz |
| `Evidencia en la base R2` | **Nunca se entrega al participante.** Solo para generación de voz y evaluación |

Distribución: Reproceso documental 42, Error de captura 13, Caso atorado 13, Tiempo de ciclo 10, Rechazo 7, Monto de línea 5.

**`Resumen Pareto`**: fórmulas COUNTIF sobre la hoja anterior. No la recalcules en código.

**`Leyenda`**: instrucciones para el profesor. No la consume el simulador.

## Archivo 3: `R2_verdad_oculta.json`

La respuesta. **Solo servidor.** Nunca se serializa hacia el cliente antes del cierre.

| Llave | Contenido |
|---|---|
| `semilla` | Semilla del generador |
| `sucursales_foco` | `[110, 676, 728]` |
| `capacitacion_base` | Nivel real por sucursal. La causa raíz |
| `ejecutivos` | Ejecutivos por sucursal, para calcular carga |
| `claridad_checklist` | Valores antes y después, y el mes del quiebre |
| `umbral_buro` | 70 |
| `umbral_score_interno` | 20 |
| `trampas` | Lista de columnas sin efecto causal |
| `linea_base` | Todos los KPIs de arranque |
| `ranking_sucursales_por_error` | Ranking real con marca de foco |

## El quiebre de nivel

En el **mes 10** de la serie entra el módulo de captación digital y la claridad del checklist cae. Consecuencia: el reproceso sube unos 12 puntos y los intentos pasan de 1.78 a 2.16 aproximadamente.

Es invisible en un Pareto agregado de los 18 meses y evidente en un diagrama de corrida. Es la única razón por la que el diagrama de corrida y la carta de control dejan de ser decorativos en este ejercicio.

## Relación con R1

R1 es la muestra real de 103 casos del caso P 16 C 03, de junio a octubre de 2015. Corresponde a los **últimos cinco meses de R2**, es decir, al periodo posterior al quiebre. Por eso los promedios de R2 a 18 meses son mejores que los de R1: R1 muestreó el periodo malo.

En la narrativa, R1 es la muestra piloto que el director entrega en la sala de juntas, y R2 es el extracto histórico que el banco libera cuando los equipos piden más datos.
