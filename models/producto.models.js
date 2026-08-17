const { getConnection, sql } = require('../config/database');

// Precio de venta = costo sin IVA + (costo sin IVA * margen) + (costo sin IVA * IVA)
// Siempre se calcula aquí en el backend, nunca se confía en el valor que mande el frontend.
function calcularPrecioVenta(precioCostoSinIva, margenGanancia, porcentajeIva) {
    const costo = Number(precioCostoSinIva) || 0;
    const margen = (Number(margenGanancia) || 0) / 100;
    const iva = (Number(porcentajeIva) || 0) / 100;
    const precioVenta = costo * (1 + margen + iva);
    return Math.round(precioVenta * 100) / 100;
}

class ProductoModel {

    static async buscarPorCodigoONombre(busqueda) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('busqueda', sql.VarChar, busqueda)
                .query(`
                    SELECT p.*, c.Nombre AS Categoria 
                    FROM Productos p
                    JOIN Categorias c ON p.CategoriaId = c.Id
                    WHERE p.CodigoBarras = @busqueda OR p.Nombre LIKE '%' + @busqueda + '%'
                `);
            return result.recordset;
        } catch (error) {
            console.error('Error al buscar producto:', error);
            throw error;
        }
    }

    static async mostrarTodosLosProductos() {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .query(`
                    SELECT p.*, c.Nombre AS Categoria 
                    FROM Productos p
                    JOIN Categorias c ON p.CategoriaId = c.Id
                `);
            return result.recordset;
        } catch (error) {
            console.error('Error al mostrar productos:', error);
            throw error;
        }
    }

    static async registrarProducto(datosProducto) {
        try {
            const pool = await getConnection();
            const porcentajeIva = datosProducto.PorcentajeIva ?? 19;
            const margenGanancia = datosProducto.MargenGanancia ?? 30;
            const precioVenta = calcularPrecioVenta(datosProducto.PrecioCosto, margenGanancia, porcentajeIva);

            const result = await pool.request()
                .input('CodigoBarras', sql.VarChar, datosProducto.CodigoBarras)
                .input('Nombre', sql.VarChar, datosProducto.Nombre)
                .input('PrecioVenta', sql.Decimal(18, 2), precioVenta)
                .input('PrecioCosto', sql.Decimal(18, 2), datosProducto.PrecioCosto) // costo SIN IVA
                .input('PorcentajeIva', sql.Decimal(5, 2), porcentajeIva)
                .input('MargenGanancia', sql.Decimal(5, 2), margenGanancia)
                .input('Stock', sql.Int, datosProducto.Stock)
                .input('StockMinimo', sql.Int, datosProducto.StockMinimo)
                .input('CategoriaId', sql.Int, datosProducto.CategoriaId)
                .query(`
                    INSERT INTO Productos (CodigoBarras, Nombre, PrecioVenta, PrecioCosto, PorcentajeIva, MargenGanancia, Stock, StockMinimo, CategoriaId)
                    OUTPUT INSERTED.Id
                    VALUES (@CodigoBarras, @Nombre, @PrecioVenta, @PrecioCosto, @PorcentajeIva, @MargenGanancia, @Stock, @StockMinimo, @CategoriaId)
                `);
            return { id: result.recordset[0].Id, precioVenta };
        } catch (error) {
            console.error('Error al registrar producto:', error);
            throw error;
        }
    }

    static async actualizarProducto(id, datosProducto) {
        try {
            const { CodigoBarras, Nombre, PrecioCosto, Stock, StockMinimo, CategoriaId } = datosProducto;
            const porcentajeIva = datosProducto.PorcentajeIva ?? 19;
            const margenGanancia = datosProducto.MargenGanancia ?? 30;
            const precioVenta = calcularPrecioVenta(PrecioCosto, margenGanancia, porcentajeIva);

            const pool = await getConnection();
            await pool.request()
                .input('Id', sql.Int, id)
                .input('CodigoBarras', sql.VarChar, CodigoBarras)
                .input('Nombre', sql.VarChar, Nombre)
                .input('PrecioVenta', sql.Decimal(18, 2), precioVenta)
                .input('PrecioCosto', sql.Decimal(18, 2), PrecioCosto)
                .input('PorcentajeIva', sql.Decimal(5, 2), porcentajeIva)
                .input('MargenGanancia', sql.Decimal(5, 2), margenGanancia)
                .input('Stock', sql.Int, Stock)
                .input('StockMinimo', sql.Int, StockMinimo)
                .input('CategoriaId', sql.Int, CategoriaId)
                .query(`
                    UPDATE Productos
                    SET 
                        CodigoBarras = @CodigoBarras,
                        Nombre = @Nombre,
                        PrecioVenta = @PrecioVenta,
                        PrecioCosto = @PrecioCosto,
                        PorcentajeIva = @PorcentajeIva,
                        MargenGanancia = @MargenGanancia,
                        Stock = @Stock,
                        StockMinimo = @StockMinimo,
                        CategoriaId = @CategoriaId,
                        FechaActualizacion = GETDATE()
                    WHERE Id = @Id
                `);
            return { id, precioVenta };
        } catch (error) {
            console.error('Error al actualizar producto:', error);
            throw error;
        }
    }

    static async eliminarProducto(id) {
        try {
            const pool = await getConnection();
            await pool.request()
                .input('Id', sql.Int, id)
                .query('DELETE FROM Productos WHERE Id = @Id');
            return { id };
        } catch (error) {
            console.error('Error al eliminar producto:', error);
            throw error;
        }
    }
}

module.exports = ProductoModel;