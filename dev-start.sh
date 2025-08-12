#!/bin/bash

# ————————————————————————————————————————————————————————————————————————————————
# Script de inicio para modo desarrollo - Portfolio
# Este script configura y ejecuta el entorno de desarrollo completo
# ————————————————————————————————————————————————————————————————————————————————

set -e  # Salir si cualquier comando falla

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir mensajes con colores
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Banner de inicio
echo -e "${BLUE}"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "                    PORTFOLIO - MODO DESARROLLO                               "
echo "═══════════════════════════════════════════════════════════════════════════════"
echo -e "${NC}"

# Verificar si Docker está instalado y ejecutándose
print_info "Verificando Docker..."
if ! command -v docker &> /dev/null; then
    print_error "Docker no está instalado. Por favor, instala Docker Desktop."
    exit 1
fi

if ! docker info &> /dev/null; then
    print_error "Docker no está ejecutándose. Por favor, inicia Docker Desktop."
    exit 1
fi

print_success "Docker está disponible y ejecutándose"

# Verificar si docker-compose está disponible
print_info "Verificando Docker Compose..."
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose no está disponible."
    exit 1
fi

print_success "Docker Compose está disponible"

# Verificar que existe el archivo .env.dev
print_info "Verificando archivo de configuración de desarrollo..."
if [ ! -f ".env.dev" ]; then
    print_error "El archivo .env.dev no existe. Por favor, créalo basándote en .env.example"
    exit 1
fi

print_success "Archivo .env.dev encontrado"

# Limpiar contenedores anteriores si existen
print_info "Limpiando contenedores anteriores..."
docker-compose -f docker-compose-dev.yml down --remove-orphans 2>/dev/null || true

# Construir las imágenes
print_info "Construyendo imágenes de desarrollo..."
docker-compose -f docker-compose-dev.yml build --no-cache

if [ $? -ne 0 ]; then
    print_error "Error al construir las imágenes"
    exit 1
fi

print_success "Imágenes construidas exitosamente"

# Iniciar los servicios
print_info "Iniciando servicios de desarrollo..."
docker-compose -f docker-compose-dev.yml up -d

if [ $? -ne 0 ]; then
    print_error "Error al iniciar los servicios"
    exit 1
fi

print_success "Servicios iniciados exitosamente"

# Esperar a que PostgreSQL esté listo
print_info "Esperando a que PostgreSQL esté listo..."
sleep 10

# Verificar el estado de los servicios
print_info "Verificando estado de los servicios..."
docker-compose -f docker-compose-dev.yml ps

# Mostrar logs iniciales
print_info "Mostrando logs iniciales..."
docker-compose -f docker-compose-dev.yml logs --tail=20

# Información de acceso
echo -e "${GREEN}"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "                           SERVICIOS DISPONIBLES                              "
echo "═══════════════════════════════════════════════════════════════════════════════"
echo -e "${NC}"
echo -e "${BLUE}🌐 Frontend (React + Vite):${NC}     http://localhost:3000"
echo -e "${BLUE}🔧 Backend API:${NC}                http://localhost:5001/api"
echo -e "${BLUE}🗄️  PostgreSQL:${NC}                localhost:5433 (puerto externo)"
echo -e "${BLUE}👤 Admin Panel:${NC}               http://localhost:3000/admin"
echo -e "${BLUE}📊 Dashboard:${NC}                 http://localhost:3000/dashboard"
echo -e "${BLUE}🔍 API Health Check:${NC}          http://localhost:5001/api/health"
echo ""
echo -e "${YELLOW}📋 Credenciales de desarrollo:${NC}"
echo -e "   Admin User: admin"
echo -e "   Admin Pass: dev123"
echo -e "   DB User: postgres"
echo -e "   DB Pass: postgres"
echo -e "   DB Name: portfolio"
echo ""
echo -e "${GREEN}✅ Entorno de desarrollo listo!${NC}"
echo ""
echo -e "${BLUE}📝 Comandos útiles:${NC}"
echo -e "   Ver logs:           docker-compose -f docker-compose-dev.yml logs -f"
echo -e "   Parar servicios:    docker-compose -f docker-compose-dev.yml down"
echo -e "   Reiniciar:          docker-compose -f docker-compose-dev.yml restart"
echo -e "   Acceder al contenedor: docker-compose -f docker-compose-dev.yml exec app bash"
echo -e "   Ver estado:         docker-compose -f docker-compose-dev.yml ps"
echo ""
echo -e "${YELLOW}⚠️  Nota: Este es un entorno de desarrollo. No usar en producción.${NC}"
echo ""

# Opción para seguir los logs
read -p "¿Deseas seguir los logs en tiempo real? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Siguiendo logs... (Ctrl+C para salir)"
    docker-compose -f docker-compose-dev.yml logs -f
fi

print_success "Script de desarrollo completado"