# MusicVerse Node.js API

Este servidor Node.js funciona como proxy entre el frontend de MusicVerse y la API de Python de YouTube Music.

## Despliegue en Render

### Pasos para desplegar en Render:

1. **Crear un nuevo servicio Web**:
   - En el dashboard de Render, selecciona "New" y luego "Web Service"
   - Conecta tu repositorio de GitHub/GitLab/Bitbucket

2. **Configuración del servicio**:
   - **Nombre**: `musicverse-node-api` (o el que prefieras)
   - **Ambiente**: `Node`
   - **Región**: Selecciona la más cercana a tus usuarios
   - **Rama**: `main` (o la que uses)
   - **Directorio raíz**: `node-server` (importante: indica esta subcarpeta)
   - **Comando de construcción**: `npm install`
   - **Comando de inicio**: `node server.js`
   - **Plan**: Free (o selecciona otro según tus necesidades)

3. **Variables de entorno**:
   Configura las siguientes variables en la sección "Environment":
   - `PORT`: 10000 (Render asigna este puerto automáticamente)
   - `NODE_ENV`: production
   - `CORS_ORIGIN`: URL de tu frontend en Vercel (ej: https://musicverse.vercel.app)
   - `YOUTUBE_API_URL`: URL de tu API Python en Render (ej: https://musicverse-python-api.onrender.com/api)

4. **Crear servicio**:
   - Haz clic en "Create Web Service"
   - Render comenzará a desplegar automáticamente

## Desarrollo local

Para ejecutar este servidor localmente:

```bash
# Instalar dependencias
npm install

# Iniciar el servidor
npm start
```

Asegúrate de tener un archivo `.env` con las variables necesarias para desarrollo:
- PORT=3001
- NODE_ENV=development
- CORS_ORIGIN=http://localhost:3000
- YOUTUBE_API_URL=http://localhost:5000/api 