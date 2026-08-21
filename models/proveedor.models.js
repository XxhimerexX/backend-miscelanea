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

    // --- Relación Proveedor <-> Productos ---

    // Reemplaza por completo la lista de productos que vende este proveedor
    // (borra las asociaciones anteriores e inserta las nuevas, en una transacción).
    static async asociarProductos(proveedorId, productoIds) {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();

            await new sql.Request(transaction)
                .input('ProveedorId', sql.Int, proveedorId)
                .query('DELETE FROM ProveedorProductos WHERE ProveedorId = @ProveedorId');

            for (const productoId of productoIds) {
                await new sql.Request(transaction)
                    .input('ProveedorId', sql.Int, proveedorId)
                    .input('ProductoId', sql.Int, parseInt(productoId, 10))
                    .query('INSERT INTO ProveedorProductos (ProveedorId, ProductoId) VALUES (@ProveedorId, @ProductoId)');
            }

            await transaction.commit();
            return { proveedorId, totalProductos: productoIds.length };
        } catch (error) {
            await transaction.rollback();
            console.error('Error al asociar productos al proveedor:', error);
            throw error;
        }
    }

    static async obtenerProductos(proveedorId) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('ProveedorId', sql.Int, proveedorId)
                .query(`
                    SELECT p.Id, p.Nombre, p.CodigoBarras, p.PrecioCosto, p.PrecioVenta, p.Stock
                    FROM ProveedorProductos pp
                    JOIN Productos p ON p.Id = pp.ProductoId
                    WHERE pp.ProveedorId = @ProveedorId
                    ORDER BY p.Nombre
                `);
            return result.recordset;
        } catch (error) {
            console.error('Error al obtener productos del proveedor:', error);
            throw error;
        }
    }

    // --- Documentos del proveedor (RUT, Cámara de Comercio, Lista de Precios, Otros) ---
    // El contenido del archivo se guarda directo en la base de datos (VARBINARY(MAX))
    // para no depender del disco del servidor, que en Azure App Service es efímero.

    static async guardarDocumento(datos) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('ProveedorId', sql.Int, datos.proveedorId)
                .input('TipoDocumento', sql.VarChar, datos.tipoDocumento)
                .input('NombreOriginal', sql.NVarChar, datos.nombreOriginal)
                .input('ArchivoContenido', sql.VarBinary(sql.MAX), datos.archivoContenido)
                .input('ArchivoMimeType', sql.VarChar, datos.archivoMimeType)
                .input('ArchivoTamano', sql.Int, datos.archivoTamano)
                .input('UsuarioId', sql.Int, datos.usuarioId)
                .query(`
                    INSERT INTO ProveedorDocumentos (ProveedorId, TipoDocumento, NombreOriginal, ArchivoContenido, ArchivoMimeType, ArchivoTamano, UsuarioId)
                    OUTPUT INSERTED.Id
                    VALUES (@ProveedorId, @TipoDocumento, @NombreOriginal, @ArchivoContenido, @ArchivoMimeType, @ArchivoTamano, @UsuarioId)
                `);
            return { id: result.recordset[0].Id };
        } catch (error) {
            console.error('Error al guardar el documento del proveedor:', error);
            throw error;
        }
    }

    // Solo metadatos (sin el binario) — listar todos los documentos de golpe con su
    // contenido completo sería pesado; el binario se trae aparte al descargar uno.
    static async listarDocumentos(proveedorId) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('ProveedorId', sql.Int, proveedorId)
                .query(`
                    SELECT pd.Id, pd.ProveedorId, pd.TipoDocumento, pd.NombreOriginal,
                           pd.ArchivoMimeType, pd.ArchivoTamano, pd.FechaCarga, pd.UsuarioId,
                           u.Nombre AS UsuarioNombre
                    FROM ProveedorDocumentos pd
                    JOIN Usuarios u ON u.Id = pd.UsuarioId
                    WHERE pd.ProveedorId = @ProveedorId
                    ORDER BY pd.FechaCarga DESC
                `);
            return result.recordset;
        } catch (error) {
            console.error('Error al listar documentos del proveedor:', error);
            throw error;
        }
    }

    // Este sí trae el binario completo — solo se usa al descargar un documento puntual.
    static async obtenerDocumentoPorId(documentoId) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('Id', sql.Int, documentoId)
                .query('SELECT * FROM ProveedorDocumentos WHERE Id = @Id');
            return result.recordset[0] || null;
        } catch (error) {
            console.error('Error al obtener el documento:', error);
            throw error;
        }
    }

    static async eliminarDocumento(documentoId) {
        try {
            const pool = await getConnection();
            await pool.request()
                .input('Id', sql.Int, documentoId)
                .query('DELETE FROM ProveedorDocumentos WHERE Id = @Id');
            return { id: documentoId };
        } catch (error) {
            console.error('Error al eliminar el documento:', error);
            throw error;
        }
    }
}

module.exports = ProveedorModel;