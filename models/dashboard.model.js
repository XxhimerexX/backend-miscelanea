const { getConnection, sql } = require('../config/database');

class DashboardModel {

  static async ventasDelDia() {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT ISNULL(SUM(Total), 0) AS total
      FROM Ventas
      WHERE CAST(FechaVenta AS DATE) = CAST(GETDATE() AS DATE)
        AND Estado = 'ACTIVO'
    `);
    return result.recordset[0].total;
  }

  static async productosStockBajo() {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT COUNT(*) AS total
      FROM Productos
      WHERE Stock <= ISNULL(StockMinimo, 5)
    `);
    return result.recordset[0].total;
  }

  static async ventasPorPeriodo(periodo, fechaInicio, fechaFin) {
    const pool = await getConnection();

    let formatoAgrupacion;
    if (periodo === 'dia') formatoAgrupacion = "CONVERT(VARCHAR(10), FechaVenta, 120)";
    else if (periodo === 'mes') formatoAgrupacion = "CONVERT(VARCHAR(7), FechaVenta, 120)";
    else formatoAgrupacion = "CONVERT(VARCHAR(4), FechaVenta, 120)";

    const result = await pool.request()
      .input('FechaInicio', sql.DateTime, fechaInicio)
      .input('FechaFin', sql.DateTime, fechaFin)
      .query(`
        SELECT ${formatoAgrupacion} AS etiqueta, SUM(Total) AS total
        FROM Ventas
        WHERE FechaVenta BETWEEN @FechaInicio AND @FechaFin AND Estado = 'ACTIVO'
        GROUP BY ${formatoAgrupacion}
        ORDER BY etiqueta ASC
      `);
    return result.recordset;
  }
}

module.exports = DashboardModel;