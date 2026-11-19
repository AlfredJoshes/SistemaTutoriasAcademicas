import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(() => {
    const savedUser = localStorage.getItem('usuario');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('token') || null;
  });

  const [cargando, setCargando] = useState(false);

  const login = (userData, tokenData) => {
    setUsuario(userData);
    setToken(tokenData);
    localStorage.setItem('usuario', JSON.stringify(userData));
    localStorage.setItem('token', tokenData);
  };

  const logout = () => {
    setUsuario(null);
    setToken(null);
    localStorage.removeItem('usuario');
    localStorage.removeItem('token');
  };

  const actualizarUsuario = (updatedUser) => {
    setUsuario(updatedUser);
    localStorage.setItem('usuario', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        token,
        cargando,
        isAuthenticated: !!token,
        login,
        logout,
        actualizarUsuario,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
