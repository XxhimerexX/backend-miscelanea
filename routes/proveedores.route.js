const { Router } = require('express');
const {
    listarProveedores,
    obtenerProveedor,
    crearProveedor,
    actualizarProveedor,
    cambiarEstadoProveedor
} = require('../controllers/proveedor.controllers');
const { verificarToken, verificarPermiso } = require('../middleware/auth.middleware');

const router = Router();

router.use(verificarToken);

router.get('/', verificarPermiso('proveedores.ver'), listarProveedores);
router.get('/:id', verificarPermiso('proveedores.ver'), obtenerProveedor);
router.post('/', verificarPermiso('proveedores.crear'), crearProveedor);
router.put('/:id', verificarPermiso('proveedores.editar'), actualizarProveedor);
router.patch('/:id/estado', verificarPermiso('proveedores.editar'), cambiarEstadoProveedor);

module.exports = router;
