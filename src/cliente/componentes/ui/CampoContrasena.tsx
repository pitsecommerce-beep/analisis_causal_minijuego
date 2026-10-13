import { useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { Icono } from './Iconos.js';

// Campo de contraseña con un botón de ojo para mostrar u ocultar lo que se escribe
export function CampoContrasena(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="campo-contrasena">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button type="button" className="campo-contrasena-ojo" onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
        <Icono nombre={visible ? 'ojoCerrado' : 'ojo'} tamano={18} />
      </button>
    </div>
  );
}
