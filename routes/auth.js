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

        // Validaciones de seguridad básicas para login
        const usernameRegex = /^[a-zA-Z]+$/;
        if (!usernameRegex.test(username)) {
            return res.status(400).json({
                success: false,
                message: 'Usuario solo puede contener letras'
            });
        }

        if (username.length > 50 || password.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Datos demasiado largos'
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

// Función de validación de datos de registro
function validateRegistrationData({ username, password, nombre, correo, telefono }) {
    // Validar campos requeridos
    if (!username || !password || !nombre || !correo) {
        return { isValid: false, message: 'Todos los campos son requeridos' };
    }
    
    // Validar longitudes mínimas
    if (username.length < 4) {
        return { isValid: false, message: 'El usuario debe tener al menos 4 caracteres' };
    }
    
    if (password.length < 9) {
        return { isValid: false, message: 'La contraseña debe tener al menos 9 caracteres' };
    }
    
    if (nombre.length < 5) {
        return { isValid: false, message: 'El nombre debe tener al menos 5 caracteres' };
    }
    
    if (correo.length < 9) {
        return { isValid: false, message: 'El correo debe tener al menos 9 caracteres' };
    }
    
    if (telefono && telefono.length < 9) {
        return { isValid: false, message: 'El teléfono debe tener al menos 9 caracteres' };
    }
    
    // Validar que la contraseña no tenga espacios ni caracteres peligrosos
    const passwordRegex = /^[a-zA-Z0-9@#$%^&+=!?._-]+$/;
    if (!passwordRegex.test(password)) {
        return { isValid: false, message: 'La contraseña contiene caracteres no permitidos' };
    }
    
    if (password.includes(' ')) {
        return { isValid: false, message: 'La contraseña no puede contener espacios' };
    }
    
    // Validar que el nombre solo tenga letras y espacios
    const nombreRegex = /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]+$/;
    if (!nombreRegex.test(nombre)) {
        return { isValid: false, message: 'El nombre solo puede contener letras y espacios' };
    }
    
    // Validar que el username solo tenga letras
    const usernameRegex = /^[a-zA-Z]+$/;
    if (!usernameRegex.test(username)) {
        return { isValid: false, message: 'El usuario solo puede contener letras' };
    }
    
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correo)) {
        return { isValid: false, message: 'El formato del correo electrónico no es válido' };
    }
    
    // Validar teléfono si se proporciona
    if (telefono) {
        const telefonoRegex = /^[0-9\s\-\(\)\+]+$/;
        if (!telefonoRegex.test(telefono)) {
            return { isValid: false, message: 'El teléfono contiene caracteres no permitidos' };
        }
    }
    
    return { isValid: true, message: 'Datos válidos' };
}

// Registro de clientes
router.post('/register/cliente', async (req, res) => {
    try {
        const { username, password, nombre, correo, telefono } = req.body;
        
        // Validaciones de seguridad
        const validation = validateRegistrationData({ username, password, nombre, correo, telefono });
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: validation.message
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

// Registro de trabajadores
router.post('/register/trabajador', async (req, res) => {
    try {
        const { username, password, nombre, correo, telefono } = req.body;
        
        // Validaciones de seguridad
        const validation = validateRegistrationData({ username, password, nombre, correo, telefono });
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: validation.message
            });
        }
        
        // Verificar si el username o correo ya existen
        const checkExistingQuery = `
            SELECT username, correo FROM trabajadores 
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
        
        // Insertar nuevo trabajador (con rol por defecto 'empleado')
        const insertQuery = `
            INSERT INTO trabajadores (username, password_hash, nombre, correo, telefono, rol) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING id_trabajador as id, username, nombre, correo, telefono, rol
        `;
        
        const insertResult = await queryDatabase(insertQuery, [
            username, hashedPassword, nombre, correo, telefono || null, 'empleado'
        ]);
        
        if (!insertResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Error creando la cuenta'
            });
        }
        
        const newUser = insertResult.data[0];
        newUser.userType = 'trabajador';
        
        res.status(201).json({
            success: true,
            message: 'Trabajador registrado exitosamente',
            user: newUser
        });
        
    } catch (error) {
        console.error('Error en registro de trabajador:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

// Obtener datos de la tabla datosExcel (requiere autenticación)
router.get('/datos-excel', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Token no proporcionado'
        });
    }
    
    try {
        // Verificar token JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cinemax_secret_key');
        
        // Consultar la tabla datosexcel
        const query = `
            SELECT id, nrocto, contratista, identificacion, objeto, cdp, tiempo, vrcto, unidad, rubro
            FROM datosexcel
            ORDER BY id ASC
        `;
        
        const result = await queryDatabase(query, []);
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Error consultando los datos'
            });
        }
        
        res.json({
            success: true,
            message: 'Datos obtenidos exitosamente',
            data: result.data,
            count: result.data.length
        });
        
    } catch (error) {
        console.error('Error obteniendo datos de Excel:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Token inválido'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
});

module.exports = router;