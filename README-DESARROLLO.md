# 🚀 Guía de Desarrollo - Portfolio

Esta guía te ayudará a configurar y ejecutar el proyecto en modo desarrollo de manera óptima.

## 📋 Requisitos Previos

- **Docker Desktop** instalado y ejecutándose
- **Node.js** 18+ (opcional, para desarrollo sin Docker)
- **Git** para control de versiones
- **PowerShell** (Windows) o **Bash** (Linux/Mac)

## 🛠️ Configuración Inicial

### 1. Clonar el Repositorio
```bash
git clone <tu-repositorio>
cd Portfolio
```

### 2. Configurar Variables de Entorno
El proyecto incluye un archivo `.env.dev` preconfigurado para desarrollo. Este archivo contiene:

- Configuración de base de datos PostgreSQL
- Credenciales de desarrollo
- URLs y puertos optimizados para desarrollo
- Configuraciones de seguridad relajadas para desarrollo

## 🚀 Inicio Rápido

### Opción 1: Script Automatizado (Recomendado)

**Windows:**
```powershell
npm run dev:start
```

**Linux/Mac:**
```bash
./dev-start.sh
```

### Opción 2: Comandos Manuales

```bash
# Instalar dependencias
npm install

# Iniciar con Docker
npm run dev:docker:build

# O iniciar servicios existentes
npm run dev:docker
```

## 🌐 Servicios Disponibles

Una vez iniciado el entorno de desarrollo, tendrás acceso a:

| Servicio | URL | Descripción |
|----------|-----|-------------|
| **Frontend** | http://localhost:3000 | Aplicación React con Vite |
| **Backend API** | http://localhost:5001/api | API REST del servidor |
| **Admin Panel** | http://localhost:3000/admin | Panel de administración |
| **Dashboard** | http://localhost:3000/dashboard | Dashboard de usuario |
| **PostgreSQL** | localhost:5433 | Base de datos (puerto externo) |
| **Health Check** | http://localhost:5001/api/health | Estado de la API |

## 🔐 Credenciales de Desarrollo

### Admin Panel
- **Usuario:** `admin`
- **Contraseña:** `dev123`

### Base de Datos
- **Host:** `localhost:5433`
- **Usuario:** `postgres`
- **Contraseña:** `postgres`
- **Base de datos:** `portfolio`

## 📝 Scripts Disponibles

### Scripts de Docker
```bash
# Iniciar servicios
npm run dev:docker

# Construir e iniciar
npm run dev:docker:build

# Parar servicios
npm run dev:docker:down

# Ver logs en tiempo real
npm run dev:docker:logs

# Limpiar completamente (incluye volúmenes)
npm run dev:docker:clean
```

### Scripts de Desarrollo
```bash
# Configuración inicial completa
npm run dev:setup

# Verificar estado de la API
npm run dev:health

# Mostrar URLs del admin y dashboard
npm run dev:admin
npm run dev:dashboard

# Resetear base de datos
npm run dev:db:reset
```

### Scripts Tradicionales
```bash
# Desarrollo sin Docker
npm run dev

# Solo frontend
npm run dev:frontend

# Solo backend
npm run dev:backend
```

## 🔧 Configuración Avanzada

### Variables de Entorno de Desarrollo

El archivo `.env.dev` incluye configuraciones específicas para desarrollo:

```env
# Modo de desarrollo
NODE_ENV=development
DEBUG_MODE=true
VERBOSE_LOGGING=true

# Hot reload
HOT_RELOAD=true
WATCH_FILES=true

# CORS permisivo
CORS_DEV_MODE=true
CORS_ALLOW_ALL_ORIGINS=true

# Seguridad relajada
DISABLE_STRICT_SECURITY=true
SSL_DISABLED=true
```

### Configuración de Vite

Se incluye un archivo `vite.config.dev.ts` optimizado para desarrollo con:

- Hot Module Replacement (HMR) configurado
- Proxy automático para la API
- Source maps habilitados
- Optimización de dependencias
- Aliases de rutas configurados

## 🐛 Debugging y Logs

### Ver Logs en Tiempo Real
```bash
docker-compose -f docker-compose-dev.yml logs -f
```

### Ver Logs de un Servicio Específico
```bash
# Logs del frontend/backend
docker-compose -f docker-compose-dev.yml logs -f app

# Logs de la base de datos
docker-compose -f docker-compose-dev.yml logs -f postgres
```

### Acceder al Contenedor
```bash
docker-compose -f docker-compose-dev.yml exec app bash
```

### Verificar Estado de Servicios
```bash
docker-compose -f docker-compose-dev.yml ps
```

## 🗄️ Base de Datos

### Conexión Directa
Puedes conectarte directamente a PostgreSQL usando:

```bash
# Usando psql
psql -h localhost -p 5433 -U postgres -d portfolio

# Usando herramientas gráficas
# Host: localhost
# Puerto: 5433
# Usuario: postgres
# Contraseña: postgres
# Base de datos: portfolio
```

### Resetear Base de Datos
```bash
npm run dev:db:reset
```

### Datos de Prueba
La base de datos se inicializa automáticamente con:
- Servicios de ejemplo
- Addons disponibles
- Promociones de prueba
- Estructura de tablas completa

## 🔄 Hot Reload y Desarrollo

### Frontend (React + Vite)
- **Hot Module Replacement** habilitado
- Cambios en componentes se reflejan instantáneamente
- Source maps para debugging
- Error overlay en desarrollo

### Backend (Node.js + Express)
- Reinicio automático con cambios en archivos
- Logs detallados en consola
- CORS permisivo para desarrollo
- Middleware de debugging habilitado

## 🧪 Testing en Desarrollo

### Endpoints de Prueba
```bash
# Health check
curl http://localhost:5001/api/health

# Test de autenticación
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"dev123"}'

# Test de servicios
curl http://localhost:5001/api/servicios
```

### Admin Panel
1. Ir a http://localhost:3000/admin
2. Usar credenciales: `admin` / `dev123`
3. Probar funcionalidades de administración

### Dashboard
1. Ir a http://localhost:3000/dashboard
2. Probar funcionalidades de usuario
3. Verificar integración con la API

## 🚨 Solución de Problemas

### Puerto Ocupado
```bash
# Verificar qué está usando el puerto
netstat -ano | findstr :3000
netstat -ano | findstr :5001

# Matar proceso si es necesario
taskkill /PID <PID> /F
```

### Docker Issues
```bash
# Limpiar completamente Docker
npm run dev:docker:clean
docker system prune -a

# Reconstruir desde cero
npm run dev:docker:build
```

### Base de Datos No Conecta
```bash
# Verificar estado de PostgreSQL
docker-compose -f docker-compose-dev.yml logs postgres

# Reiniciar solo PostgreSQL
docker-compose -f docker-compose-dev.yml restart postgres
```

### Problemas de CORS
- Verificar que `.env.dev` esté siendo usado
- Comprobar configuración de CORS en el servidor
- Verificar proxy de Vite en `vite.config.dev.ts`

## 📚 Estructura del Proyecto

```
Portfolio/
├── .env.dev                 # Variables de entorno para desarrollo
├── docker-compose-dev.yml   # Configuración Docker para desarrollo
├── vite.config.dev.ts      # Configuración Vite para desarrollo
├── dev-start.ps1           # Script de inicio para Windows
├── dev-start.sh            # Script de inicio para Linux/Mac
├── src/                    # Código fuente del frontend
├── config/                 # Configuración de base de datos
├── controllers/            # Controladores del backend
├── routes/                 # Rutas de la API
├── models/                 # Modelos de datos
└── public/                 # Archivos estáticos
```

## 🔄 Workflow de Desarrollo

1. **Iniciar entorno:** `npm run dev:start`
2. **Desarrollar:** Hacer cambios en el código
3. **Probar:** Verificar en http://localhost:3000
4. **Admin:** Probar funcionalidades en http://localhost:3000/admin
5. **API:** Verificar endpoints en http://localhost:5001/api
6. **Commit:** Guardar cambios con Git
7. **Parar:** `npm run dev:docker:down`

## 📞 Soporte

Si encuentras problemas:

1. Revisa los logs: `npm run dev:docker:logs`
2. Verifica el estado: `docker-compose -f docker-compose-dev.yml ps`
3. Limpia y reinicia: `npm run dev:docker:clean && npm run dev:docker:build`
4. Consulta esta documentación

---

**¡Happy Coding! 🎉**