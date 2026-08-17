const { getConnection, sql } = require('../config/database');

class AuthModel {
  static async buscarPorCorreo(correo) {
    const pool = await getConnection();
    const result = await pool.request()
      .input('Correo', sql.VarChar, correo)
      .query(`
        SELECT u.Id, u.Nombre, u.Correo, u.Contrasena, u.RolId, u.Activo,
               r.Nombre AS RolNombre, r.EsAdmin
        FROM Usuarios u
        JOIN Roles r ON r.Id = u.RolId
        WHERE u.Correo = @Correo
      `);
    return result.recordset[0] || null;
  }

  static async obtenerPermisosDeRol(rolId) {
    const pool = await getConnection();
    const result = await pool.request()
      .input('RolId', sql.Int, rolId)
      .query(`
        SELECT p.Codigo
        FROM RolPermisos rp
        JOIN Permisos p ON p.Id = rp.PermisoId
        WHERE rp.RolId = @RolId
      `);
    return result.recordset.map(r => r.Codigo);
  }

  static async crearUsuario(datos) {
    const pool = await getConnection();
    const result = await pool.request()
      .input('Nombre', sql.NVarChar, datos.nombre)
      .input('Correo', sql.NVarChar, datos.correo)
      .input('Contrasena', sql.NVarChar, datos.contrasenaHasheada)
      .input('RolId', sql.Int, datos.rolId)
      .query(`
        INSERT INTO Usuarios (Nombre, Correo, Contrasena, RolId, Activo, FechaCreacion)
        OUTPUT INSERTED.Id
        VALUES (@Nombre, @Correo, @Contrasena, @RolId, 1, GETDATE())
      `);
    return result.recordset[0].Id;
  }

  static async listarUsuarios() {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT u.Id, u.Nombre, u.Correo, u.Activo, u.FechaCreacion, u.RolId, r.Nombre AS RolNombre
      FROM Usuarios u
      JOIN Roles r ON r.Id = u.RolId
      ORDER BY u.Nombre
    `);
    return result.recordset;
  }

  static async obtenerRoles() {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT Id, Nombre FROM Roles ORDER BY Nombre');
    return result.recordset;
  }

  static async actualizarUsuario(id, datos) {
    const pool = await getConnection();
    await pool.request()
      .input('Id', sql.Int, id)
      .input('Nombre', sql.NVarChar, datos.nombre)
      .input('RolId', sql.Int, datos.rolId)
      .input('Activo', sql.Bit, datos.activo)
      .query(`
        UPDATE Usuarios
        SET Nombre = @Nombre, RolId = @RolId, Activo = @Activo
        WHERE Id = @Id
      `);
    return { id };
  }
}

module.exports = AuthModel;