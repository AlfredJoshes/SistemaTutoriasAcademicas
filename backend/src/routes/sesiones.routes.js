const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  solicitarSesion,
  misSesiones,
  actualizarEstado,
} = require('../controllers/sesiones.controller');

const router = Router();

router.post('/', requireAuth, requireRole('estudiante'), solicitarSesion);
router.get('/mias', requireAuth, misSesiones);
router.patch('/:id/estado', requireAuth, actualizarEstado);

module.exports = router;
