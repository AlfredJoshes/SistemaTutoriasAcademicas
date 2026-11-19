const authService = require('../services/auth.service');

async function registrar(req, res) {
  try {
    const resultado = await authService.registrarUsuario(req, req.body);
    return res.status(201).json(resultado);
  } catch (err) {
    console.error('Error en registrar:', err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Error al registrar usuario' });
  }
}

async function login(req, res) {
  try {
    const resultado = await authService.loginUsuario(req, req.body);
    return res.json(resultado);
  } catch (err) {
    console.error('Error en login:', err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Error al iniciar sesión' });
  }
}

async function logout(req, res) {
  try {
    const resultado = await authService.cerrarSesion(req, req.usuario);
    return res.json(resultado);
  } catch (err) {
    console.error('Error en logout:', err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Error al cerrar sesión' });
  }
}

async function perfil(req, res) {
  try {
    const usuario = await authService.obtenerPerfil(req.usuario.id);
    return res.json(usuario);
  } catch (err) {
    console.error('Error en perfil:', err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Error al obtener el perfil' });
  }
}

module.exports = {
  registrar,
  login,
  logout,
  perfil,
};
