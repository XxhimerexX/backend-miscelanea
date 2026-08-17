const { getConnection } = require('../config/database');

class MenuModel {
  static async obtenerMenuCompleto() {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT mi.Id, mi.Etiqueta, mi.Ruta, mi.Icono, mi.Orden, p.Codigo AS PermisoCodigo
      FROM MenuItems mi
      LEFT JOIN Permisos p ON p.Id = mi.PermisoId
      WHERE mi.Activo = 1
      ORDER BY mi.Orden ASC
    `);
    return result.recordset;
  }
}

module.exports = MenuModel;