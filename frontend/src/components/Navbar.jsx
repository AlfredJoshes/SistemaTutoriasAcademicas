import React, { useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../api/axios';
import Notificaciones from './Notificaciones';
import { GraduationCap } from 'lucide-react';

// Iniciales del nombre para el recuadro de identidad
const iniciales = (nombre = '') =>
  nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();

const ROTULO_ROL = {
  tutor: 'Tutor',
  estudiante: 'Estudiante',
  coordinador: 'Coordinación',
};

const Navbar = () => {
  const { usuario, logout, isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  if (!isAuthenticated) return null;

  const handleLogout = async () => {
    // Se avisa al backend para que el cierre quede en la bitacora de accesos
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('No se pudo registrar el cierre de sesión:', err);
    }
    logout();
    navigate('/login');
  };

  const rol = usuario?.rol;
  const isTutor = rol === 'tutor';
  const isEstudiante = rol === 'estudiante';
  const isCoordinador = rol === 'coordinador';

  const enlaces = [
    isEstudiante && { to: '/tutores', label: 'Tutores' },
    isTutor && { to: '/disponibilidad', label: 'Disponibilidad' },
    !isCoordinador && { to: '/sesiones', label: 'Sesiones' },
    { to: '/dashboard', label: 'Resumen' },
    { to: '/seguridad', label: 'Seguridad' },
    isCoordinador && { to: '/registros', label: 'Registros' },
  ].filter(Boolean);

  // Cada rol aterriza donde tiene trabajo por hacer
  const inicio = isCoordinador ? '/registros' : isTutor ? '/sesiones' : '/tutores';

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to={inicio} className="topbar-brand">
          <GraduationCap size={19} strokeWidth={1.75} />
          <span>Seguimiento de Tutorías Académicas</span>
        </Link>

        <nav className="topbar-nav">
          {enlaces.map((e) => (
            <Link
              key={e.to}
              to={e.to}
              className={`topbar-link ${location.pathname === e.to ? 'is-active' : ''}`}
            >
              {e.label}
            </Link>
          ))}
        </nav>

        <div className="topbar-user">
          {/* La coordinación supervisa, no participa en las sesiones */}
          {!isCoordinador && <Notificaciones />}

          <span className="avatar" aria-hidden="true">
            {iniciales(usuario?.nombre_completo)}
          </span>
          <span className="topbar-identity">
            <span className="topbar-name">{usuario?.nombre_completo}</span>
            <span className="topbar-role">{ROTULO_ROL[rol] || 'Usuario'}</span>
          </span>
          <button onClick={handleLogout} className="topbar-exit">
            Salir
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
