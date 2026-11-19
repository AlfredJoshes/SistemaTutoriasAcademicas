const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  crearDisponibilidad,
  misDisponibilidades,
  eliminarDisponibilidad,
  slotsLibres,
} = require('../controllers/disponibilidad.controller');

const router = Router();

router.post('/', requireAuth, requireRole('tutor'), crearDisponibilidad);
router.get('/mias', requireAuth, requireRole('tutor'), misDisponibilidades);
router.delete('/:id', requireAuth, requireRole('tutor'), eliminarDisponibilidad);

// Horarios libres de un tutor en una fecha concreta (?fecha=AAAA-MM-DD&duracion=60)
router.get('/:tutorId/slots', requireAuth, slotsLibres);

module.exports = router;
