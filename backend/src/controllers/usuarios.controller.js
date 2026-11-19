const usuariosService = require('../services/usuarios.service');

async function listarTutores(req, res) {
  try {
    const tutores = await usuariosService.listarTutoresConDisponibilidad();
    return res.json(tutores);
  } catch (err) {
    console.error('Error en listarTutores:', err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Error al listar tutores' });
  }
}

async function obtenerPerfil(req, res) {
  try {
    const perfil = await usuariosService.obtenerPerfilUsuario(req.usuario.id);
    return res.json(perfil);
  } catch (err) {
    console.error('Error en obtenerPerfil:', err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Error al obtener perfil' });
  }
}

module.exports = {
  listarTutores,
  obtenerPerfil,
};
