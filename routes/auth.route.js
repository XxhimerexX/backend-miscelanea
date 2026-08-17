const { Router } = require('express');
const { verificarToken, verificarPermiso } = require('../middleware/auth.middleware');
const { login, registrar, listarUsuarios, listarRoles, actualizarUsuario } = require('../controllers/auth.controlleres');

const router = Router();

router.post('/login', login); // pública

// A partir de aquí, todo exige estar logueado y tener permiso de gestión de usuarios
router.post('/registrar', verificarToken, verificarPermiso('usuarios.crear'), registrar);
router.get('/usuarios', verificarToken, verificarPermiso('usuarios.ver'), listarUsuarios);
router.get('/roles', verificarToken, verificarPermiso('usuarios.ver'), listarRoles);
router.put('/usuarios/:id', verificarToken, verificarPermiso('usuarios.editar'), actualizarUsuario);

module.exports = router;