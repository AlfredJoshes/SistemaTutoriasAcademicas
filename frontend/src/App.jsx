import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import TutoresPage from './pages/TutoresPage';
import DisponibilidadPage from './pages/DisponibilidadPage';
import SesionesPage from './pages/SesionesPage';
import DashboardPage from './pages/DashboardPage';
import SeguridadPage from './pages/SeguridadPage';
import LogsPage from './pages/LogsPage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <main>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Rutas exclusivas para tutores y estudiantes (no aplicables a coordinación) */}
            <Route element={<ProtectedRoute rolesPermitidos={['estudiante', 'tutor']} />}>
              <Route path="/tutores" element={<TutoresPage />} />
            </Route>
            <Route element={<ProtectedRoute rolesPermitidos={['tutor', 'estudiante']} />}>
              <Route path="/sesiones" element={<SesionesPage />} />
            </Route>

            {/* Rutas compartidas por todos los usuarios autenticados */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/seguridad" element={<SeguridadPage />} />
            </Route>

            {/* Ruta exclusiva para coordinación académica */}
            <Route element={<ProtectedRoute rolesPermitidos={['coordinador']} />}>
              <Route path="/registros" element={<LogsPage />} />
            </Route>

            {/* Ruta exclusiva para tutores */}
            <Route element={<ProtectedRoute rolesPermitidos={['tutor']} />}>
              <Route path="/disponibilidad" element={<DisponibilidadPage />} />
            </Route>

            {/* Redireccion por defecto */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>
      </Router>
    </AuthProvider>
  );
}

export default App;
