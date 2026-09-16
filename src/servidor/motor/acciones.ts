import type { KPIs } from './kpis.js';
import { redondear, recalcularDerivados } from './kpis.js';

export interface AccionConfig {
  id: number;
  nombre: string;
  costo: number;
  demora: number;
  efectos: Record<string, number>;
  requiereSucursales?: boolean;
  descripcion: string;
}

export interface AccionElegida {
  accionId: number;
  cicloElegido: number;
  sucursalesNombradas?: number[];
}

export interface ResultadoAccion {
  accionId: number;
  nombre: string;
  aplicada: boolean;
  razon?: string;
  cambios: string[];
}

const SUCURSALES_FOCO = [110, 676, 728];
const TOTAL_SUCURSALES = 18;

function fraccionSucursalesCorrectas(nombradas: number[]): number {
  if (!nombradas || nombradas.length === 0) return 0;
  const aciertos = nombradas.filter((s) => SUCURSALES_FOCO.includes(s)).length;
  return aciertos / SUCURSALES_FOCO.length;
}

export function aplicarAccion(
  kpis: KPIs,
  accion: AccionConfig,
  elegida: AccionElegida,
  cicloActual: number
): ResultadoAccion {
  const resultado: ResultadoAccion = {
    accionId: accion.id,
    nombre: accion.nombre,
    aplicada: false,
    cambios: [],
  };

  const cicloDesdeEleccion = cicloActual - elegida.cicloElegido;
  if (cicloDesdeEleccion < accion.demora) {
    resultado.razon = `Entra en efecto en ${accion.demora - cicloDesdeEleccion} ciclo(s)`;
    return resultado;
  }

  if (cicloDesdeEleccion > accion.demora) {
    resultado.aplicada = true;
    resultado.razon = 'Ya aplicada en ciclo anterior';
    return resultado;
  }

  resultado.aplicada = true;
  const e = accion.efectos;

  switch (accion.id) {
    case 1: {
      const redIncompletos = Math.round(kpis.erroresIncompletos * (e.incompletos ?? 0));
      const redIlegibles = Math.round(kpis.erroresIlegibles * (e.ilegibles ?? 0));
      kpis.erroresIncompletos += redIncompletos;
      kpis.erroresIlegibles += redIlegibles;
      const totalErroresReducidos = Math.abs(redIncompletos) + Math.abs(redIlegibles);
      kpis.tasaReproceso = redondear(kpis.tasaReproceso * (1 - totalErroresReducidos / 1318), 1);
      const reduccionVentana = totalErroresReducidos * 0.015;
      kpis.ventanaCapturaMedia = redondear(kpis.ventanaCapturaMedia - reduccionVentana, 1);
      kpis.ventanaCapturaMediana = Math.max(5, kpis.ventanaCapturaMediana - Math.round(reduccionVentana * 0.6));
      kpis.quejasPct = redondear(kpis.quejasPct * 0.85, 1);
      resultado.cambios.push(
        `Incompletos: ${redIncompletos}`,
        `Ilegibles: ${redIlegibles}`,
        `Quejas: -15%`
      );
      break;
    }

    case 2: {
      const fraccion = fraccionSucursalesCorrectas(elegida.sucursalesNombradas ?? []);
      const reduccion = Math.round(kpis.erroresCaptura * Math.abs(e.errorCaptura ?? 0) * fraccion);
      kpis.erroresCaptura -= reduccion;
      kpis.tasaReproceso = redondear(kpis.tasaReproceso * (1 - reduccion / 1318), 1);
      const reduccionVentana = reduccion * 0.02;
      kpis.ventanaCapturaMedia = redondear(kpis.ventanaCapturaMedia - reduccionVentana, 1);
      kpis.ventanaCapturaMediana = Math.max(5, kpis.ventanaCapturaMediana - Math.round(reduccionVentana * 0.5));
      resultado.cambios.push(
        `Errores captura: -${reduccion} (${Math.round(fraccion * 100)}% de sucursales correctas)`
      );
      break;
    }

    case 3: {
      const reduccion = Math.round(kpis.erroresCaptura * Math.abs(e.errorCaptura ?? 0));
      kpis.erroresCaptura -= reduccion;
      kpis.tasaReproceso = redondear(kpis.tasaReproceso * (1 - reduccion / 1318), 1);
      const reduccionVentana = reduccion * 0.02;
      kpis.ventanaCapturaMedia = redondear(kpis.ventanaCapturaMedia - reduccionVentana, 1);
      kpis.ventanaCapturaMediana = Math.max(5, kpis.ventanaCapturaMediana - Math.round(reduccionVentana * 0.5));
      resultado.cambios.push(`Errores captura: -${reduccion} (todas las sucursales)`);
      break;
    }

    case 4: {
      const reduccionDias = Math.round(kpis.diasPerdidosBuro * Math.abs(e.trabajoPerdido ?? 0));
      kpis.diasPerdidosBuro -= reduccionDias;
      kpis.ventanaCapturaMedia = redondear(kpis.ventanaCapturaMedia * (1 + (e.costoOperativo ?? 0)), 1);
      resultado.cambios.push(
        `Dias perdidos buro: -${reduccionDias}`,
        `Costo operativo: ${Math.round((e.costoOperativo ?? 0) * 100)}%`
      );
      break;
    }

    case 5: {
      const reduccion = Math.round(kpis.atorados * Math.abs(e.atorados ?? 0));
      kpis.atorados -= reduccion;
      kpis.quejasPct = redondear(kpis.quejasPct * (1 + (e.quejas ?? 0)), 1);
      kpis.conversionPct = redondear(kpis.conversionPct + reduccion * 0.03, 1);
      resultado.cambios.push(
        `Atorados: -${reduccion}`,
        `Quejas: ${Math.round((e.quejas ?? 0) * 100)}%`
      );
      break;
    }

    case 6: {
      const reduccionBO = Math.round(kpis.backOfficeDias * Math.abs(e.backOffice ?? 0));
      kpis.backOfficeDias -= reduccionBO;
      resultado.cambios.push(`Back office: -${reduccionBO} dias`);
      break;
    }

    case 7: {
      resultado.cambios.push('Sin efecto medible');
      break;
    }

    case 8: {
      kpis.cicloTotalMediana += e.cicloAparente ?? 0;
      const perdidaConversion = Math.abs(e.conversion ?? 0);
      kpis.conversionPct = redondear(kpis.conversionPct * (1 - perdidaConversion), 1);
      resultado.cambios.push(
        `Ciclo aparente: ${e.cicloAparente} dias`,
        `Conversion: -${Math.round(perdidaConversion * 100)}%`
      );
      break;
    }

    case 9: {
      const reduccionCaptura = Math.abs(e.captura ?? 0);
      kpis.ventanaCapturaMedia = redondear(kpis.ventanaCapturaMedia * (1 - reduccionCaptura), 1);
      kpis.ventanaCapturaMediana = Math.max(
        5,
        Math.round(kpis.ventanaCapturaMediana * (1 - reduccionCaptura * 0.8))
      );
      const aumentoErrores = e.errores ?? 0;
      const erroresNuevos = Math.round(
        (kpis.erroresCaptura + kpis.erroresIncompletos + kpis.erroresIlegibles) * aumentoErrores
      );
      kpis.erroresCaptura += Math.round(erroresNuevos * 0.7);
      kpis.erroresIncompletos += Math.round(erroresNuevos * 0.2);
      kpis.erroresIlegibles += Math.round(erroresNuevos * 0.1);
      kpis.tasaReproceso = redondear(kpis.tasaReproceso * (1 + aumentoErrores * 0.5), 1);
      resultado.cambios.push(
        `Captura: -${Math.round(reduccionCaptura * 100)}%`,
        `Errores: +${Math.round(aumentoErrores * 100)}%`
      );
      break;
    }

    case 10: {
      resultado.cambios.push('Sin efecto en el horizonte de la partida');
      break;
    }
  }

  recalcularDerivados(kpis);
  return resultado;
}
