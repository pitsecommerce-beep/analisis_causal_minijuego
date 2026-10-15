# Bases originales del caso

Muestra de 103 solicitudes del caso P 16 C 03 (junio a noviembre de 2015). Los archivos se usan exactamente como vienen: mismos valores, columnas y errores de origen ("maculino", "error de catura", "NA", fechas inconsistentes, filas que no cumplen el invariante de intentos). Todo lo derivado se calcula en memoria al precalcular (`scripts/precalcular-datos.ts`).

| Archivo | Origen |
|---|---|
| `A_es.xlsx` | `ENTREGABLE Causal Analysis Español.xlsx`, sin cambios. El cargador lee la primera hoja (`Hoja1`) |
| `A_en.xlsx` | `R1_MX_ETF_Bank_Causal_Analysis_MBA.xlsx`, sin cambios |
| `B_en.xlsx` | `Entregable B Nov2020.xlsx`, sin cambios. Conserva sus 4 columnas de tiempos |
| `B_es.xlsx` | Generado con `npx tsx scripts/generar-originales.ts` a partir de `B_en.xlsx` |
| `comentarios_*.xlsx` | Comentarios de clientes alineados con cada base |

## Traducción de B al español

`B_es.xlsx` solo traduce encabezados, estatus y el vocabulario de la bitácora. Ningún valor, fecha ni fila cambia. Las demás columnas de texto (`married`, `male`, `Accepted`, estados) se quedan como en `A_es.xlsx`, que tampoco las traduce. La fuente de verdad es `src/servidor/datos/traduccion-b.ts`.

### Encabezados

| B_en | B_es |
|---|---|
| Application # | # Solicitud |
| Customer # | # Cliente |
| Age | Edad |
| Marital Status | Edo. Civil |
| Gender | Genero |
| State | Estado |
| Branch # | # Sucursal |
| Years as customer | Años como cliente |
| Credit Bureau Score | Score Buró crédito |
| ETFBank Score | Score ETFBank |
| Date of first data input | Fecha de primer captura |
| Date of last data input | Fecha última captura |
| # of tries | # intentos |
| Time passes | Tiempo transcurrido |
| Crop+delivery time | Tiempo CrOP y entrega |
| Date documents sent | Fecha envio documentos |
| Executive time | Tiempo del ejecutivo |
| Date documents Received at CrOP | Fecha recepción de documentos CrOP |
| Credit Bureau result | Resultado Buró crédito |
| Credit Bureau run date | Fecha de consulta a Buró |
| ETFBank Score result | Resultado score ETFBank |
| ETFB Score Date | Fecha consulta score ETFB |
| Date Plastic Sent | Fecha envío plástico |
| CROP Time | Tiempo CrOP |
| Last Status | último status |
| Credit Line Granted | Monto de línea otorgada |
| Comments | Comentarios |

Los encabezados que existen en `A_es.xlsx` se copian con su misma escritura. Las cuatro columnas de tiempos no existen en A y se tradujeron aparte.

### Estatus

| B_en | B_es |
|---|---|
| Card Sent | Tarjeta enviada |
| Score Rejected | Rechazo Score |
| Score Accepted | Aceptado Score |
| Bureau Rejected | Rechazo Buró |
| Documents received | Documentos recibidos |
| Authorized | Autorizada |
| Branch Executive task | Tarea Ejecutivo Sucursal |

### Vocabulario de la bitácora

Se aplica en este orden, sin distinguir mayúsculas. Se eligió la redacción más frecuente en `A_es.xlsx` para cada frase. Las fechas ya vienen con meses en español y no se tocan.

| Inglés | Español |
|---|---|
| authorized for loan for | se autoriza crédito por |
| de autoriza el loan for | de autoriza el crédito por |
| authorized for | se autoriza el crédito por |
| authorized | se autoriza |
| aprobación for | aprobación por |
| incomplete documents | documentación incompleta |
| illegible documents | documentos ilegibles |
| illegible document | documentación ilegible |
| input error | error de captura |
| bureau rejected | Rechazo Buró |
| score rejected | Rechazo Score |
| invalid id | identificación no valida |

Como A_es es una traducción manual con variantes, B_es no coincide evento por evento con A_es: sus conteos de errores son los de B_en (49 de captura, 43 incompletos, 20 ilegibles y 3 otros).
