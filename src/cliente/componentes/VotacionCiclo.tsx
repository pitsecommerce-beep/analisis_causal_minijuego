import { useState } from 'react';
import { CAUSAS_A_VOTAR, NUM_PORQUES, ESTADOS, ultimaVotacion } from '../../compartido/espina.js';
import { useEspina, votar } from '../espina.js';

interface Props {
  ciclo: number;
  onCancelar: () => void;
  onVotado: () => void;
  onIrEspina: () => void;
}

// Cierre de ciclo: elegir las causas principales de la espina y escribir los 5 porqués
export function VotacionCiclo({ ciclo, onCancelar, onVotado, onIrEspina }: Props) {
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
      setError(err.message);
    }
    setEnviando(false);
  }

  return (
    <div className="modal-fondo" onMouseDown={e => { if (e.target === e.currentTarget) onCancelar(); }}>
      <form className="modal votacion" role="dialog" aria-modal="true" aria-labelledby="votacion-titulo" onSubmit={enviar}>
        <h3 id="votacion-titulo" className="modal-titulo">Cierre del ciclo {ciclo}</h3>
        {espina.tarjetas.length === 0 ? (
          <>
            <p className="modal-mensaje">Tu espina de pescado está vacía. Antes de avanzar, agrega al menos una causa posible.</p>
            <div className="modal-acciones">
              <button type="button" className="btn-fantasma" onClick={onCancelar}>Cancelar</button>
              <button type="button" className="btn-primario" onClick={onIrEspina}>Ir a la espina</button>
            </div>
          </>
        ) : (
          <>
            <p className="modal-mensaje">Vota tus {requeridas} causas principales. Solo cuentan para tu diagnóstico las que verificaste con datos.</p>
            <ul className="votacion-causas">
              {tarjetas.map(t => (
                <li key={t.id}>
                  <label>
                    <input type="checkbox" className="casilla" checked={causas.includes(t.id)} onChange={() => alternar(t.id)}
                      disabled={!causas.includes(t.id) && causas.length >= requeridas} />
                    <span>{t.texto}</span>
                    <span className={`badge ${t.estado === 'verificada' ? 'badge-exito' : t.estado === 'refutada' ? 'badge-advertencia' : 'badge-info'}`}>{ESTADOS[t.estado]}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="campo-label" style={{ marginTop: 14 }}>Los 5 porqués de tu causa principal</p>
            {porques.map((p, i) => (
              <input key={i} value={p} maxLength={400} aria-label={`Porqué ${i + 1}`} style={{ marginBottom: 6 }}
                placeholder={i === 0 ? '¿Por qué tardan tanto las tarjetas?' : `¿Por qué? (${i + 1})`}
                onChange={e => setPorques(ps => ps.map((x, j) => j === i ? e.target.value : x))} />
            ))}
            {error && <div className="alerta-error" role="alert">{error}</div>}
            <div className="modal-acciones">
              <button type="button" className="btn-fantasma" onClick={onCancelar}>Cancelar</button>
              <button type="submit" className="btn-primario" disabled={enviando || causas.length !== requeridas || porques.some(p => !p.trim())}>
                Guardar y continuar
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
