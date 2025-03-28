# MusicVerse - Reproductor de Música Multiplataforma

## Descripción

MusicVerse es un reproductor de música que unifica contenido de múltiples plataformas como Spotify, YouTube Music y más. Permite buscar, reproducir y gestionar música desde una única interfaz.

## Componentes del Sistema

El sistema tiene tres componentes principales:

1. **Frontend Next.js** - La interfaz de usuario principal (desplegada en Vercel)
2. **Servidor Proxy Node.js** - API para intermediar entre el frontend y YouTube Music (desplegada en Render)
3. **API de YouTube Music en Python** - Servicio para acceder a YouTube Music (desplegada en Render)

## Instrucciones para Desarrollo Local

### 1. Servidor Python (API de YouTube Music)

```bash
# Activar el entorno virtual si está disponible
.\python-env\Scripts\activate
# En PowerShell
cd python-api
# Instalar dependencias
pip install -r requirements.txt
# Ejecutar el servidor Python
python app.py
```

### 2. Servidor Node.js (Proxy)

```bash
# En otra ventana de PowerShell
cd node-server
npm install         # Solo la primera vez o cuando haya cambios en dependencias
node server.js
# Verifica que el mensaje muestre: "Servidor Node.js corriendo en http://localhost:3001"
```

### 3. Frontend Next.js

```bash
# En otra ventana de PowerShell
# Desde la carpeta raíz del proyecto
npm install
npm run dev
# Next.js se ejecutará en el puerto 3000
```

### Script de inicio rápido (solo Windows)

Para iniciar todos los servicios de una vez, puedes usar:

```bash
npm run dev:all
```

## Acceso a la Aplicación en Desarrollo

Una vez que los tres componentes estén corriendo, puedes acceder a:

- **Frontend principal**: http://localhost:3000

## Despliegue en Producción

La arquitectura de despliegue utiliza:
- **Vercel** para el frontend Next.js
- **Render** para los servicios de backend (Node.js y Python)

### 1. Despliegue del Frontend en Vercel

1. **Configura las Variables de Entorno en Vercel**:
   - En la configuración del proyecto en Vercel, añade las siguientes variables:
     - `MONGODB_URI`: URL de conexión a tu base de datos MongoDB
     - `JWT_SECRET`: Clave secreta para JWT
     - `JWT_REFRESH_SECRET`: Clave secreta para renovación de JWT
     - `SPOTIFY_CLIENT_ID`: ID de cliente de Spotify API
     - `SPOTIFY_CLIENT_SECRET`: Secreto de cliente de Spotify API
     - `YOUTUBE_API_KEY`: Clave API de YouTube Data API v3
     - `NEXT_PUBLIC_API_URL`: /api (para rutas locales)
     - `NEXT_PUBLIC_NODE_API_URL`: URL del servidor Node.js en Render

2. **Conecta tu Repositorio**:
   - Conecta tu repositorio de GitHub/GitLab/Bitbucket en el dashboard de Vercel
   - Vercel detectará automáticamente la configuración de Next.js

### 2. Despliegue de la API Python en Render

1. **Crear un nuevo servicio Web**:
   - En el dashboard de Render, selecciona "New" y luego "Web Service"
   - Conecta tu repositorio

2. **Configuración del servicio**:
   - **Nombre**: `musicverse-python-api` (o el que prefieras)
   - **Ambiente**: `Python`
   - **Directorio raíz**: `python-api`
   - **Comando de construcción**: `pip install -r requirements.txt`
   - **Comando de inicio**: `gunicorn app:app`

3. **Variables de entorno**:
   - `PORT`: 10000 (Render asigna este puerto automáticamente)
   - `FLASK_ENV`: production
   - `CORS_ORIGIN`: URLs separadas por comas (frontend y API Node)
   - `YOUTUBE_API_KEY`: Tu clave de API de YouTube

### 3. Despliegue del Servidor Node.js en Render

1. **Crear un nuevo servicio Web**:
   - En el dashboard de Render, selecciona "New" y luego "Web Service"
   - Conecta tu repositorio

2. **Configuración del servicio**:
   - **Nombre**: `musicverse-node-api` (o el que prefieras)
   - **Ambiente**: `Node`
   - **Directorio raíz**: `node-server`
   - **Comando de construcción**: `npm install`
   - **Comando de inicio**: `node server.js`

3. **Variables de entorno**:
   - `PORT`: 10000 (Render asigna este puerto automáticamente)
   - `NODE_ENV`: production
   - `CORS_ORIGIN`: URL de tu frontend en Vercel
   - `YOUTUBE_API_URL`: URL de tu API Python en Render

### 4. Actualizar Variables de Entorno

Una vez que todos los servicios estén desplegados, es importante actualizar las URLs correspondientes:

1. En el servicio Node.js en Render:
   - Actualiza `YOUTUBE_API_URL` para que apunte a la URL completa de la API Python

2. En el frontend en Vercel:
   - Actualiza `NEXT_PUBLIC_NODE_API_URL` para que apunte a la URL del servicio Node.js

## Estructura de Puertos en Desarrollo Local

- **Next.js (frontend)**: Puerto 3000
- **Node.js (proxy)**: Puerto 3001
- **Python (API)**: Puerto 5000

## Notas Importantes para Producción

- Esta aplicación está optimizada para Vercel utilizando la configuración en `vercel.json`
- Las APIs de Node.js y Python deben desplegarse por separado en Render
- Se recomienda usar MongoDB Atlas para la base de datos en producción
- Para los planes gratuitos de Render, ten en cuenta que los servicios se suspenden después de períodos de inactividad 