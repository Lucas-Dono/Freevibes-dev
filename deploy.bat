@echo off
echo Preparando despliegue para Vercel...

REM Verificar si Vercel CLI está instalado
where vercel >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Vercel CLI no está instalado. Instalándolo...
    npm install -g vercel
)

REM Limpiar archivos innecesarios
echo Limpiando archivos innecesarios para el despliegue...
if exist .next rmdir /s /q .next
if exist python-api\cache rmdir /s /q python-api\cache
if exist python-api\__pycache__ rmdir /s /q python-api\__pycache__

REM Verificar entorno
echo Verificando configuración de entorno...
if not exist .env.production (
    echo Archivo .env.production no encontrado. Por favor, crea este archivo.
    exit /b 1
)

REM Construir la aplicación
echo Construyendo la aplicación...
npm run build

REM Desplegar en Vercel
echo Desplegando en Vercel...
vercel --prod

echo Despliegue completado. Verifica tu aplicación en el dashboard de Vercel. 