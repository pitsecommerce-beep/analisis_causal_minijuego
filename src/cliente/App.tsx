import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Inicio } from './paginas/Inicio.js';
import { Profesor } from './paginas/Profesor.js';
import { Unirse } from './paginas/Unirse.js';
import { Juego } from './paginas/Juego.js';
import { Resultados } from './paginas/Resultados.js';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/profesor/*" element={<Profesor />} />
        <Route path="/unirse" element={<Unirse />} />
        <Route path="/juego" element={<Juego />} />
        <Route path="/resultados" element={<Resultados />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
