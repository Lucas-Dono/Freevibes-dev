#!/bin/bash

# Script de despliegue para Vercel
echo "Preparando despliegue para Vercel..."

# Verificar si vercel CLI está instalado
if ! command -v vercel &> /dev/null
then
    echo "Vercel CLI no está instalado. Instalándolo..."
    npm install -g vercel
fi

# Limpiar archivos innecesarios
echo "Limpiando archivos innecesarios para el despliegue..."
rm -rf .next
rm -rf python-api/cache
rm -rf python-api/__pycache__

# Verificar entorno
echo "Verificando configuración de entorno..."
if [ ! -f ".env.production" ]; then
    echo "Archivo .env.production no encontrado. Por favor, crea este archivo."
    exit 1
fi

# Construir la aplicación
echo "Construyendo la aplicación..."
npm run build

# Desplegar en Vercel
echo "Desplegando en Vercel..."
vercel --prod

echo "Despliegue completado. Verifica tu aplicación en el dashboard de Vercel." 