const { Router } = require('express');
const { obtenerEstadoCaja, abrirCaja, cerrarCaja, obtenerResumenTurno } = require('../controllers/caja.controlleres');
const { verificarToken, verificarPermiso } = require('../middleware/auth.middleware');

const router = Router();

router.use(verificarToken);

router.get('/estado', obtenerEstadoCaja);
router.get('/resumen-turno', obtenerResumenTurno);
router.post('/abrir', verificarPermiso('caja.usar'), abrirCaja);
router.post('/cerrar', verificarPermiso('caja.usar'), cerrarCaja);

module.exports = router;