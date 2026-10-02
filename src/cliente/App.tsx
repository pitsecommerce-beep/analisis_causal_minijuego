import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Inicio } from './paginas/Inicio.js';
import { Profesor } from './paginas/Profesor.js';
import { Unirse } from './paginas/Unirse.js';
import { Juego } from './paginas/Juego.js';
import { Resultados } from './paginas/Resultados.js';
import { ProveedorUI } from './componentes/ui/Notificaciones.js';

function Rutas() {
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  return (
    <div key={location.pathname} className="transicion-pagina">
      <Routes location={location}>
        <Route path="/" element={<Inicio />} />
        <Route path="/profesor/*" element={<Profesor />} />
        <Route path="/unirse" element={<Unirse />} />
        <Route path="/juego" element={<Juego />} />
        <Route path="/resultados" element={<Resultados />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export function App() {
  return (
    <ProveedorUI>
      <BrowserRouter>
        <Rutas />
      </BrowserRouter>
    </ProveedorUI>
  );
}
