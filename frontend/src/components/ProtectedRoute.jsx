import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ProtectedRoute = ({ rolesPermitidos }) => {
  const { usuario, isAuthenticated } = useContext(AuthContext);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (rolesPermitidos && !rolesPermitidos.includes(usuario?.rol)) {
    // Redirigir segun su rol si intenta acceder a una vista no permitida
    const defaultRedirect =
      usuario?.rol === 'tutor'
        ? '/disponibilidad'
        : usuario?.rol === 'coordinador'
        ? '/registros'
        : '/tutores';
    return <Navigate to={defaultRedirect} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
