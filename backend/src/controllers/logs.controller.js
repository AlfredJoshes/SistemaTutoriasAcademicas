const logsService = require('../services/logs.service');

async function listar(req, res) {
  try {
    const resultado = await logsService.listarLogs(req.usuario, req.query);
    return res.json(resultado);
  } catch (err) {
    console.error('Error al listar logs:', err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Error al listar la bitácora de accesos' });
  }
}

async function resumen(req, res) {
  try {
    const resultado = await logsService.resumenLogs(req.usuario, req.query);
    return res.json(resultado);
  } catch (err) {
    console.error('Error al resumir logs:', err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Error al resumir la bitácora' });
  }
}

function eventos(req, res) {
  return res.json({ eventos: logsService.EVENTOS });
}

module.exports = { listar, resumen, eventos };
