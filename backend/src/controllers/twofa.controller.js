const twofaService = require('../services/twofa.service');

function responderError(res, err, mensajeGenerico) {
  console.error(`${mensajeGenerico}:`, err.message);
  const status = err.status || 500;
  return res.status(status).json({ error: err.message || mensajeGenerico });
}

async function estado(req, res) {
  try {
    return res.json(await twofaService.obtenerEstado(req.usuario.id));
  } catch (err) {
    return responderError(res, err, 'Error al consultar el autenticador');
  }
}

async function configurar(req, res) {
  try {
    return res.json(await twofaService.iniciarConfiguracion(req.usuario.id));
  } catch (err) {
    return responderError(res, err, 'Error al generar el código QR');
  }
}

async function activar(req, res) {
  try {
    return res.json(await twofaService.confirmarActivacion(req, req.usuario.id, req.body.codigo));
  } catch (err) {
    return responderError(res, err, 'Error al activar el autenticador');
  }
}

async function desactivar(req, res) {
  try {
    return res.json(await twofaService.desactivar(req, req.usuario.id, req.body));
  } catch (err) {
    return responderError(res, err, 'Error al desactivar el autenticador');
  }
}

async function regenerarCodigos(req, res) {
  try {
    return res.json(await twofaService.regenerarCodigosRespaldo(req, req.usuario.id, req.body));
  } catch (err) {
    return responderError(res, err, 'Error al generar códigos de respaldo');
  }
}

// Paso 2 del login: es publico porque el usuario aun no tiene token de acceso
async function verificar(req, res) {
  try {
    return res.json(await twofaService.verificarSegundoFactor(req, req.body));
  } catch (err) {
    return responderError(res, err, 'Error al verificar el código');
  }
}

module.exports = {
  estado,
  configurar,
  activar,
  desactivar,
  regenerarCodigos,
  verificar,
};
