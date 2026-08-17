const { Router } = require('express');
const {
    crearOrden,
    obtenerOrdenes,
    obtenerOrdenPorId,
    cancelarOrden,
    recibirOrden
} = require('../controllers/compra.controllers');
const { verificarToken, verificarPermiso } = require('../middleware/auth.middleware');

const router = Router();

router.use(verificarToken);

router.get('/', verificarPermiso('compras.ver'), obtenerOrdenes);
router.get('/:id', verificarPermiso('compras.ver'), obtenerOrdenPorId);
router.post('/', verificarPermiso('compras.crear'), crearOrden);
router.post('/:id/recibir', verificarPermiso('compras.recibir'), recibirOrden);
router.delete('/:id', verificarPermiso('compras.cancelar'), cancelarOrden);

module.exports = router;
