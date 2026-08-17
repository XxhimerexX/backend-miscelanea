const sql = require('mssql');
const { getConnection } = require('../config/database');

class CajaModel {
    // 1. Verificar si hay un cierre de caja abierto actualmente
    static async obtenerCajaAbierta() {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .query("SELECT TOP 1 * FROM CierresCaja WHERE Estado = 'Abierta' ORDER BY Id DESC");
            return result.recordset[0] || null;
        } catch (error) {
            throw new Error(`Error en modelo al consultar caja abierta: ${error.message}`);
        }
    }

    // 2. Abrir un nuevo turno de caja (Registrar apertura)
    static async abrirTurno(usuarioId, baseInicial) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('UsuarioId', sql.Int, usuarioId)
                .input('BaseInicial', sql.Decimal(18, 2), baseInicial)
                .query(`
                    INSERT INTO CierresCaja (UsuarioId, FechaApertura, BaseInicial, Estado)
                    OUTPUT INSERTED.*
                    VALUES (@UsuarioId, GETDATE(), @BaseInicial, 'Abierta')
                `);
            return result.recordset[0];
        } catch (error) {
            throw new Error(`Error en modelo al abrir caja: ${error.message}`);
        }
    }

    // 3. Cerrar el turno de caja actual actualizando los totales y la diferencia
    static async cerrarTurno(turnoId, totalEfectivoSistema, totalDigitalSistema, totalVentasGeneral, montoFinalReal, diferencia) {
        try {
            const pool = await getConnection();
            await pool.request()
                .input('TurnoId', sql.Int, turnoId)
                .input('TotalEfectivoSistema', sql.Decimal(18, 2), totalEfectivoSistema)
                .input('TotalDigitalSistema', sql.Decimal(18, 2), totalDigitalSistema)
                .input('TotalVentasGeneral', sql.Decimal(18, 2), totalVentasGeneral)
                .input('MontoFinalReal', sql.Decimal(18, 2), montoFinalReal)
                .input('Diferencia', sql.Decimal(18, 2), diferencia)
                .query(`
                    UPDATE CierresCaja 
                    SET FechaCierre = GETDATE(), 
                        TotalEfectivoSistema = @TotalEfectivoSistema,
                        TotalDigitalSistema = @TotalDigitalSistema,
                        TotalVentasGeneral = @TotalVentasGeneral,
                        Diferencia = @Diferencia,
                        Estado = 'Cerrada'
                    WHERE Id = @TurnoId
                `);
            return true;
        } catch (error) {
            throw new Error(`Error en modelo al cerrar caja: ${error.message}`);
        }
    }

    // 4. Calcular el resumen de ventas (efectivo/digital) desde que se abrió el turno actual
    static async obtenerResumenVentasTurno(turnoId) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('TurnoId', sql.Int, turnoId)
                .query(`
                SELECT
                    ISNULL(SUM(CASE WHEN mp.Nombre = 'Efectivo' THEN v.Total ELSE 0 END), 0) AS totalEfectivoSistema,
                    ISNULL(SUM(CASE WHEN mp.Nombre <> 'Efectivo' THEN v.Total ELSE 0 END), 0) AS totalDigitalSistema
                FROM CierresCaja cc
                JOIN Ventas v ON v.FechaVenta >= cc.FechaApertura
                JOIN MetodosPago mp ON mp.Id = v.MetodoPagoId
                WHERE cc.Id = @TurnoId AND v.Estado = 'ACTIVO'
            `);
            return result.recordset[0];
        } catch (error) {
            throw new Error(`Error en modelo al obtener resumen de ventas del turno: ${error.message}`);
        }
    }
}

module.exports = CajaModel;