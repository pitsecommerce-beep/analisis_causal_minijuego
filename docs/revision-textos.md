# Revisión de textos del participante

Lista de los textos que cambiaron en la revisión para usuario final. Todos los textos del participante viven ahora en `src/compartido/i18n/es.ts` y `en.ts`; esta lista indica qué cambió respecto a la versión anterior. Los textos nuevos de las herramientas (constructor, tablero, El caso) están en las secciones `constructor`, `graficos`, `tablero` y `caso` de esos archivos.

## Textos técnicos eliminados

| Antes | Ahora |
|---|---|
| `Días de captura en sucursal (calculado)` y demás columnas con `(calculado)` | Nombre sin paréntesis, con ícono ƒ y tooltip «Columna calculada a partir de los datos» |
| `Días de captura de la solicitud (cruce)` y demás columnas con `(cruce)` | `Días de captura de la solicitud`, `Errores de la solicitud`, `Estatus de la solicitud` |
| `Quejas del cliente (cruce con comentarios)` | `Quejas del cliente` |
| `(vacío)` | `Sin dato` |
| Insignias `Verificaciones: medianas_iguales, error_captura_frecuente…` en Datos | Eliminadas |
| «Ver detalles completos» con el desglose crudo de puntos en Resultados | Eliminado |
| Mensajes crudos del servidor (`Error del servidor (500)`, `err.message`) | Mensaje breve con acción: «No se pudieron cargar los datos. Intenta de nuevo.» y equivalentes por pantalla |
| `Partida`, `Jugador` como valores de respaldo | Eliminados |

## Nombres de columnas

| Antes | Ahora |
|---|---|
| Comentarios (columna de la base) | Bitácora del expediente |
| Envío a back office (CrOP) | Envío a CrOP |
| Recepción en back office (CrOP) | Recepción en CrOP |
| Categoría primaria | Categoría principal |
| (no se mostraba) ID del comentario | Folio |
| Errores en comentarios | Número de errores |
| Mes de inicio de captura | Mes de inicio |

Columnas calculadas nuevas: Días de envío a CrOP, Días en CrOP, Días hasta buró, Días totales del proceso, Errores de captura, Documentos incompletos, Documentos ilegibles, Otros errores (solo bases originales), Tiene reproceso, Rechazada por buró después de reproceso, Aprobada sin tarjeta enviada.

## Métricas y resultados (modo completo)

| Antes | Ahora |
|---|---|
| Ventana de captura (media) | Ventana de captura, media |
| Ciclo total (mediana) | Ciclo total, mediana |
| Quejas (índice) | Índice de quejas |
| Diagnóstico (causa raíz) | Diagnóstico de causa raíz |
| Criterio (evidencia) | Criterio con evidencia |
| Impacto (mejora KPIs) | Impacto en los KPIs |
| Método (hitos de Bohn) | Método de Bohn |
| Ramón Betancourt (Consejo) | Ramón Betancourt, Consejo |
| Resultado Final | Resultado final |
| de 1000 puntos | de 1,000 puntos |

## Decisiones

| Antes | Ahora |
|---|---|
| Confirmar 2 acción(es) | Confirmar 2 acciones / Confirmar 1 acción |
| Confirmar 2 accion(es) ($50) | Confirmar 2 acciones ($50) |
| 2 ciclo(s) | 2 ciclos / 1 ciclo |
| Ninguna (decisión sin causa ligada) | Ninguna, decisión sin causa ligada |
| Selecciona... | Selecciona una métrica |
| Métrica (actual: 18.9 dias) | Métrica · actual: 18.9 días |
| Valor prometido (actual: 18.9) | Valor prometido actual: 18.9 |
| Error de servidor por presupuesto | «No te alcanza el presupuesto para esas acciones.» |

## Espina de pescado, votación y pendientes

| Antes | Ahora |
|---|---|
| …adjuntas una gráfica o cálculo de la pestaña Datos. | …adjuntas un gráfico de la pestaña Análisis. |
| Sin evidencia. En la pestaña Datos, usa "Adjuntar a la espina"… | Sin evidencia. En la pestaña Análisis, usa «Adjuntar a la espina» sobre un gráfico. |
| Verificada (requiere evidencia) | Verificada, con tooltip «requiere evidencia» |
| Evidencias guardadas desde Datos | Evidencias guardadas desde Análisis |
| Eliminar causa (sin confirmar) | Eliminar causa pide confirmación |
| Adjuntar evidencia guardada… | Adjuntar evidencia guardada |
| Enviar a la espina… / Rama Personal | Enviar a la espina / Rama Personal |
| ¿Por qué? (2) | Igual |

## Inducción (modo completo)

- «Los datos del proceso»: la cifra de solicitudes sale de la base (antes decía «1,500» fijo).
- «La vista del proceso»: se quitó «mediana, media, desviación y percentil 90».
- «La voz del cliente»: ahora dice «Empieza por aquí para saber de qué se quejan» (antes sugería hacer un Pareto por categoría).
- «Las herramientas de Bohn»: reescrito para el constructor de Análisis y el botón «Agregar al tablero».
- Paso nuevo: «Tu tablero».

## Acceso y sala de espera

| Antes | Ahora |
|---|---|
| Tu nombre | Tu nombre o el de tu equipo |
| Sesión no encontrada | No encontramos esa sesión. Revisa el código con tu profesor. |
| Sesión llena | La sesión está llena. Avisa a tu profesor. |
| La sesión ya no acepta jugadores | Esta sesión ya no acepta participantes. |
| La sesión aún no ha sido iniciada por el profesor. Espera un momento y recarga. | Tu profesor aún no inicia la sesión. Espera un momento. |
| Mucho éxito, Director(a). | Mucho éxito. |

La página para unirse cambia al idioma de la sesión en cuanto el código es válido.

## Vista del proceso

- Se quitó «(estrato)» del texto de introducción.
- Los nombres de etapas y actores no cambian; ahora se traducen.

## Diálogos de asesores

R2 conserva exactamente los mismos textos (lo comprueba `tests/dialogos.test.ts`). En las bases originales cambian solo estas líneas:

| Asesor | R2 | Bases originales |
|---|---|---|
| Bernardo | …la captura tarda 11 días y el back office también 11 días, en mediana. / Si tardan lo mismo, el problema no está en mis sucursales sino en CrOP. | …en mediana, la captura tarda {X} días y el back office, {Y}. / Antes de culpar a mis sucursales, revisen también lo que pasa en CrOP. |
| Óscar | La mitad de los errores son de captura… | Casi la mitad de los errores son de captura… (según la base) |
| Silvia | El error de captura es, por mucho, el más frecuente. / …capacitación para las 18 sucursales. | El error de captura es el más frecuente. / …capacitación para todas las sucursales. |
| Diego | Hay 142 expedientes aprobados… / Tres sucursales, la 110, la 676 y la 728, generan el 40% de los errores. | Hay expedientes aprobados… / Dos sucursales, la 110 y la 676 (A) o la 336 y la 637 (B), son las que más errores generan. |

## Comentarios de clientes de R2

Se reescribieron 75 de los 90 textos para que no contradigan su evidencia y no se repitan plantillas. El detalle completo está en `scripts/comentarios/r2.ts`.

## Inducción del modo informativo

Nueva. Ramón Betancourt recibe al equipo como Director de Operaciones con el mismo formato de pixel art y globo de diálogo, y recorre El caso, Datos, Comentarios, Proceso, Análisis, Tablero y Sala de Juntas. Sale al entrar por primera vez y se repite con el botón de ayuda, que en este modo dice «Cómo funciona». Los textos están en la sección `onboardingInformativo` de `es.ts` y `en.ts`. El contador de pasos ahora se traduce («3 de 10» / «3 of 10»).
