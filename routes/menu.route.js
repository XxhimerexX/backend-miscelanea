const { Router } = require('express');
const { verificarToken } = require('../middleware/auth.middleware');
const { obtenerMenu } = require('../controllers/menu.controlleres');

const router = Router();
router.get('/', verificarToken, obtenerMenu);
module.exports = router;