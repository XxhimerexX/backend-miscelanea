const { getConnection, sql } = require('../config/database');

class VentaModel {
    static async registrarVenta(datosVenta) {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();
            const { numeroFactura, usuarioId, metodoPagoId, subtotal, impuestos, total, montoRecibido, cambioDevuelto, items } = datosVenta;

            // 1. Insertar el encabezado de la venta (Factura)
            const ventaResult = await new sql.Request(transaction)
                .input('numeroFactura', sql.VarChar, numeroFactura)
                .input('usuarioId', sql.Int, usuarioId)
                .input('metodoPagoId', sql.Int, metodoPagoId)
                .input('subtotal', sql.Decimal(10, 2), subtotal)
                .input('impuestos', sql.Decimal(10, 2), impuestos)
                .input('total', sql.Decimal(10, 2), total)
                .input('montoRecibido', sql.Decimal(10, 2), montoRecibido)
                .input('cambioDevuelto', sql.Decimal(10, 2), cambioDevuelto)
                .query(`
                    INSERT INTO Ventas (NumeroFactura, UsuarioId, MetodoPagoId, Subtotal, Impuestos, Total, MontoRecibido, CambioDevuelto, Estado) 
                    OUTPUT INSERTED.Id 
                    VALUES (@numeroFactura, @usuarioId, @metodoPagoId, @subtotal, @impuestos, @total, @montoRecibido, @cambioDevuelto, 'ACTIVO')
                `);

            const ventaId = ventaResult.recordset[0].Id;

            // 2. Por cada línea: validar cantidad, descontar stock de forma atómica
            // (la condición Stock >= @cantidad en el WHERE evita sobreventa por
            // condiciones de carrera entre ventas concurrentes) y registrar el detalle.
            for (const item of items) {
                const productoId = parseInt(item.productoId, 10);
                const cantidad = parseInt(item.cantidad, 10);

                if (!Number.isInteger(productoId) || !Number.isInteger(cantidad) || cantidad <= 0) {
                    throw new Error(`Ítem de venta inválido: productoId=${item.productoId}, cantidad=${item.cantidad}`);
                }

                const stockUpdate = await new sql.Request(transaction)
                    .input('cantidad', sql.Int, cantidad)
                    .input('productoId', sql.Int, productoId)
                    .query(`
                        UPDATE Productos
                        SET Stock = Stock - @cantidad, FechaActualizacion = GETDATE()
                        OUTPUT INSERTED.Id, INSERTED.PrecioCosto
                        WHERE Id = @productoId AND Stock >= @cantidad
                    `);

                if (stockUpdate.recordset.length === 0) {
                    // No se pudo descontar: o el producto no existe o el stock disponible es insuficiente.
                    const actual = await new sql.Request(transaction)
                        .input('productoId', sql.Int, productoId)
                        .query('SELECT Nombre, Stock FROM Productos WHERE Id = @productoId');
                    const producto = actual.recordset[0];
                    if (!producto) {
                        throw new Error(`Stock insuficiente para el producto ID ${productoId}: producto no encontrado`);
                    }
                    throw new Error(`Stock insuficiente para el producto '${producto.Nombre}': Solicitado: ${cantidad}, Disponible: ${producto.Stock}`);
                }

                // Se captura el PrecioCosto vigente en este instante (ya disponible en el
                // OUTPUT del UPDATE de arriba) para que el margen histórico no se distorsione
                // cuando el costo promedio ponderado cambie después por una compra nueva.
                const costoUnitario = stockUpdate.recordset[0].PrecioCosto;

                await new sql.Request(transaction)
                    .input('ventaId', sql.Int, ventaId)
                    .input('productoId', sql.Int, productoId)
                    .input('cantidad', sql.Int, cantidad)
                    .input('precioUnitario', sql.Decimal(10, 2), item.precioUnitario)
                    .input('subtotalItem', sql.Decimal(10, 2), item.subtotal)
                    .input('costoUnitario', sql.Decimal(18, 2), costoUnitario)
                    .query(`
                        INSERT INTO DetalleVentas (VentaId, ProductoId, Cantidad, PrecioUnitario, Subtotal, CostoUnitario)
                        VALUES (@ventaId, @productoId, @cantidad, @precioUnitario, @subtotalItem, @costoUnitario)
                    `);
            }

            await transaction.commit();
            return { success: true, ventaId, numeroFactura };
        } catch (error) {
            await transaction.rollback();
            throw new Error(`Error en la transacción de venta: ${error.message}`);
        }
    }

    static async obtenerTodas() {
        try {
            const pool = await getConnection();
            const result = await pool.request().query(`
                SELECT v.Id, v.NumeroFactura, v.Total, v.FechaVenta, v.Estado, u.Nombre AS Usuario, mp.Nombre AS MetodoPago
                FROM Ventas v
                JOIN Usuarios u ON v.UsuarioId = u.Id
                JOIN MetodosPago mp ON v.MetodoPagoId = mp.Id
                ORDER BY v.FechaVenta DESC
            `);
            return result.recordset;
        } catch (error) {
            console.error('Error al obtener todas las ventas:', error);
            throw error;
        }
    }

    static async obtenerPorId(id) {
        try {
            const pool = await getConnection();
            const ventaResult = await pool.request()
                .input('Id', sql.Int, id)
                .query('SELECT * FROM Ventas WHERE Id = @Id');

            if (ventaResult.recordset.length === 0) return null;

            const detalleResult = await pool.request()
                .input('VentaId', sql.Int, id)
                .query(`
                    SELECT dv.*, p.Nombre AS ProductoNombre 
                    FROM DetalleVentas dv
                    JOIN Productos p ON dv.ProductoId = p.Id
                    WHERE dv.VentaId = @VentaId
                `);

            const venta = ventaResult.recordset[0];
            venta.items = detalleResult.recordset;

            return venta;
        } catch (error) {
            console.error('Error al obtener venta por ID:', error);
            throw error;
        }
    }

    static async anularVenta(id) {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();

            // 1. Marcar la factura como ANULADA solo si sigue ACTIVA (evita anular dos veces
            // y devolver el stock por duplicado si el endpoint se llama repetidamente).
            const marcado = await transaction.request().input('VentaId', sql.Int, id).query(`
                UPDATE Ventas SET Estado = 'ANULADA'
                OUTPUT INSERTED.Id
                WHERE Id = @VentaId AND Estado = 'ACTIVO';
            `);

            if (marcado.recordset.length === 0) {
                throw new Error('La venta ya está anulada o no existe.');
            }

            // 2. Devolver el stock al inventario
            await transaction.request().input('VentaId', sql.Int, id).query(`
                UPDATE p SET p.Stock = p.Stock + dv.Cantidad
                FROM Productos p JOIN DetalleVentas dv ON p.Id = dv.ProductoId
                WHERE dv.VentaId = @VentaId;
            `);

            await transaction.commit();
            return { id, mensaje: 'Factura anulada correctamente manteniendo el registro histórico y los montos intactos.' };
        } catch (error) {
            await transaction.rollback();
            console.error('Error al anular la venta:', error);
            throw new Error(`Error al anular la venta: ${error.message}`);
        }
    }
}

module.exports = VentaModel;