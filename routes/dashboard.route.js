const { Router } = require('express');
const { verificarToken, verificarPermiso } = require('../middleware/auth.middleware');
const { obtenerResumen, obtenerVentasPorPeriodo } = require('../controllers/dashboard.controllers');

const router = Router();

router.use(verificarToken);
router.get('/resumen', verificarPermiso('dashboard.ver'), obtenerResumen);
router.get('/ventas-periodo', verificarPermiso('dashboard.ver'), obtenerVentasPorPeriodo);

module.exports = router;