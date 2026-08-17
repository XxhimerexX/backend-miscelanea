const { getConnection, sql } = require('../config/database');

class ProveedorModel {

    static async listar(soloActivos = false) {
        try {
            const pool = await getConnection();
            const filtro = soloActivos ? 'WHERE Activo = 1' : '';
            const result = await pool.request().query(`
                SELECT * FROM Proveedores
                ${filtro}
                ORDER BY RazonSocial
            `);
            return result.recordset;
        } catch (error) {
            console.error('Error al listar proveedores:', error);
            throw error;
        }
    }

    static async obtenerPorId(id) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('Id', sql.Int, id)
                .query('SELECT * FROM Proveedores WHERE Id = @Id');
            return result.recordset[0] || null;
        } catch (error) {
            console.error('Error al obtener proveedor por ID:', error);
            throw error;
        }
    }

    static async crear(datos) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('RazonSocial', sql.NVarChar, datos.RazonSocial)
                .input('NIT', sql.VarChar, datos.NIT)
                .input('Telefono', sql.VarChar, datos.Telefono || null)
                .input('Correo', sql.VarChar, datos.Correo || null)
                .input('Direccion', sql.NVarChar, datos.Direccion || null)
                .input('Contacto', sql.NVarChar, datos.Contacto || null)
                .query(`
                    INSERT INTO Proveedores (RazonSocial, NIT, Telefono, Correo, Direccion, Contacto)
                    OUTPUT INSERTED.Id
                    VALUES (@RazonSocial, @NIT, @Telefono, @Correo, @Direccion, @Contacto)
                `);
            return { id: result.recordset[0].Id };
        } catch (error) {
            console.error('Error al crear proveedor:', error);
            throw error;
        }
    }

    static async actualizar(id, datos) {
        try {
            const pool = await getConnection();
            await pool.request()
                .input('Id', sql.Int, id)
                .input('RazonSocial', sql.NVarChar, datos.RazonSocial)
                .input('NIT', sql.VarChar, datos.NIT)
                .input('Telefono', sql.VarChar, datos.Telefono || null)
                .input('Correo', sql.VarChar, datos.Correo || null)
                .input('Direccion', sql.NVarChar, datos.Direccion || null)
                .input('Contacto', sql.NVarChar, datos.Contacto || null)
                .query(`
                    UPDATE Proveedores
                    SET RazonSocial = @RazonSocial,
                        NIT = @NIT,
                        Telefono = @Telefono,
                        Correo = @Correo,
                        Direccion = @Direccion,
                        Contacto = @Contacto
                    WHERE Id = @Id
                `);
            return { id };
        } catch (error) {
            console.error('Error al actualizar proveedor:', error);
            throw error;
        }
    }

    static async cambiarEstado(id, activo) {
        try {
            const pool = await getConnection();
            await pool.request()
                .input('Id', sql.Int, id)
                .input('Activo', sql.Bit, activo)
                .query('UPDATE Proveedores SET Activo = @Activo WHERE Id = @Id');
            return { id, activo };
        } catch (error) {
            console.error('Error al cambiar estado del proveedor:', error);
            throw error;
        }
    }
}

module.exports = ProveedorModel;
