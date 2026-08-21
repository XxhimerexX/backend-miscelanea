const { Router } = require('express');
const {
    listarProveedores,
    obtenerProveedor,
    crearProveedor,
    actualizarProveedor,
    cambiarEstadoProveedor,
    subirDocumento,
    descargarDocumento,
    obtenerProductosDeProveedor,
    listarDocumentos,
    asociarProductos,
    eliminarDocumento
} = require('../controllers/proveedor.controllers');
const { verificarToken, verificarPermiso } = require('../middleware/auth.middleware');

const router = Router();

router.use(verificarToken);

router.get('/', verificarPermiso('proveedores.ver'), listarProveedores);
router.get('/:id', verificarPermiso('proveedores.ver'), obtenerProveedor);
router.post('/', verificarPermiso('proveedores.crear'), crearProveedor);
router.put('/:id', verificarPermiso('proveedores.editar'), actualizarProveedor);
router.patch('/:id/estado', verificarPermiso('proveedores.editar'), cambiarEstadoProveedor);

// Productos que vende el proveedor
router.put('/:id/productos', verificarToken, verificarPermiso('proveedores.editar'), asociarProductos);
router.get('/:id/productos', verificarToken, verificarPermiso('proveedores.ver'), obtenerProductosDeProveedor);

// Documentos del proveedor (RUT, Cámara de Comercio, Lista de Precios, Otros)
router.post('/:id/documentos', verificarToken, verificarPermiso('proveedores.editar'), subirDocumento);
router.get('/:id/documentos', verificarToken, verificarPermiso('proveedores.ver'), listarDocumentos);
router.get('/documentos/:documentoId/descargar', verificarToken, verificarPermiso('proveedores.ver'), descargarDocumento);
router.delete('/documentos/:documentoId', verificarToken, verificarPermiso('proveedores.editar'), eliminarDocumento);

module.exports = router;
