const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'cambia_esto_en_produccion';

const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'No se proporcionó un token de acceso.' });
  }

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado.' });
    }
    req.usuario = payload; // { id, rolId, esAdmin, permisos }
    next();
  });
};

// Genera un middleware que exige un permiso específico
const verificarPermiso = (codigoPermiso) => (req, res, next) => {
  if (!req.usuario) {
    return res.status(401).json({ error: 'No autenticado.' });
  }
  if (req.usuario.esAdmin || req.usuario.permisos.includes(codigoPermiso)) {
    return next();
  }
  return res.status(403).json({ error: 'No tienes permiso para realizar esta acción.' });
};

module.exports = { verificarToken, verificarPermiso };