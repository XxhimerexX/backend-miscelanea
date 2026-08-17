const MenuModel = require('../models/menu.model');
const { detalleError } = require('../utils/errorResponse');

const obtenerMenu = async (req, res) => {
  try {
    const menuCompleto = await MenuModel.obtenerMenuCompleto();
    const usuario = req.usuario; // ya decodificado por verificarToken

    const menuFiltrado = menuCompleto
      .filter((item) => {
        if (!item.PermisoCodigo) return true; // sin permiso requerido = visible para cualquiera logueado
        if (usuario.esAdmin) return true;
        return usuario.permisos.includes(item.PermisoCodigo);
      })
      .map(({ PermisoCodigo, ...resto }) => resto); // no exponemos el código de permiso, el front ya no lo necesita

    res.status(200).json(menuFiltrado);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el menú', detalle: detalleError(error) });
  }
};

module.exports = { obtenerMenu };