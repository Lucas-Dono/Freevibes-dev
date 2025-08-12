# ————————————————————————————————————————————————————————————————————————————————
# Script de inicio para modo desarrollo - Portfolio (Windows PowerShell)
# Este script configura y ejecuta el entorno de desarrollo completo
# ————————————————————————————————————————————————————————————————————————————————

# Configurar política de ejecución para el script actual
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force

# Función para imprimir mensajes con colores
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Banner de inicio
Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor Blue
Write-Host "                    PORTFOLIO - MODO DESARROLLO                               " -ForegroundColor Blue
Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor Blue
Write-Host ""

# Verificar si Docker está instalado y ejecutándose
Write-Info "Verificando Docker..."
try {
    $dockerVersion = docker --version 2>$null
    if (-not $dockerVersion) {
        throw "Docker no encontrado"
    }
    
    $dockerInfo = docker info 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker no está ejecutándose"
    }
    
    Write-Success "Docker está disponible y ejecutándose"
}
catch {
    Write-Error "Docker no está instalado o no está ejecutándose. Por favor, instala e inicia Docker Desktop."
    Read-Host "Presiona Enter para salir"
    exit 1
}

# Verificar si docker-compose está disponible
Write-Info "Verificando Docker Compose..."
try {
    $composeVersion = docker-compose --version 2>$null
    if (-not $composeVersion) {
        $composeVersion = docker compose version 2>$null
        if (-not $composeVersion) {
            throw "Docker Compose no encontrado"
        }
    }
    Write-Success "Docker Compose está disponible"
}
catch {
    Write-Error "Docker Compose no está disponible."
    Read-Host "Presiona Enter para salir"
    exit 1
}

# Verificar que existe el archivo .env.dev
Write-Info "Verificando archivo de configuración de desarrollo..."
if (-not (Test-Path ".env.dev")) {
    Write-Error "El archivo .env.dev no existe. Por favor, créalo basándote en .env.example"
    Read-Host "Presiona Enter para salir"
    exit 1
}
Write-Success "Archivo .env.dev encontrado"

# Limpiar contenedores anteriores si existen
Write-Info "Limpiando contenedores anteriores..."
try {
    docker-compose -f docker-compose-dev.yml down --remove-orphans 2>$null
}
catch {
    # Ignorar errores si no hay contenedores previos
}

# Construir las imágenes
Write-Info "Construyendo imágenes de desarrollo..."
try {
    docker-compose -f docker-compose-dev.yml build --no-cache
    if ($LASTEXITCODE -ne 0) {
        throw "Error en build"
    }
    Write-Success "Imágenes construidas exitosamente"
}
catch {
    Write-Error "Error al construir las imágenes"
    Read-Host "Presiona Enter para salir"
    exit 1
}

# Iniciar los servicios
Write-Info "Iniciando servicios de desarrollo..."
try {
    docker-compose -f docker-compose-dev.yml up -d
    if ($LASTEXITCODE -ne 0) {
        throw "Error al iniciar servicios"
    }
    Write-Success "Servicios iniciados exitosamente"
}
catch {
    Write-Error "Error al iniciar los servicios"
    Read-Host "Presiona Enter para salir"
    exit 1
}

# Esperar a que PostgreSQL esté listo
Write-Info "Esperando a que PostgreSQL esté listo..."
Start-Sleep -Seconds 10

# Verificar el estado de los servicios
Write-Info "Verificando estado de los servicios..."
docker-compose -f docker-compose-dev.yml ps

# Mostrar logs iniciales
Write-Info "Mostrando logs iniciales..."
docker-compose -f docker-compose-dev.yml logs --tail=20

# Información de acceso
Write-Host "" 
Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "                           SERVICIOS DISPONIBLES                              " -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Frontend (React + Vite):     " -NoNewline -ForegroundColor Blue
Write-Host "http://localhost:3000" -ForegroundColor White
Write-Host "🔧 Backend API:                " -NoNewline -ForegroundColor Blue
Write-Host "http://localhost:5001/api" -ForegroundColor White
Write-Host "🗄️  PostgreSQL:                " -NoNewline -ForegroundColor Blue
Write-Host "localhost:5433 (puerto externo)" -ForegroundColor White
Write-Host "👤 Admin Panel:               " -NoNewline -ForegroundColor Blue
Write-Host "http://localhost:3000/admin" -ForegroundColor White
Write-Host "📊 Dashboard:                 " -NoNewline -ForegroundColor Blue
Write-Host "http://localhost:3000/dashboard" -ForegroundColor White
Write-Host "🔍 API Health Check:          " -NoNewline -ForegroundColor Blue
Write-Host "http://localhost:5001/api/health" -ForegroundColor White
Write-Host ""
Write-Host "📋 Credenciales de desarrollo:" -ForegroundColor Yellow
Write-Host "   Admin User: admin"
Write-Host "   Admin Pass: dev123"
Write-Host "   DB User: postgres"
Write-Host "   DB Pass: postgres"
Write-Host "   DB Name: portfolio"
Write-Host ""
Write-Host "✅ Entorno de desarrollo listo!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Comandos útiles:" -ForegroundColor Blue
Write-Host "   Ver logs:           docker-compose -f docker-compose-dev.yml logs -f"
Write-Host "   Parar servicios:    docker-compose -f docker-compose-dev.yml down"
Write-Host "   Reiniciar:          docker-compose -f docker-compose-dev.yml restart"
Write-Host "   Acceder al contenedor: docker-compose -f docker-compose-dev.yml exec app bash"
Write-Host "   Ver estado:         docker-compose -f docker-compose-dev.yml ps"
Write-Host ""
Write-Host "⚠️  Nota: Este es un entorno de desarrollo. No usar en producción." -ForegroundColor Yellow
Write-Host ""

# Opción para seguir los logs
$followLogs = Read-Host "¿Deseas seguir los logs en tiempo real? (y/n)"
if ($followLogs -eq "y" -or $followLogs -eq "Y") {
    Write-Info "Siguiendo logs... (Ctrl+C para salir)"
    docker-compose -f docker-compose-dev.yml logs -f
}

Write-Success "Script de desarrollo completado"
Read-Host "Presiona Enter para salir"