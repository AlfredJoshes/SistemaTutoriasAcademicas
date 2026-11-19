const sesionesService = require('../services/sesiones.service');

async function solicitarSesion(req, res) {
  try {
    const sesion = await sesionesService.solicitarSesion(req.usuario.id, req.body);
    return res.status(201).json(sesion);
  } catch (err) {
    console.error('Error en solicitarSesion:', err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Error al solicitar sesión' });
  }
}

async function misSesiones(req, res) {
  try {
    const sesiones = await sesionesService.listarSesionesUsuario(req.usuario.id, req.usuario.rol);
    return res.json(sesiones);
  } catch (err) {
    console.error('Error en misSesiones:', err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Error al obtener sesiones' });
  }
}

async function actualizarEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    const sesionActualizada = await sesionesService.actualizarEstadoSesion(id, req.usuario, estado);
    return res.json(sesionActualizada);
  } catch (err) {
    console.error('Error en actualizarEstado:', err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Error al actualizar estado de la sesión' });
  }
}

module.exports = {
  solicitarSesion,
  misSesiones,
  actualizarEstado,
};
