const disponibilidadService = require('../services/disponibilidad.service');

async function crearDisponibilidad(req, res) {
  try {
    const disponibilidad = await disponibilidadService.crearDisponibilidad(req.usuario.id, req.body);
    return res.status(201).json(disponibilidad);
  } catch (err) {
    console.error('Error en crearDisponibilidad:', err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Error al crear disponibilidad' });
  }
}

async function misDisponibilidades(req, res) {
  try {
    const disponibilidades = await disponibilidadService.obtenerDisponibilidadTutor(req.usuario.id);
    return res.json(disponibilidades);
  } catch (err) {
    console.error('Error en misDisponibilidades:', err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Error al obtener disponibilidades' });
  }
}

async function eliminarDisponibilidad(req, res) {
  try {
    await disponibilidadService.eliminarDisponibilidad(req.params.id, req.usuario.id);
    return res.status(204).send();
  } catch (err) {
    console.error('Error en eliminarDisponibilidad:', err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Error al eliminar disponibilidad' });
  }
}

// Bloques libres de un tutor en una fecha: lo consume el modal de solicitud
async function slotsLibres(req, res) {
  try {
    const slots = await disponibilidadService.obtenerSlotsLibres(
      req.params.tutorId,
      req.query.fecha,
      req.query.duracion
    );
    return res.json(slots);
  } catch (err) {
    console.error('Error en slotsLibres:', err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Error al calcular los horarios libres' });
  }
}

module.exports = {
  crearDisponibilidad,
  misDisponibilidades,
  eliminarDisponibilidad,
  slotsLibres,
};
