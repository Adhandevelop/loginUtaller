const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { client, queryDatabase } = require('../config/database');

const router = express.Router();

// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { username, password, userType } = req.body;
        
        // Validar campos requeridos
        if (!username || !password || !userType) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username, password y userType son requeridos' 
            });
        }

        // Validar tipo de usuario
        if (!['cliente', 'trabajador'].includes(userType)) {
            return res.status(400).json({
                success: false,
                message: 'userType debe ser "cliente" o "trabajador"'
            });
        }

        let query;
        let user = null;
        
        if (userType === 'cliente') {
            // Buscar en tabla clientes
            query = `
                SELECT id_cliente as id, username, password_hash, nombre, correo, telefono, 
                       activo, fecha_ultimo_login
                FROM clientes 
                WHERE username = $1 AND activo = true
            `;
            
            const result = await queryDatabase(query, [username]);
            
            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Error interno del servidor'
                });
            }
            
            if (result.data.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Cliente no encontrado o inactivo'
                });
            }
            
            user = result.data[0];
            
        } else if (userType === 'trabajador') {
            // Buscar en tabla trabajadores
            query = `
                SELECT id_trabajador as id, username, password_hash, nombre, correo, 
                       telefono, rol, activo, fecha_ultimo_login
                FROM trabajadores 
                WHERE username = $1 AND activo = true
            `;
            
            const result = await queryDatabase(query, [username]);
            
            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Error interno del servidor'
                });
            }
            
            if (result.data.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: 'Trabajador no encontrado o inactivo'
                });
            }
            
            user = result.data[0];
        }
        
        // Verificar contraseña
        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ 
                success: false, 
                message: 'Contraseña incorrecta' 
            });
        }
        
        // Actualizar último login
        const updateLoginQuery = userType === 'cliente' 
            ? 'UPDATE clientes SET fecha_ultimo_login = CURRENT_TIMESTAMP WHERE id_cliente = $1'
            : 'UPDATE trabajadores SET fecha_ultimo_login = CURRENT_TIMESTAMP WHERE id_trabajador = $1';
            
        await queryDatabase(updateLoginQuery, [user.id]);
        
        // Generar JWT
        const tokenPayload = {
            id: user.id,
            username: user.username,
            name: user.nombre,
            email: user.correo,
            userType: userType
        };
        
        // Agregar rol si es trabajador
        if (userType === 'trabajador') {
            tokenPayload.rol = user.rol;
        }
        
        const token = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET || 'cinemax_secret_key',
            { expiresIn: '24h' }
        );
        
        // Preparar respuesta (sin password_hash)
        const userResponse = {
            id: user.id,
            username: user.username,
            name: user.nombre,
            email: user.correo,
            telefono: user.telefono,
            userType: userType,
            ...(userType === 'trabajador' && { rol: user.rol })
        };
        
        res.json({
            success: true,
            message: `¡Bienvenido ${user.nombre}!`,
            user: userResponse,
            token
        });
        
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error interno del servidor' 
        });
    }
});

// Registro de clientes
router.post('/register/cliente', async (req, res) => {
    try {
        const { username, password, nombre, correo, telefono } = req.body;
        
        // Validar campos requeridos
        if (!username || !password || !nombre || !correo) {
            return res.status(400).json({
                success: false,
                message: 'Username, password, nombre y correo son requeridos'
            });
        }
        
        // Verificar si el username o correo ya existen
        const checkExistingQuery = `
            SELECT username, correo FROM clientes 
            WHERE username = $1 OR correo = $2
        `;
        
        const existingResult = await queryDatabase(checkExistingQuery, [username, correo]);
        
        if (!existingResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Error verificando datos existentes'
            });
        }
        
        if (existingResult.data.length > 0) {
            const existing = existingResult.data[0];
            if (existing.username === username) {
                return res.status(400).json({
                    success: false,
                    message: 'El username ya está en uso'
                });
            }
            if (existing.correo === correo) {
                return res.status(400).json({
                    success: false,
                    message: 'El correo ya está registrado'
                });
            }
        }
        
        // Hash de la contraseña
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insertar nuevo cliente
        const insertQuery = `
            INSERT INTO clientes (username, password_hash, nombre, correo, telefono) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING id_cliente as id, username, nombre, correo, telefono
        `;
        
        const insertResult = await queryDatabase(insertQuery, [
            username, hashedPassword, nombre, correo, telefono || null
        ]);
        
        if (!insertResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Error creando la cuenta'
            });
        }
        
        const newUser = insertResult.data[0];
        newUser.userType = 'cliente';
        
        res.status(201).json({
            success: true,
            message: 'Cliente registrado exitosamente',
            user: newUser
        });
        
    } catch (error) {
        console.error('Error en registro de cliente:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// Verificar token JWT
router.get('/verify', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Token no proporcionado'
        });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cinemax_secret_key');
        res.json({
            success: true,
            user: decoded
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Token inválido o expirado'
        });
    }
});

// Obtener perfil del usuario autenticado
router.get('/profile', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Token no proporcionado'
        });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cinemax_secret_key');
        
        let query;
        if (decoded.userType === 'cliente') {
            query = `
                SELECT id_cliente as id, username, nombre, correo, telefono, 
                       fecha_registro, fecha_ultimo_login
                FROM clientes 
                WHERE id_cliente = $1 AND activo = true
            `;
        } else {
            query = `
                SELECT id_trabajador as id, username, nombre, correo, telefono, 
                       rol, fecha_creacion, fecha_ultimo_login
                FROM trabajadores 
                WHERE id_trabajador = $1 AND activo = true
            `;
        }
        
        const result = await queryDatabase(query, [decoded.id]);
        
        if (!result.success || result.data.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }
        
        const user = result.data[0];
        user.userType = decoded.userType;
        
        res.json({
            success: true,
            user
        });
        
    } catch (error) {
        console.error('Error obteniendo perfil:', error);
        res.status(401).json({
            success: false,
            message: 'Token inválido'
        });
    }
});

module.exports = router;