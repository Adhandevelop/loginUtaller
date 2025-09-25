const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: 'postgresql://adham:8bc7wJrb6nvNEW8KGhO3VA@cinemax-9079.jxf.gcp-us-east1.cockroachlabs.cloud:26257/cinemax?sslmode=verify-full'
});

const connectDB = async () => {
    try {
        await client.connect();
        console.log('✅ Conectado a CockroachDB CineMax');
        
        // Verificar que las tablas existen
        await verifyTables();
        
        // Insertar datos de prueba si no existen
        await insertInitialData();
        
    } catch (error) {
        console.error('❌ Error conectando a la base de datos:', error);
        process.exit(1);
    }
};

const verifyTables = async () => {
    try {
        // Verificar tabla clientes
        const clientesCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'clientes'
            );
        `);
        
        // Verificar tabla trabajadores
        const trabajadoresCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'trabajadores'
            );
        `);
        
        if (clientesCheck.rows[0].exists && trabajadoresCheck.rows[0].exists) {
            console.log('✅ Tablas verificadas: clientes y trabajadores existen');
        } else {
            console.log('⚠️  Algunas tablas no existen. Asegúrate de ejecutar el script SQL completo.');
        }
        
    } catch (error) {
        console.error('Error verificando tablas:', error);
    }
};

const insertInitialData = async () => {
    const bcrypt = require('bcrypt');
    
    try {
        // Verificar si ya existen datos de prueba
        const clientesCount = await client.query('SELECT COUNT(*) FROM clientes WHERE username IS NOT NULL');
        const trabajadoresCount = await client.query('SELECT COUNT(*) FROM trabajadores');

        // Insertar datos de prueba en clientes si no existen
        if (parseInt(clientesCount.rows[0].count) === 0) {
            const clientesData = [
                {
                    nombre: 'Juan Pérez',
                    correo: 'juan.perez@email.com',
                    telefono: '123-456-7890',
                    username: 'juanperez',
                    password_hash: await bcrypt.hash('cliente123', 10)
                },
                {
                    nombre: 'Ana García',
                    correo: 'ana.garcia@email.com',
                    telefono: '098-765-4321',
                    username: 'anag',
                    password_hash: await bcrypt.hash('cliente123', 10)
                },
                {
                    nombre: 'Carlos López',
                    correo: 'carlos.lopez@email.com',
                    telefono: '555-123-4567',
                    username: 'carlosl',
                    password_hash: await bcrypt.hash('cliente123', 10)
                }
            ];

            for (const cliente of clientesData) {
                await client.query(`
                    INSERT INTO clientes (nombre, correo, telefono, username, password_hash) 
                    VALUES ($1, $2, $3, $4, $5)
                `, [cliente.nombre, cliente.correo, cliente.telefono, cliente.username, cliente.password_hash]);
            }
            console.log('✅ Datos de prueba para clientes insertados');
        }

        // Insertar datos de prueba en trabajadores si no existen
        if (parseInt(trabajadoresCount.rows[0].count) === 0) {
            const trabajadoresData = [
                {
                    username: 'admin',
                    password_hash: await bcrypt.hash('admin123', 10),
                    nombre: 'Administrador Principal',
                    correo: 'admin@cinemax.com',
                    telefono: '555-000-0001',
                    rol: 'admin'
                },
                {
                    username: 'maria.gerente',
                    password_hash: await bcrypt.hash('gerente123', 10),
                    nombre: 'María González',
                    correo: 'maria.gonzalez@cinemax.com',
                    telefono: '555-000-0002',
                    rol: 'gerente'
                },
                {
                    username: 'pedro.empleado',
                    password_hash: await bcrypt.hash('empleado123', 10),
                    nombre: 'Pedro Rodríguez',
                    correo: 'pedro.rodriguez@cinemax.com',
                    telefono: '555-000-0003',
                    rol: 'empleado'
                }
            ];

            for (const trabajador of trabajadoresData) {
                await client.query(`
                    INSERT INTO trabajadores (username, password_hash, nombre, correo, telefono, rol) 
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [trabajador.username, trabajador.password_hash, trabajador.nombre, trabajador.correo, trabajador.telefono, trabajador.rol]);
            }
            console.log('✅ Datos de prueba para trabajadores insertados');
        }
        
    } catch (error) {
        console.error('Error insertando datos iniciales:', error);
    }
};

// Función para ejecutar consultas de manera segura
const queryDatabase = async (query, params = []) => {
    try {
        const result = await client.query(query, params);
        return { success: true, data: result.rows };
    } catch (error) {
        console.error('Error en consulta:', error);
        return { success: false, error: error.message };
    }
};

module.exports = { client, connectDB, queryDatabase };