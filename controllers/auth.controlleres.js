const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const AuthModel = require('../models/auth.model');
const { detalleError } = require('../utils/errorResponse');

const JWT_SECRET = process.env.JWT_SECRET || 'cambia_esto_en_produccion';

const login = async (req, res) => {
  try {
    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
      return res.status(400).json({ error: 'Correo y contraseña son obligatorios.' });
    }

    const usuario = await AuthModel.buscarPorCorreo(correo);
    if (!usuario || !usuario.Activo) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const passwordValida = await bcrypt.compare(contrasena, usuario.Contrasena);
    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const permisos = usuario.EsAdmin ? ['*'] : await AuthModel.obtenerPermisosDeRol(usuario.RolId);

    const token = jwt.sign(
      { id: usuario.Id, rolId: usuario.RolId, esAdmin: !!usuario.EsAdmin, permisos },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.status(200).json({
      token,
      usuario: {
        id: usuario.Id,
        nombre: usuario.Nombre,
        correo: usuario.Correo,
        rol: usuario.RolNombre,
        esAdmin: !!usuario.EsAdmin,
        permisos
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión', detalle: detalleError(error) });
  }
};

const registrar = async (req, res) => {
  try {
    const { nombre, correo, contrasena, rolId } = req.body;

    if (!nombre || !correo || !contrasena || !rolId) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }

    const existente = await AuthModel.buscarPorCorreo(correo);
    if (existente) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese correo.' });
    }

    const contrasenaHasheada = await bcrypt.hash(contrasena, 10);
    const id = await AuthModel.crearUsuario({ nombre, correo, contrasenaHasheada, rolId });

    res.status(201).json({ mensaje: 'Usuario registrado con éxito', id });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error al registrar el usuario', detalle: detalleError(error) });
  }
};

const listarUsuarios = async (req, res) => {
  try {
    const usuarios = await AuthModel.listarUsuarios();
    res.status(200).json(usuarios);
  } catch (error) {
    res.status(500).json({ error: 'Error al listar usuarios', detalle: detalleError(error) });
  }
};

const listarRoles = async (req, res) => {
  try {
    const roles = await AuthModel.obtenerRoles();
    res.status(200).json(roles);
  } catch (error) {
    res.status(500).json({ error: 'Error al listar roles', detalle: detalleError(error) });
  }
};

const actualizarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, rolId, activo } = req.body;

    if (!nombre || !rolId) {
      return res.status(400).json({ error: 'Nombre y rol son obligatorios.' });
    }

    // Evita que un administrador se desactive a sí mismo y se quede sin acceso
    if (Number(id) === req.usuario.id && activo === false) {
      return res.status(400).json({ error: 'No puedes desactivar tu propio usuario.' });
    }

    await AuthModel.actualizarUsuario(id, { nombre, rolId, activo });
    res.status(200).json({ mensaje: 'Usuario actualizado con éxito' });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar el usuario', detalle: detalleError(error) });
  }
};

module.exports = { login, registrar, listarUsuarios, listarRoles, actualizarUsuario };