const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  listar,
  contador,
  marcarLeida,
  marcarTodasLeidas,
} = require('../controllers/notificaciones.controller');

const router = Router();

router.get('/', requireAuth, listar);
router.get('/contador', requireAuth, contador);
router.patch('/:id/leida', requireAuth, marcarLeida);
router.post('/leidas', requireAuth, marcarTodasLeidas);

module.exports = router;
