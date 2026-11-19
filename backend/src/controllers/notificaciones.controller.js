const notificacionesService = require('../services/notificaciones.service');

function responderError(res, err, mensajeGenerico) {
  console.error(`${mensajeGenerico}:`, err.message);
  const status = err.status || 500;
  return res.status(status).json({ error: err.message || mensajeGenerico });
}

async function listar(req, res) {
  try {
    const resultado = await notificacionesService.listar(req.usuario.id, {
      solo_no_leidas: req.query.solo_no_leidas,
      limite: req.query.limite,
    });
    return res.json(resultado);
  } catch (err) {
    return responderError(res, err, 'Error al listar las notificaciones');
  }
}

async function contador(req, res) {
  try {
    return res.json(await notificacionesService.contarNoLeidas(req.usuario.id));
  } catch (err) {
    return responderError(res, err, 'Error al contar las notificaciones');
  }
}

async function marcarLeida(req, res) {
  try {
    return res.json(await notificacionesService.marcarLeida(req.params.id, req.usuario.id));
  } catch (err) {
    return responderError(res, err, 'Error al marcar la notificación');
  }
}

async function marcarTodasLeidas(req, res) {
  try {
    return res.json(await notificacionesService.marcarTodasLeidas(req.usuario.id));
  } catch (err) {
    return responderError(res, err, 'Error al marcar las notificaciones');
  }
}

module.exports = { listar, contador, marcarLeida, marcarTodasLeidas };
