const { getConnection, sql } = require('../config/database');

class ReporteModel {

    static async ventasPorPeriodo(periodo, fechaInicio, fechaFin) {
        const pool = await getConnection();

        let formatoAgrupacion;
        if (periodo === 'dia') {
            formatoAgrupacion = "CONVERT(VARCHAR(10), FechaVenta, 120)";
        } else if (periodo === 'semana') {
            // SET DATEFIRST 1 hace que la semana inicie en lunes sin depender
            // de la configuración regional del servidor.
            formatoAgrupacion = "CONVERT(VARCHAR(10), DATEADD(DAY, -(DATEPART(WEEKDAY, FechaVenta) - 1), CAST(FechaVenta AS DATE)), 120)";
        } else {
            formatoAgrupacion = "CONVERT(VARCHAR(7), FechaVenta, 120)";
        }

        const result = await pool.request()
            .input('FechaInicio', sql.DateTime, fechaInicio)
            .input('FechaFin', sql.DateTime, fechaFin)
            .query(`
                SET DATEFIRST 1;
                SELECT
                    ${formatoAgrupacion} AS etiqueta,
                    SUM(Total) AS totalVendido,
                    COUNT(*) AS numFacturas,
                    AVG(Total) AS ticketPromedio
                FROM Ventas
                WHERE FechaVenta BETWEEN @FechaInicio AND @FechaFin AND Estado = 'ACTIVO'
                GROUP BY ${formatoAgrupacion}
                ORDER BY etiqueta ASC
            `);
        return result.recordset;
    }

    static async ventasPorProductoCategoria(fechaInicio, fechaFin, agruparPor) {
        const pool = await getConnection();

        const columnas = agruparPor === 'categoria'
            ? 'c.Id AS CategoriaId, c.Nombre AS Categoria'
            : 'p.Id AS ProductoId, p.Nombre AS Producto, c.Nombre AS Categoria';
        const agrupacion = agruparPor === 'categoria' ? 'c.Id, c.Nombre' : 'p.Id, p.Nombre, c.Nombre';

        const result = await pool.request()
            .input('FechaInicio', sql.DateTime, fechaInicio)
            .input('FechaFin', sql.DateTime, fechaFin)
            .query(`
                SELECT
                    ${columnas},
                    SUM(dv.Cantidad) AS UnidadesVendidas,
                    SUM(dv.Subtotal) AS TotalVendido
                FROM DetalleVentas dv
                JOIN Ventas v ON v.Id = dv.VentaId
                JOIN Productos p ON p.Id = dv.ProductoId
                JOIN Categorias c ON c.Id = p.CategoriaId
                WHERE v.FechaVenta BETWEEN @FechaInicio AND @FechaFin AND v.Estado = 'ACTIVO'
                GROUP BY ${agrupacion}
                ORDER BY TotalVendido DESC
            `);
        return result.recordset;
    }

    static async margenes(fechaInicio, fechaFin, agruparPor) {
        const pool = await getConnection();

        const columnas = agruparPor === 'categoria'
            ? 'c.Id AS CategoriaId, c.Nombre AS Categoria'
            : 'p.Id AS ProductoId, p.Nombre AS Producto, c.Nombre AS Categoria';
        const agrupacion = agruparPor === 'categoria' ? 'c.Id, c.Nombre' : 'p.Id, p.Nombre, c.Nombre';

        const result = await pool.request()
            .input('FechaInicio', sql.DateTime, fechaInicio)
            .input('FechaFin', sql.DateTime, fechaFin)
            .query(`
                SELECT
                    ${columnas},
                    SUM(dv.Cantidad) AS UnidadesVendidas,
                    SUM(dv.Subtotal) AS TotalVendido,
                    SUM(dv.Cantidad * ISNULL(dv.CostoUnitario, p.PrecioCosto)) AS CostoTotal,
                    SUM(dv.Subtotal - (dv.Cantidad * ISNULL(dv.CostoUnitario, p.PrecioCosto))) AS MargenTotal,
                    SUM(CASE WHEN dv.CostoUnitario IS NULL THEN 1 ELSE 0 END) AS LineasConCostoAproximado
                FROM DetalleVentas dv
                JOIN Ventas v ON v.Id = dv.VentaId
                JOIN Productos p ON p.Id = dv.ProductoId
                JOIN Categorias c ON c.Id = p.CategoriaId
                WHERE v.FechaVenta BETWEEN @FechaInicio AND @FechaFin AND v.Estado = 'ACTIVO'
                GROUP BY ${agrupacion}
                ORDER BY MargenTotal DESC
            `);
        return result.recordset;
    }

    static async kardex(productoId, fechaInicio, fechaFin) {
        const pool = await getConnection();

        const result = await pool.request()
            .input('ProductoId', sql.Int, productoId)
            .input('FechaInicio', sql.DateTime, fechaInicio || null)
            .input('FechaFin', sql.DateTime, fechaFin || null)
            .query(`
                ;WITH Movimientos AS (
                    SELECT dv.ProductoId, v.FechaVenta AS Fecha, 'VENTA' AS Tipo,
                           -dv.Cantidad AS Cantidad, v.NumeroFactura AS Referencia
                    FROM DetalleVentas dv
                    JOIN Ventas v ON v.Id = dv.VentaId
                    WHERE v.Estado = 'ACTIVO'

                    UNION ALL
                    SELECT doc.ProductoId, rc.FechaRecepcion AS Fecha, 'COMPRA' AS Tipo,
                           drc.CantidadRecibida AS Cantidad, CAST(rc.Id AS VARCHAR(20)) AS Referencia
                    FROM DetalleRecepcionesCompra drc
                    JOIN RecepcionesCompra rc ON rc.Id = drc.RecepcionCompraId
                    JOIN DetalleOrdenesCompra doc ON doc.Id = drc.DetalleOrdenCompraId

                    UNION ALL
                    SELECT ddg.ProductoId, dg.FechaAutorizacion AS Fecha, 'DEVOLUCION_INGRESO' AS Tipo,
                           ddg.Cantidad AS Cantidad, CAST(dg.Id AS VARCHAR(20)) AS Referencia
                    FROM DetalleDevolucionesGarantias ddg
                    JOIN DevolucionesGarantias dg ON dg.Id = ddg.DevolucionGarantiaId
                    WHERE dg.Estado = 'AUTORIZADA' AND ddg.ReingresaStock = 1

                    UNION ALL
                    SELECT ddg.ProductoReemplazoId AS ProductoId, dg.FechaAutorizacion AS Fecha, 'DEVOLUCION_CAMBIO' AS Tipo,
                           -ddg.Cantidad AS Cantidad, CAST(dg.Id AS VARCHAR(20)) AS Referencia
                    FROM DetalleDevolucionesGarantias ddg
                    JOIN DevolucionesGarantias dg ON dg.Id = ddg.DevolucionGarantiaId
                    WHERE dg.Estado = 'AUTORIZADA' AND ddg.TipoResolucion = 'CAMBIO' AND ddg.ProductoReemplazoId IS NOT NULL
                )
                SELECT Fecha, Tipo, Cantidad, Referencia,
                       SUM(Cantidad) OVER (ORDER BY Fecha, Tipo ROWS UNBOUNDED PRECEDING) AS SaldoAcumulado
                FROM Movimientos
                WHERE ProductoId = @ProductoId
                  AND (@FechaInicio IS NULL OR Fecha >= @FechaInicio)
                  AND (@FechaFin IS NULL OR Fecha <= @FechaFin)
                ORDER BY Fecha ASC, Tipo ASC
            `);
        return result.recordset;
    }

    static async stockBajo() {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT p.Id, p.Nombre, c.Nombre AS Categoria, p.Stock, p.StockMinimo
            FROM Productos p
            JOIN Categorias c ON c.Id = p.CategoriaId
            WHERE p.Stock <= ISNULL(p.StockMinimo, 5)
            ORDER BY p.Stock ASC
        `);
        return result.recordset;
    }

    static async bajaRotacion(dias) {
        const pool = await getConnection();
        const result = await pool.request()
            .input('Dias', sql.Int, dias)
            .query(`
                SELECT p.Id, p.Nombre, c.Nombre AS Categoria, p.Stock, MAX(v.FechaVenta) AS UltimaVenta
                FROM Productos p
                JOIN Categorias c ON c.Id = p.CategoriaId
                LEFT JOIN DetalleVentas dv ON dv.ProductoId = p.Id
                LEFT JOIN Ventas v ON v.Id = dv.VentaId AND v.Estado = 'ACTIVO'
                GROUP BY p.Id, p.Nombre, c.Nombre, p.Stock
                HAVING MAX(v.FechaVenta) IS NULL OR MAX(v.FechaVenta) < DATEADD(DAY, -@Dias, GETDATE())
                ORDER BY UltimaVenta ASC
            `);
        return result.recordset;
    }
}

module.exports = ReporteModel;
