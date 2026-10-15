import { useState } from 'react';
import { CAUSAS_A_VOTAR, NUM_PORQUES, ultimaVotacion } from '../../compartido/espina.js';
import { useSesion } from '../i18n.js';
import { useEspina, votar } from '../espina.js';

interface Props {
  ciclo: number;
  onCancelar: () => void;
  onVotado: () => void;
  onIrEspina: () => void;
}

// Cierre de ciclo: elegir las causas principales de la espina y escribir los 5 porqués
export function VotacionCiclo({ ciclo, onCancelar, onVotado, onIrEspina }: Props) {
  const { t: tr } = useSesion();
  const espina = useEspina();
  const previa = espina.votaciones.find(v => v.ciclo === ciclo) ?? ultimaVotacion(espina);
  const vigentes = new Set(espina.tarjetas.map(t => t.id));
  const [causas, setCausas] = useState<string[]>((previa?.causas ?? []).filter(c => vigentes.has(c)));
  const [porques, setPorques] = useState<string[]>(() => Array.from({ length: NUM_PORQUES }, (_, i) => previa?.porques[i] ?? ''));
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const requeridas = Math.min(CAUSAS_A_VOTAR, espina.tarjetas.length);
  // Primero las verificadas: son las que cuentan para el diagnóstico
  const orden = { verificada: 0, hipotesis: 1, refutada: 2 };
  const tarjetas = [...espina.tarjetas].sort((a, b) => orden[a.estado] - orden[b.estado]);

  function alternar(id: string) {
    setCausas(c => c.includes(id) ? c.filter(x => x !== id) : c.length < requeridas ? [...c, id] : c);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await votar(causas, porques);
      onVotado();
    } catch (err: any) {
      setError(tr('votacion.error'));
      void err;
    }
    setEnviando(false);
  }

  return (
    <div className="modal-fondo" onMouseDown={e => { if (e.target === e.currentTarget) onCancelar(); }}>
      <form className="modal votacion" role="dialog" aria-modal="true" aria-labelledby="votacion-titulo" onSubmit={enviar}>
        <h3 id="votacion-titulo" className="modal-titulo">{tr('votacion.titulo', { n: ciclo })}</h3>
        {espina.tarjetas.length === 0 ? (
          <>
            <p className="modal-mensaje">{tr('votacion.vacia')}</p>
            <div className="modal-acciones">
              <button type="button" className="btn-fantasma" onClick={onCancelar}>{tr('comun.cancelar')}</button>
              <button type="button" className="btn-primario" onClick={onIrEspina}>{tr('votacion.irEspina')}</button>
            </div>
          </>
        ) : (
          <>
            <p className="modal-mensaje">{tr('votacion.instrucciones', { n: requeridas })}</p>
            <ul className="votacion-causas">
              {tarjetas.map(t => (
                <li key={t.id}>
                  <label>
                    <input type="checkbox" className="casilla" checked={causas.includes(t.id)} onChange={() => alternar(t.id)}
                      disabled={!causas.includes(t.id) && causas.length >= requeridas} />
                    <span>{t.texto}</span>
                    <span className={`badge ${t.estado === 'verificada' ? 'badge-exito' : t.estado === 'refutada' ? 'badge-advertencia' : 'badge-info'}`}>{tr(`espinaUi.estados.${t.estado}`)}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="campo-label" style={{ marginTop: 14 }}>{tr('votacion.porques')}</p>
            {porques.map((p, i) => (
              <input key={i} value={p} maxLength={400} aria-label={tr('votacion.porque', { n: i + 1 })} style={{ marginBottom: 6 }}
                placeholder={i === 0 ? tr('votacion.primerPorque') : tr('votacion.otroPorque', { n: i + 1 })}
                onChange={e => setPorques(ps => ps.map((x, j) => j === i ? e.target.value : x))} />
            ))}
            {error && <div className="alerta-error" role="alert">{error}</div>}
            <div className="modal-acciones">
              <button type="button" className="btn-fantasma" onClick={onCancelar}>{tr('comun.cancelar')}</button>
              <button type="submit" className="btn-primario" disabled={enviando || causas.length !== requeridas || porques.some(p => !p.trim())}>
                {tr('votacion.guardar')}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
