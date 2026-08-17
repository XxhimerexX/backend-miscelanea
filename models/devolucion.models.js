const { getConnection, sql } = require('../config/database');

class DevolucionModel {

    // Busca una venta ACTIVA por número de factura junto con sus líneas y lo
    // que ya se ha devuelto de cada una, para saber cuánto queda disponible.
    static async buscarVentaParaDevolucion(numeroFactura) {
        try {
            const pool = await getConnection();

            const ventaResult = await pool.request()
                .input('NumeroFactura', sql.VarChar, numeroFactura)
                .query(`
                    SELECT v.Id, v.NumeroFactura, v.FechaVenta, v.Estado, v.Total
                    FROM Ventas v
                    WHERE v.NumeroFactura = @NumeroFactura
                `);

            if (ventaResult.recordset.length === 0) return null;
            const venta = ventaResult.recordset[0];

            const detalleResult = await pool.request()
                .input('VentaId', sql.Int, venta.Id)
                .query(`
                    SELECT dv.Id, dv.ProductoId, dv.Cantidad, dv.PrecioUnitario, dv.Subtotal, dv.CantidadDevuelta,
                           (dv.Cantidad - dv.CantidadDevuelta) AS CantidadPendiente,
                           p.Nombre AS ProductoNombre, p.CodigoBarras
                    FROM DetalleVentas dv
                    JOIN Productos p ON p.Id = dv.ProductoId
                    WHERE dv.VentaId = @VentaId
                `);
            venta.items = detalleResult.recordset;

            return venta;
        } catch (error) {
            console.error('Error al buscar la venta para devolución:', error);
            throw error;
        }
    }

    static async crear(datosDevolucion) {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();
            const { ventaId, usuarioId, observaciones, items } = datosDevolucion;

            const venta = await new sql.Request(transaction)
                .input('VentaId', sql.Int, ventaId)
                .query(`SELECT Estado FROM Ventas WHERE Id = @VentaId`);

            if (venta.recordset.length === 0) {
                throw new Error('La venta de origen no existe.');
            }
            if (venta.recordset[0].Estado !== 'ACTIVO') {
                throw new Error('No se puede crear una devolución sobre una venta que no está activa.');
            }

            const devolucionResult = await new sql.Request(transaction)
                .input('VentaId', sql.Int, ventaId)
                .input('UsuarioId', sql.Int, usuarioId)
                .input('Observaciones', sql.NVarChar, observaciones || null)
                .query(`
                    INSERT INTO DevolucionesGarantias (VentaId, UsuarioId, Estado, Observaciones)
                    OUTPUT INSERTED.Id
                    VALUES (@VentaId, @UsuarioId, 'PENDIENTE', @Observaciones)
                `);
            const devolucionId = devolucionResult.recordset[0].Id;

            for (const item of items) {
                const detalleVentaId = parseInt(item.detalleVentaId, 10);
                const productoId = parseInt(item.productoId, 10);
                const cantidad = parseInt(item.cantidad, 10);
                const motivoCodigo = item.motivoCodigo;
                const reingresaStock = !!item.reingresaStock;
                const tipoResolucion = item.tipoResolucion;
                const productoReemplazoId = tipoResolucion === 'CAMBIO' ? parseInt(item.productoReemplazoId, 10) : null;

                if (!Number.isInteger(detalleVentaId) || !Number.isInteger(productoId) || !Number.isInteger(cantidad) || cantidad <= 0) {
                    throw new Error(`Línea de devolución inválida: detalleVentaId=${item.detalleVentaId}, productoId=${item.productoId}, cantidad=${item.cantidad}`);
                }
                if (!['DEFECTUOSO', 'NO_ERA_LO_ESPERADO', 'GARANTIA', 'OTRO'].includes(motivoCodigo)) {
                    throw new Error(`Motivo inválido: ${motivoCodigo}`);
                }
                if (!['REEMBOLSO', 'CAMBIO'].includes(tipoResolucion)) {
                    throw new Error(`Tipo de resolución inválido: ${tipoResolucion}`);
                }
                if (tipoResolucion === 'CAMBIO' && !Number.isInteger(productoReemplazoId)) {
                    throw new Error('Debes indicar el producto de reemplazo cuando la resolución es CAMBIO.');
                }

                // Chequeo informativo (no atómico): la validación que realmente impide
                // la sobre-devolución ocurre al autorizar, con el mismo patrón WHERE
                // atómico que usa la recepción de compras.
                const linea = await new sql.Request(transaction)
                    .input('DetalleVentaId', sql.Int, detalleVentaId)
                    .input('VentaId', sql.Int, ventaId)
                    .query(`
                        SELECT Cantidad, CantidadDevuelta, (Cantidad - CantidadDevuelta) AS Pendiente
                        FROM DetalleVentas WHERE Id = @DetalleVentaId AND VentaId = @VentaId
                    `);

                if (linea.recordset.length === 0) {
                    throw new Error(`La línea de venta ID ${detalleVentaId} no pertenece a esta factura.`);
                }
                if (cantidad > linea.recordset[0].Pendiente) {
                    throw new Error(`Cantidad a devolver inválida: pendiente disponible ${linea.recordset[0].Pendiente}, se intentó devolver ${cantidad}.`);
                }

                await new sql.Request(transaction)
                    .input('DevolucionGarantiaId', sql.Int, devolucionId)
                    .input('DetalleVentaId', sql.Int, detalleVentaId)
                    .input('ProductoId', sql.Int, productoId)
                    .input('Cantidad', sql.Int, cantidad)
                    .input('MotivoCodigo', sql.VarChar, motivoCodigo)
                    .input('ReingresaStock', sql.Bit, reingresaStock)
                    .input('TipoResolucion', sql.VarChar, tipoResolucion)
                    .input('ProductoReemplazoId', sql.Int, productoReemplazoId)
                    .query(`
                        INSERT INTO DetalleDevolucionesGarantias
                            (DevolucionGarantiaId, DetalleVentaId, ProductoId, Cantidad, MotivoCodigo, ReingresaStock, TipoResolucion, ProductoReemplazoId)
                        VALUES
                            (@DevolucionGarantiaId, @DetalleVentaId, @ProductoId, @Cantidad, @MotivoCodigo, @ReingresaStock, @TipoResolucion, @ProductoReemplazoId)
                    `);
            }

            await transaction.commit();
            return { success: true, devolucionId };
        } catch (error) {
            await transaction.rollback();
            throw new Error(`Error en la transacción de creación de la devolución: ${error.message}`);
        }
    }

    static async obtenerTodas(filtros = {}) {
        try {
            const pool = await getConnection();
            const request = pool.request();
            const condiciones = [];

            if (filtros.estado) {
                request.input('Estado', sql.VarChar, filtros.estado);
                condiciones.push('dg.Estado = @Estado');
            }
            if (filtros.usuarioId) {
                request.input('UsuarioId', sql.Int, filtros.usuarioId);
                condiciones.push('dg.UsuarioId = @UsuarioId');
            }
            if (filtros.fechaInicio) {
                request.input('FechaInicio', sql.Date, filtros.fechaInicio);
                condiciones.push('dg.FechaRegistro >= @FechaInicio');
            }
            if (filtros.fechaFin) {
                request.input('FechaFin', sql.Date, filtros.fechaFin);
                condiciones.push('dg.FechaRegistro < DATEADD(day, 1, @FechaFin)');
            }
            if (filtros.motivo) {
                request.input('Motivo', sql.VarChar, filtros.motivo);
                condiciones.push('EXISTS (SELECT 1 FROM DetalleDevolucionesGarantias ddg WHERE ddg.DevolucionGarantiaId = dg.Id AND ddg.MotivoCodigo = @Motivo)');
            }

            const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

            const result = await request.query(`
                SELECT dg.Id, dg.VentaId, v.NumeroFactura, dg.FechaRegistro, dg.Estado,
                       dg.FechaAutorizacion, dg.Observaciones,
                       u.Nombre AS Usuario, ua.Nombre AS UsuarioAutoriza
                FROM DevolucionesGarantias dg
                JOIN Ventas v ON v.Id = dg.VentaId
                JOIN Usuarios u ON u.Id = dg.UsuarioId
                LEFT JOIN Usuarios ua ON ua.Id = dg.UsuarioAutorizaId
                ${where}
                ORDER BY dg.FechaRegistro DESC
            `);
            return result.recordset;
        } catch (error) {
            console.error('Error al obtener las devoluciones:', error);
            throw error;
        }
    }

    static async obtenerPorId(id) {
        try {
            const pool = await getConnection();

            const cabeceraResult = await pool.request()
                .input('Id', sql.Int, id)
                .query(`
                    SELECT dg.*, v.NumeroFactura, u.Nombre AS Usuario, ua.Nombre AS UsuarioAutoriza
                    FROM DevolucionesGarantias dg
                    JOIN Ventas v ON v.Id = dg.VentaId
                    JOIN Usuarios u ON u.Id = dg.UsuarioId
                    LEFT JOIN Usuarios ua ON ua.Id = dg.UsuarioAutorizaId
                    WHERE dg.Id = @Id
                `);

            if (cabeceraResult.recordset.length === 0) return null;
            const devolucion = cabeceraResult.recordset[0];

            const detalleResult = await pool.request()
                .input('DevolucionGarantiaId', sql.Int, id)
                .query(`
                    SELECT ddg.*, p.Nombre AS ProductoNombre, pr.Nombre AS ProductoReemplazoNombre
                    FROM DetalleDevolucionesGarantias ddg
                    JOIN Productos p ON p.Id = ddg.ProductoId
                    LEFT JOIN Productos pr ON pr.Id = ddg.ProductoReemplazoId
                    WHERE ddg.DevolucionGarantiaId = @DevolucionGarantiaId
                `);
            devolucion.items = detalleResult.recordset;

            return devolucion;
        } catch (error) {
            console.error('Error al obtener la devolución por ID:', error);
            throw error;
        }
    }

    // Ejecuta el movimiento real de inventario: reingresa stock del producto
    // devuelto (si aplica) y descuenta el de reemplazo (si es CAMBIO), todo de
    // forma atómica con el mismo patrón WHERE que usa la recepción de compras.
    static async autorizar(id, usuarioAutorizaId) {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();

            const cabecera = await new sql.Request(transaction)
                .input('Id', sql.Int, id)
                .query(`SELECT Estado FROM DevolucionesGarantias WHERE Id = @Id`);

            if (cabecera.recordset.length === 0) {
                throw new Error('La devolución no existe.');
            }
            if (cabecera.recordset[0].Estado !== 'PENDIENTE') {
                throw new Error(`No se puede autorizar una devolución en estado ${cabecera.recordset[0].Estado}.`);
            }

            const detalle = await new sql.Request(transaction)
                .input('DevolucionGarantiaId', sql.Int, id)
                .query(`SELECT * FROM DetalleDevolucionesGarantias WHERE DevolucionGarantiaId = @DevolucionGarantiaId`);

            for (const linea of detalle.recordset) {
                const devolucionUpdate = await new sql.Request(transaction)
                    .input('DetalleVentaId', sql.Int, linea.DetalleVentaId)
                    .input('Cantidad', sql.Int, linea.Cantidad)
                    .query(`
                        UPDATE DetalleVentas
                        SET CantidadDevuelta = CantidadDevuelta + @Cantidad
                        OUTPUT INSERTED.Id
                        WHERE Id = @DetalleVentaId AND (CantidadDevuelta + @Cantidad) <= Cantidad
                    `);

                if (devolucionUpdate.recordset.length === 0) {
                    throw new Error(`No se pudo autorizar: la línea de venta ID ${linea.DetalleVentaId} ya no tiene suficiente cantidad pendiente por devolver (pudo haberse autorizado otra devolución sobre la misma línea mientras tanto).`);
                }

                if (linea.ReingresaStock) {
                    await new sql.Request(transaction)
                        .input('ProductoId', sql.Int, linea.ProductoId)
                        .input('Cantidad', sql.Int, linea.Cantidad)
                        .query(`
                            UPDATE Productos
                            SET Stock = Stock + @Cantidad, FechaActualizacion = GETDATE()
                            WHERE Id = @ProductoId
                        `);
                }

                if (linea.TipoResolucion === 'CAMBIO') {
                    const stockUpdate = await new sql.Request(transaction)
                        .input('ProductoReemplazoId', sql.Int, linea.ProductoReemplazoId)
                        .input('Cantidad', sql.Int, linea.Cantidad)
                        .query(`
                            UPDATE Productos
                            SET Stock = Stock - @Cantidad, FechaActualizacion = GETDATE()
                            OUTPUT INSERTED.Id
                            WHERE Id = @ProductoReemplazoId AND Stock >= @Cantidad
                        `);

                    if (stockUpdate.recordset.length === 0) {
                        const actual = await new sql.Request(transaction)
                            .input('ProductoReemplazoId', sql.Int, linea.ProductoReemplazoId)
                            .query('SELECT Nombre, Stock FROM Productos WHERE Id = @ProductoReemplazoId');
                        const producto = actual.recordset[0];
                        throw new Error(`Stock insuficiente para el producto de reemplazo '${producto ? producto.Nombre : linea.ProductoReemplazoId}': disponible ${producto ? producto.Stock : 0}, se requieren ${linea.Cantidad}.`);
                    }
                }
            }

            const finalUpdate = await new sql.Request(transaction)
                .input('Id', sql.Int, id)
                .input('UsuarioAutorizaId', sql.Int, usuarioAutorizaId)
                .query(`
                    UPDATE DevolucionesGarantias
                    SET Estado = 'AUTORIZADA', UsuarioAutorizaId = @UsuarioAutorizaId, FechaAutorizacion = GETDATE()
                    OUTPUT INSERTED.Id
                    WHERE Id = @Id AND Estado = 'PENDIENTE'
                `);

            if (finalUpdate.recordset.length === 0) {
                throw new Error('La devolución ya no está pendiente (pudo haber sido autorizada o rechazada por otro usuario).');
            }

            await transaction.commit();
            return { success: true, id };
        } catch (error) {
            await transaction.rollback();
            throw new Error(`Error en la transacción de autorización: ${error.message}`);
        }
    }

    static async rechazar(id, usuarioAutorizaId) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('Id', sql.Int, id)
                .input('UsuarioAutorizaId', sql.Int, usuarioAutorizaId)
                .query(`
                    UPDATE DevolucionesGarantias
                    SET Estado = 'RECHAZADA', UsuarioAutorizaId = @UsuarioAutorizaId, FechaAutorizacion = GETDATE()
                    OUTPUT INSERTED.Id
                    WHERE Id = @Id AND Estado = 'PENDIENTE'
                `);

            if (result.recordset.length === 0) {
                throw new Error('La devolución ya no está pendiente o no existe.');
            }

            return { id };
        } catch (error) {
            console.error('Error al rechazar la devolución:', error);
            throw error;
        }
    }
}

module.exports = DevolucionModel;
