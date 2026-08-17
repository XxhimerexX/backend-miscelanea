// En tu modelo o consulta directa
const { getConnection } = require('../config/database');

class CategoriaModel {

    static async obtenerCategorias() {
        try {
            const pool = await getConnection();
            const result = await pool.request().query('SELECT Id, Nombre FROM Categorias');
            return result.recordset;
        } catch (error) {
            console.error('Error al obtener categorías:', error);
            throw error;
        }
    }
}

module.exports = CategoriaModel;