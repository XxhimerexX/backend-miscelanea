const { getConnection, sql } = require('../config/database');

class CompraModel {

    static async registrarOrden(datosOrden) {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();
            const { proveedorId, usuarioId, fechaEsperada, observaciones, items } = datosOrden;

            let total = 0;
            const itemsValidados = items.map((item) => {
                const productoId = parseInt(item.productoId, 10);
                const cantidadPedida = parseInt(item.cantidadPedida, 10);
                const costoUnitario = parseFloat(item.costoUnitario);
                // Descuento por línea en porcentaje (0-100). Si no viene, se asume 0.
                const descuentoPorcentaje = item.descuentoPorcentaje !== undefined && item.descuentoPorcentaje !== null
                    ? parseFloat(item.descuentoPorcentaje) : 0;
                const observacion = item.observacion ? String(item.observacion).trim() : null;

                if (!Number.isInteger(productoId) || !Number.isInteger(cantidadPedida) || cantidadPedida <= 0 || isNaN(costoUnitario) || costoUnitario < 0) {
                    throw new Error(`Ítem de orden inválido: productoId=${item.productoId}, cantidadPedida=${item.cantidadPedida}, costoUnitario=${item.costoUnitario}`);
                }
                if (isNaN(descuentoPorcentaje) || descuentoPorcentaje < 0 || descuentoPorcentaje > 100) {
                    throw new Error(`Descuento inválido para el producto ID ${productoId}: debe estar entre 0 y 100.`);
                }

                const subtotalBruto = cantidadPedida * costoUnitario;
                const subtotal = Math.round(subtotalBruto * (1 - descuentoPorcentaje / 100) * 100) / 100;
                total += subtotal;
                return { productoId, cantidadPedida, costoUnitario, descuentoPorcentaje, observacion, subtotal };
            });

            const ordenResult = await new sql.Request(transaction)
                .input('proveedorId', sql.Int, proveedorId)
                .input('usuarioId', sql.Int, usuarioId)
                .input('fechaEsperada', sql.Date, fechaEsperada || null)
                .input('total', sql.Decimal(18, 2), total)
                .input('observaciones', sql.NVarChar, observaciones || null)
                .query(`
                    INSERT INTO OrdenesCompra (ProveedorId, UsuarioId, FechaEsperada, Estado, Total, Observaciones)
                    OUTPUT INSERTED.Id
                    VALUES (@proveedorId, @usuarioId, @fechaEsperada, 'PENDIENTE', @total, @observaciones)
                `);

            const ordenCompraId = ordenResult.recordset[0].Id;

            for (const item of itemsValidados) {
                await new sql.Request(transaction)
                    .input('ordenCompraId', sql.Int, ordenCompraId)
                    .input('productoId', sql.Int, item.productoId)
                    .input('cantidadPedida', sql.Int, item.cantidadPedida)
                    .input('costoUnitario', sql.Decimal(18, 2), item.costoUnitario)
                    .input('descuentoPorcentaje', sql.Decimal(5, 2), item.descuentoPorcentaje)
                    .input('observacion', sql.NVarChar, item.observacion)
                    .input('subtotal', sql.Decimal(18, 2), item.subtotal)
                    .query(`
                        INSERT INTO DetalleOrdenesCompra (OrdenCompraId, ProductoId, CantidadPedida, CantidadRecibida, CostoUnitario, DescuentoPorcentaje, Observacion, Subtotal)
                        VALUES (@ordenCompraId, @productoId, @cantidadPedida, 0, @costoUnitario, @descuentoPorcentaje, @observacion, @subtotal)
                    `);
            }

            await transaction.commit();
            return { success: true, ordenCompraId, total };
        } catch (error) {
            await transaction.rollback();
            throw new Error(`Error en la transacción de la orden de compra: ${error.message}`);
        }
    }

    static async obtenerTodas(estado) {
        try {
            const pool = await getConnection();
            const request = pool.request();
            let filtro = '';
            if (estado) {
                request.input('Estado', sql.VarChar, estado);
                filtro = 'WHERE oc.Estado = @Estado';
            }
            const result = await request.query(`
                SELECT oc.Id, oc.FechaCreacion, oc.FechaEsperada, oc.Estado, oc.Total, oc.Observaciones,
                       p.Id AS ProveedorId, p.RazonSocial AS Proveedor,
                       u.Nombre AS Usuario
                FROM OrdenesCompra oc
                JOIN Proveedores p ON oc.ProveedorId = p.Id
                JOIN Usuarios u ON oc.UsuarioId = u.Id
                ${filtro}
                ORDER BY oc.FechaCreacion DESC
            `);
            return result.recordset;
        } catch (error) {
            console.error('Error al obtener las órdenes de compra:', error);
            throw error;
        }
    }

    static async obtenerPorId(id) {
        try {
            const pool = await getConnection();

            const ordenResult = await pool.request()
                .input('Id', sql.Int, id)
                .query(`
                    SELECT oc.*, p.RazonSocial AS Proveedor, p.NIT AS ProveedorNIT,
                           p.Telefono AS ProveedorTelefono, p.Correo AS ProveedorCorreo,
                           p.Contacto AS ProveedorContacto, u.Nombre AS Usuario
                    FROM OrdenesCompra oc
                    JOIN Proveedores p ON oc.ProveedorId = p.Id
                    JOIN Usuarios u ON oc.UsuarioId = u.Id
                    WHERE oc.Id = @Id
                `);

            if (ordenResult.recordset.length === 0) return null;
            const orden = ordenResult.recordset[0];

            // doc.* ya incluye DescuentoPorcentaje y Observacion de cada línea (columnas nuevas)
            const detalleResult = await pool.request()
                .input('OrdenCompraId', sql.Int, id)
                .query(`
                    SELECT doc.*, pr.Nombre AS ProductoNombre, pr.CodigoBarras
                    FROM DetalleOrdenesCompra doc
                    JOIN Productos pr ON doc.ProductoId = pr.Id
                    WHERE doc.OrdenCompraId = @OrdenCompraId
                `);
            orden.items = detalleResult.recordset;

            const recepcionesResult = await pool.request()
                .input('OrdenCompraId', sql.Int, id)
                .query(`
                    SELECT rc.Id, rc.FechaRecepcion, rc.Observaciones, u.Nombre AS Usuario,
                           drc.CantidadRecibida, drc.CostoUnitario, pr.Nombre AS ProductoNombre
                    FROM RecepcionesCompra rc
                    JOIN Usuarios u ON rc.UsuarioId = u.Id
                    JOIN DetalleRecepcionesCompra drc ON drc.RecepcionCompraId = rc.Id
                    JOIN DetalleOrdenesCompra doc ON doc.Id = drc.DetalleOrdenCompraId
                    JOIN Productos pr ON pr.Id = doc.ProductoId
                    WHERE rc.OrdenCompraId = @OrdenCompraId
                    ORDER BY rc.FechaRecepcion DESC
                `);
            orden.recepciones = recepcionesResult.recordset;

            return orden;
        } catch (error) {
            console.error('Error al obtener la orden de compra por ID:', error);
            throw error;
        }
    }

    static async cancelar(id) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('Id', sql.Int, id)
                .query(`
                    UPDATE OrdenesCompra SET Estado = 'CANCELADA'
                    OUTPUT INSERTED.Id
                    WHERE Id = @Id AND Estado IN ('PENDIENTE', 'RECIBIDA_PARCIAL')
                `);

            if (result.recordset.length === 0) {
                throw new Error('La orden ya está cancelada, ya fue recibida en su totalidad, o no existe.');
            }

            return { id };
        } catch (error) {
            console.error('Error al cancelar la orden de compra:', error);
            throw error;
        }
    }

    // Registra la recepción (total o parcial) de una orden de compra: por cada línea aumenta
    // el Stock del producto, recalcula su PrecioCosto por promedio ponderado y dispara/actualiza
    // el estado de la orden según lo que falte por recibir.
    static async registrarRecepcion(ordenCompraId, datosRecepcion) {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();
            const { usuarioId, observaciones, items } = datosRecepcion;

            const ordenActual = await new sql.Request(transaction)
                .input('OrdenCompraId', sql.Int, ordenCompraId)
                .query(`SELECT Estado FROM OrdenesCompra WHERE Id = @OrdenCompraId`);

            if (ordenActual.recordset.length === 0) {
                throw new Error('La orden de compra no existe.');
            }
            if (!['PENDIENTE', 'RECIBIDA_PARCIAL'].includes(ordenActual.recordset[0].Estado)) {
                throw new Error(`No se puede registrar recepción sobre una orden en estado ${ordenActual.recordset[0].Estado}.`);
            }

            const recepcionResult = await new sql.Request(transaction)
                .input('OrdenCompraId', sql.Int, ordenCompraId)
                .input('UsuarioId', sql.Int, usuarioId)
                .input('Observaciones', sql.NVarChar, observaciones || null)
                .query(`
                    INSERT INTO RecepcionesCompra (OrdenCompraId, UsuarioId, Observaciones)
                    OUTPUT INSERTED.Id
                    VALUES (@OrdenCompraId, @UsuarioId, @Observaciones)
                `);
            const recepcionCompraId = recepcionResult.recordset[0].Id;

            for (const item of items) {
                const detalleOrdenCompraId = parseInt(item.detalleOrdenCompraId, 10);
                const cantidadRecibida = parseInt(item.cantidadRecibida, 10);
                const costoUnitario = parseFloat(item.costoUnitario);

                if (!Number.isInteger(detalleOrdenCompraId) || !Number.isInteger(cantidadRecibida) || cantidadRecibida <= 0 || isNaN(costoUnitario) || costoUnitario < 0) {
                    throw new Error(`Línea de recepción inválida: detalleOrdenCompraId=${item.detalleOrdenCompraId}, cantidadRecibida=${item.cantidadRecibida}, costoUnitario=${item.costoUnitario}`);
                }

                // Actualización atómica: la condición en el WHERE evita recibir más de lo pedido
                // aunque lleguen varias recepciones concurrentes para la misma línea.
                const detalleUpdate = await new sql.Request(transaction)
                    .input('detalleOrdenCompraId', sql.Int, detalleOrdenCompraId)
                    .input('ordenCompraId', sql.Int, ordenCompraId)
                    .input('cantidadRecibida', sql.Int, cantidadRecibida)
                    .query(`
                        UPDATE DetalleOrdenesCompra
                        SET CantidadRecibida = CantidadRecibida + @cantidadRecibida
                        OUTPUT INSERTED.ProductoId
                        WHERE Id = @detalleOrdenCompraId
                          AND OrdenCompraId = @ordenCompraId
                          AND (CantidadRecibida + @cantidadRecibida) <= CantidadPedida
                    `);

                if (detalleUpdate.recordset.length === 0) {
                    const actual = await new sql.Request(transaction)
                        .input('detalleOrdenCompraId', sql.Int, detalleOrdenCompraId)
                        .input('ordenCompraId', sql.Int, ordenCompraId)
                        .query(`
                            SELECT doc.CantidadPedida, doc.CantidadRecibida, pr.Nombre
                            FROM DetalleOrdenesCompra doc
                            JOIN Productos pr ON pr.Id = doc.ProductoId
                            WHERE doc.Id = @detalleOrdenCompraId AND doc.OrdenCompraId = @ordenCompraId
                        `);
                    const linea = actual.recordset[0];
                    if (!linea) {
                        throw new Error(`La línea de orden ID ${detalleOrdenCompraId} no pertenece a esta orden de compra.`);
                    }
                    const pendiente = linea.CantidadPedida - linea.CantidadRecibida;
                    throw new Error(`Cantidad recibida inválida para '${linea.Nombre}': pendiente por recibir ${pendiente}, se intentó recibir ${cantidadRecibida}.`);
                }

                const productoId = detalleUpdate.recordset[0].ProductoId;

                await new sql.Request(transaction)
                    .input('recepcionCompraId', sql.Int, recepcionCompraId)
                    .input('detalleOrdenCompraId', sql.Int, detalleOrdenCompraId)
                    .input('cantidadRecibida', sql.Int, cantidadRecibida)
                    .input('costoUnitario', sql.Decimal(18, 2), costoUnitario)
                    .query(`
                        INSERT INTO DetalleRecepcionesCompra (RecepcionCompraId, DetalleOrdenCompraId, CantidadRecibida, CostoUnitario)
                        VALUES (@recepcionCompraId, @detalleOrdenCompraId, @cantidadRecibida, @costoUnitario)
                    `);

                // Costo promedio ponderado: combina el costo/stock actuales con lo que entra en
                // esta recepción. Todo el cálculo se hace en una sola sentencia para que use la
                // imagen "antes" de Stock/PrecioCosto de forma atómica (mismo enfoque que venta.models.js).
                await new sql.Request(transaction)
                    .input('productoId', sql.Int, productoId)
                    .input('cantidadRecibida', sql.Int, cantidadRecibida)
                    .input('costoUnitario', sql.Decimal(18, 2), costoUnitario)
                    .query(`
                        UPDATE Productos
                        SET PrecioCosto = ((Stock * PrecioCosto) + (@cantidadRecibida * @costoUnitario)) / (Stock + @cantidadRecibida),
                            Stock = Stock + @cantidadRecibida,
                            FechaActualizacion = GETDATE()
                        WHERE Id = @productoId
                    `);
            }

            const estadoResult = await new sql.Request(transaction)
                .input('OrdenCompraId', sql.Int, ordenCompraId)
                .query(`
                    UPDATE OrdenesCompra
                    SET Estado = CASE
                        WHEN (SELECT SUM(CantidadPedida) FROM DetalleOrdenesCompra WHERE OrdenCompraId = @OrdenCompraId)
                             <= (SELECT SUM(CantidadRecibida) FROM DetalleOrdenesCompra WHERE OrdenCompraId = @OrdenCompraId)
                        THEN 'RECIBIDA_TOTAL'
                        ELSE 'RECIBIDA_PARCIAL'
                    END
                    OUTPUT INSERTED.Estado
                    WHERE Id = @OrdenCompraId
                `);

            await transaction.commit();
            return { success: true, recepcionCompraId, estado: estadoResult.recordset[0].Estado };
        } catch (error) {
            await transaction.rollback();
            throw new Error(`Error en la transacción de recepción: ${error.message}`);
        }
    }
}

module.exports = CompraModel;