const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { registrarBitacora, resumenDashboard } = require('../controllers/bitacora.controller');

const router = Router();

router.post('/', requireAuth, requireRole('tutor'), registrarBitacora);
router.get('/dashboard', requireAuth, resumenDashboard);

module.exports = router;
