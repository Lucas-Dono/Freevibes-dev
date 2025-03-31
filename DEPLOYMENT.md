# Guía de Despliegue

Este documento proporciona instrucciones para desplegar la aplicación MusicVerse en servicios como Vercel y Render.

## Estructura del proyecto

MusicVerse consta de varios componentes que deben desplegarse:

1. **Frontend Next.js** - La aplicación principal (este repositorio)
2. **Node.js Server** - Servidor que actúa como proxy para YouTube Music
3. **Python API** - Microservicio que interactúa con YouTube Music

## Variables de entorno

La aplicación está configurada para trabajar con diferentes URLs según el entorno:

- En **desarrollo**: Usa URLs con `localhost` para desarrollo local
- En **producción**: Usa URLs relativas o URLs absolutas para servicios externos

## Despliegue en Vercel (Frontend)

1. **Crear un nuevo proyecto en Vercel**
   - Conecta tu repositorio de GitHub
   - Selecciona la rama principal

2. **Configurar variables de entorno**
   - Añade todas las variables necesarias del archivo `.env.production`
   - Asegúrate de configurar correctamente:
     - `NEXT_PUBLIC_APP_URL` (la URL de tu aplicación en Vercel)
     - `SPOTIFY_CALLBACK_URL` y `NEXT_PUBLIC_SPOTIFY_CALLBACK_URL`
     - `NEXT_PUBLIC_NODE_API_URL` (la URL de tu backend en Render)

3. **Configurar Spotify para producción**
   - Ve a tu panel de desarrollador de Spotify
   - Actualiza la URL de redirección a `https://tu-app-vercel.vercel.app/api/auth/spotify/callback`

## Despliegue en Render (Backend)

### Node.js Server

1. **Crear un nuevo servicio web**
   - Tipo: Web Service
   - Runtime: Node.js
   - Ruta del directorio: `/node-server`
   - Comando de arranque: `npm start`

2. **Configurar variables de entorno**
   - `PORT`: 3001 (o el que Render proporcione)
   - `CORS_ORIGIN`: URL de tu frontend (ej. `https://tu-app-vercel.vercel.app`)
   - `YOUTUBE_API_URL`: URL de tu API Python

### Python API

1. **Crear un nuevo servicio web**
   - Tipo: Web Service
   - Runtime: Python
   - Ruta del directorio: `/python-api`
   - Comando de arranque: `gunicorn app:app`

2. **Configurar variables de entorno**
   - `PORT`: 5000 (o el que Render proporcione)
   - `CORS_ORIGIN`: URLs de tu frontend y backend Node.js

## Configuración de despliegue final

Después de desplegar todos los servicios, asegúrate de actualizar estas variables en el Frontend:

- `USE_EXTERNAL_PYTHON_API=true`
- `USE_EXTERNAL_NODE_API=true`
- `NEXT_PUBLIC_NODE_API_URL=https://tu-api-node.onrender.com`
- `YTMUSIC_SERVICE_URL=https://tu-api-python.onrender.com/api`

## Verificación

1. Verifica que puedes iniciar sesión con Spotify
2. Prueba la búsqueda de música (depende de la API de Node.js y Python)
3. Asegúrate de que las recomendaciones y listas funcionen correctamente 