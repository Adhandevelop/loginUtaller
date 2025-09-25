const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { connectDB } = require('./config/database');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS MAXIMAL - Permitir absolutamente todo temporalmente
app.use((req, res, next) => {
    console.log(`🌐 Request: ${req.method} ${req.path} from origin: ${req.headers.origin || 'no-origin'}`);
    
    // Permitir cualquier origen
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
    res.header('Access-Control-Max-Age', '3600');
    
    // Manejar preflight OPTIONS
    if (req.method === 'OPTIONS') {
        console.log('✅ Respondiendo a preflight OPTIONS request');
        return res.status(200).json({
            success: true,
            message: 'CORS preflight OK'
        });
    }
    
    next();
});

// CORS adicional con cors package
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'Cache-Control', 'Pragma'],
    optionsSuccessStatus: 200
}));

// Middleware para parsear JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware de logging para desarrollo
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Rutas de la API
app.use('/api/auth', authRoutes);

// Ruta de salud del servidor
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Servidor CineMax funcionando correctamente',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: 'CockroachDB CineMax'
    });
});

// Ruta raíz
app.get('/', (req, res) => {
    res.json({
        message: 'API CineMax Backend',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            login: 'POST /api/auth/login',
            register: 'POST /api/auth/register/cliente',
            verify: 'GET /api/auth/verify',
            profile: 'GET /api/auth/profile'
        }
    });
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
    console.error('Error no manejado:', err);
    res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        ...(process.env.NODE_ENV === 'development' && { error: err.message })
    });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
    });
});

// Función para iniciar el servidor
const startServer = async () => {
    try {
        // Conectar a la base de datos
        await connectDB();
        
        // Solo iniciar el servidor si no estamos en Vercel
        if (process.env.NODE_ENV !== 'production') {
            const server = app.listen(PORT, () => {
                console.log('\n🎬 ================================');
                console.log('   SERVIDOR CINEMAX INICIADO');
                console.log('================================');
                console.log(`🚀 Servidor corriendo en: http://localhost:${PORT}`);
                console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
                console.log(`🔐 Login endpoint: http://localhost:${PORT}/api/auth/login`);
                console.log(`📝 Register endpoint: http://localhost:${PORT}/api/auth/register/cliente`);
                console.log('\n👥 Usuarios de prueba:');
                console.log('   Clientes:');
                console.log('   - juanperez / cliente123');
                console.log('   - anag / cliente123');
                console.log('   - carlosl / cliente123');
                console.log('\n   Trabajadores:');
                console.log('   - admin / admin123 (Administrador)');
                console.log('   - maria.gerente / gerente123 (Gerente)');
                console.log('   - pedro.empleado / empleado123 (Empleado)');
                console.log('\n⏹️  Para detener: Ctrl+C');
                console.log('================================\n');
            });

            // Manejo de cierre graceful
            process.on('SIGTERM', () => {
                console.log('\n🔄 Cerrando servidor...');
                server.close(() => {
                    console.log('✅ Servidor cerrado correctamente');
                    process.exit(0);
                });
            });

            process.on('SIGINT', () => {
                console.log('\n🔄 Cerrando servidor...');
                server.close(() => {
                    console.log('✅ Servidor cerrado correctamente');
                    process.exit(0);
                });
            });
        } else {
            console.log('🚀 Servidor CineMax iniciado en Vercel');
        }

    } catch (error) {
        console.error('❌ Error iniciando el servidor:', error);
        if (process.env.NODE_ENV !== 'production') {
            process.exit(1);
        }
    }
};

// Para desarrollo local
if (process.env.NODE_ENV !== 'production') {
    startServer();
} else {
    // Para Vercel, inicializar la conexión DB
    connectDB().catch(console.error);
}

module.exports = app;