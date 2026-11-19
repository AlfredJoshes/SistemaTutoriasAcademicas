const bitacoraService = require('../services/bitacora.service');

async function registrarBitacora(req, res) {
  try {
    const bitacora = await bitacoraService.registrarBitacora(req.usuario.id, req.body);
    return res.status(201).json(bitacora);
  } catch (err) {
    console.error('Error en registrarBitacora:', err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Error al registrar bitácora' });
  }
}

async function resumenDashboard(req, res) {
  try {
    const dashboard = await bitacoraService.obtenerResumenDashboard(req.usuario);
    return res.json(dashboard);
  } catch (err) {
    console.error('Error en resumenDashboard:', err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Error al generar el dashboard' });
  }
}

module.exports = {
  registrarBitacora,
  resumenDashboard,
};
