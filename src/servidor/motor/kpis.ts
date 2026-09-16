export interface KPIs {
  ventanaCapturaMedia: number;
  ventanaCapturaMediana: number;
  backOfficeDias: number;
  cicloTotalMediana: number;
  tasaReproceso: number;
  erroresPor100: number;
  erroresCaptura: number;
  erroresIncompletos: number;
  erroresIlegibles: number;
  atorados: number;
  atoradosPct: number;
  conversionPct: number;
  quejasPct: number;
  diasPerdidosBuro: number;
  presupuestoGastado: number;
}

export function clonarKPIs(k: KPIs): KPIs {
  return { ...k };
}

export function redondear(n: number, decimales: number = 1): number {
  const factor = 10 ** decimales;
  return Math.round(n * factor) / factor;
}

export function recalcularDerivados(k: KPIs): void {
  k.cicloTotalMediana = redondear(k.ventanaCapturaMediana + k.backOfficeDias, 0);
  k.erroresPor100 = redondear(
    ((k.erroresCaptura + k.erroresIncompletos + k.erroresIlegibles) / 1500) * 100,
    1
  );
  k.ventanaCapturaMedia = redondear(k.ventanaCapturaMedia, 1);
  k.tasaReproceso = redondear(k.tasaReproceso, 1);
  k.atoradosPct = redondear((k.atorados / 873) * 100, 1);
  k.quejasPct = redondear(k.quejasPct, 1);
  k.conversionPct = redondear(k.conversionPct, 1);
}

export function formatearKPIs(k: KPIs): string[] {
  return [
    `Ventana de captura (media): ${k.ventanaCapturaMedia} dias`,
    `Ventana de captura (mediana): ${k.ventanaCapturaMediana} dias`,
    `Back office: ${k.backOfficeDias} dias`,
    `Ciclo total (mediana): ${k.cicloTotalMediana} dias`,
    `Tasa de reproceso: ${k.tasaReproceso}%`,
    `Errores por 100 solicitudes: ${k.erroresPor100}`,
    `  Captura: ${k.erroresCaptura}  Incompletos: ${k.erroresIncompletos}  Ilegibles: ${k.erroresIlegibles}`,
    `Atorados: ${k.atorados} (${k.atoradosPct}%)`,
    `Conversion: ${k.conversionPct}%`,
    `Quejas (indice): ${k.quejasPct}%`,
    `Dias perdidos en rechazados: ${k.diasPerdidosBuro}`,
    `Presupuesto gastado: ${k.presupuestoGastado}/100`,
  ];
}
