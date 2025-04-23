# freevibes Python API para FreeVibes

Esta API proporciona acceso a funcionalidades de FreeVibes, permitiendo buscar canciones, obtener recomendaciones y más.

## Despliegue en Render

### Pasos para desplegar en Render:

1. **Crear un nuevo servicio Web**:
   - En el dashboard de Render, selecciona "New" y luego "Web Service"
   - Conecta tu repositorio de GitHub/GitLab/Bitbucket

2. **Configuración del servicio**:
   - **Nombre**: `freevibes-python-api` (o el que prefieras)
   - **Ambiente**: `Python`
   - **Región**: Selecciona la más cercana a tus usuarios
   - **Rama**: `main` (o la que uses)
   - **Directorio raíz**: `python-api` (importante: indica esta subcarpeta)
   - **Comando de construcción**: `pip install -r requirements.txt`
   - **Comando de inicio**: `gunicorn app:app`
   - **Plan**: Free (o selecciona otro según tus necesidades)

3. **Variables de entorno**:
   Configura las siguientes variables en la sección "Environment":
   - `PORT`: 10000 (Render asigna este puerto automáticamente)
   - `FLASK_ENV`: production
   - `CORS_ORIGIN`: URLs separadas por comas (ej: https://freevibes.vercel.app,https://freevibes-node-api.onrender.com)
   - `YOUTUBE_API_KEY`: Tu clave de API de YouTube Data v3

4. **Crear servicio**:
   - Haz clic en "Create Web Service"
   - Render comenzará a desplegar automáticamente

## Desarrollo local

Para ejecutar esta API localmente:

```bash
# Crear y activar entorno virtual (opcional pero recomendado)
python -m venv venv
source venv/bin/activate   # En Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Iniciar el servidor
python app.py
```

Asegúrate de tener un archivo `.env` con las variables necesarias para desarrollo:
- PORT=5000
- FLASK_ENV=development
- CORS_ORIGIN=http://localhost:3000,http://localhost:3001
- YOUTUBE_API_KEY=tu_clave_de_api

## Endpoints disponibles

- `/` - Verificación de salud
- `/api` - Información de la API
- `/search` - Buscar en FreeVibes
- `/find-track` - Encontrar una pista específica
- `/spotify-to-youtube` - Convertir ID de Spotify a YouTube
- `/recommendations` - Obtener recomendaciones
- `/featured-playlists` - Obtener playlists destacadas
- `/new-releases` - Obtener nuevos lanzamientos
- `/artists-by-genre` - Buscar artistas por género
