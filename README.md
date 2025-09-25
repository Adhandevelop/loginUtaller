# 🚀 Guía para subir CineMax Backend a Vercel

## ✅ Preparación completada
Los archivos ya están listos para Vercel:
- ✅ `vercel.json` - Configuración de Vercel
- ✅ `.env.example` - Variables de entorno ejemplo
- ✅ `.gitignore` - Archivos a ignorar
- ✅ `server.js` - Adaptado para serverless
- ✅ Frontend configurado para detectar entorno

## 📋 Pasos para subir a Vercel

### 1. Instalar Vercel CLI (opcional)
```bash
npm install -g vercel
```

### 2. Crear cuenta en Vercel
1. Ve a [vercel.com](https://vercel.com)
2. Registrate con GitHub, GitLab o email
3. Conecta tu cuenta de GitHub

### 3. Subir proyecto a GitHub
```bash
# En la carpeta backend/
git init
git add .
git commit -m "Initial commit - CineMax Backend"

# Crear repositorio en GitHub y conectar
git remote add origin https://github.com/tu-usuario/cinemax-backend.git
git branch -M main
git push -u origin main
```

### 4. Importar en Vercel
1. Ve a [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click en "Add New..." → "Project"
3. Import tu repositorio de GitHub
4. Configurar:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (raíz del proyecto backend)
   - **Build Command**: `npm install`
   - **Output Directory**: (dejar vacío)
   - **Install Command**: `npm install`

### 5. Configurar Variables de Entorno
En el dashboard de Vercel, ve a tu proyecto → Settings → Environment Variables:

```
NODE_ENV = production
JWT_SECRET = tu_clave_secreta_super_segura_aqui
DATABASE_URL = postgresql://adham:8bc7wJrb6nvNEW8KGhO3VA@cinemax-9079.jxf.gcp-us-east1.cockroachlabs.cloud:26257/cinemax?sslmode=verify-full
```

### 6. Deploy
1. Click "Deploy"
2. Espera a que termine el build
3. Tu API estará disponible en: `https://tu-proyecto.vercel.app`

### 7. Actualizar Frontend
Después del deploy, copia la URL de Vercel y actualiza:

**js/conexion.js** línea 7:
```javascript
'https://tu-proyecto-real.vercel.app/api'  // Reemplazar con tu URL real
```

## 🌐 URLs de tu API
- **Producción**: `https://tu-proyecto.vercel.app`
- **Health Check**: `https://tu-proyecto.vercel.app/api/health`
- **Login**: `https://tu-proyecto.vercel.app/api/auth/login`
- **Register**: `https://tu-proyecto.vercel.app/api/auth/register/cliente`

## 👥 Usuarios de prueba (mismos de desarrollo)
**Clientes:**
- `juanperez` / `cliente123`
- `anag` / `cliente123`
- `carlosl` / `cliente123`

**Trabajadores:**
- `admin` / `admin123` (Administrador)
- `maria.gerente` / `gerente123` (Gerente)
- `pedro.empleado` / `empleado123` (Empleado)

## 🔧 Troubleshooting

### Error: "Module not found"
- Verifica que `package.json` esté en la raíz del proyecto
- Asegúrate de que todas las dependencias estén en `dependencies`, no en `devDependencies`

### Error: "Database connection failed"
- Verifica que `DATABASE_URL` esté configurada correctamente en Vercel
- La base de datos CockroachDB debe permitir conexiones desde cualquier IP

### Error: "Function timeout"
- Las funciones serverless de Vercel tienen límite de tiempo
- La conexión DB se inicializa en cada request (normal en serverless)

### Error de CORS
- Actualiza los origins permitidos en `server.js`
- Verifica que el frontend use HTTPS en producción

## 📝 Notas importantes
- Vercel usa funciones serverless, no un servidor persistente
- La conexión a la DB se establece en cada request
- Los logs se ven en el dashboard de Vercel
- Los usuarios de prueba se crean automáticamente si no existen
- El proyecto es gratuito en el plan básico de Vercel

## 🆘 Soporte
Si tienes problemas:
1. Revisa los logs en Vercel Dashboard → Functions
2. Usa `console.log()` para debug
3. Verifica las variables de entorno
4. Prueba primero en desarrollo local