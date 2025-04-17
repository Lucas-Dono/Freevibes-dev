# FreeVibes Web - Guía de Inicio Rápido

<div align="center">
  <img src="../../public/logo.png" alt="FreeVibes Web Logo" width="200" />
  <h3>Explorador de música con múltiples fuentes y reproductor integrado</h3>
</div>

<div align="center">
  
  [ Inicio ](../../README.md) | [ Documentación Técnica ](TECHNICAL.md) | [ Historial de Cambios ](CHANGELOG.md)
  
</div>

---

## Índice

- [Descripción](#-descripción)
- [Características](#-características)
- [Instalación](#-instalación)
- [Arquitectura](#-arquitectura)
- [Uso Básico](#-uso-básico)
- [Desarrollo](#-desarrollo)
- [Despliegue](#-despliegue)
- [Licencias](#-licencias)

## Descripción

FreeVibes Web es una aplicación que he desarrollado para unificar contenido de múltiples plataformas de música como YouTube, Spotify y Last.fm en una única interfaz moderna y fácil de usar. Te permite buscar, descubrir, reproducir y gestionar música desde diversas fuentes sin tener que cambiar entre aplicaciones diferentes.

### ¿Por qué FreeVibes Web?

- **Todo en uno**: Accede a contenido de múltiples plataformas desde una sola interfaz
- **Sin restricciones**: Reproduce música de YouTube sin limitaciones, incluso en segundo plano
- **Experiencia personalizada**: Crea playlists, gestiona favoritos y descubre nueva música
- **Interfaz moderna**: Diseño limpio e intuitivo adaptable a cualquier dispositivo

## Características

- **Reproductor unificado** para contenido de YouTube, Spotify y Last.fm
- **Búsqueda universal** que recupera resultados de múltiples fuentes
- **Recomendaciones personalizadas** basadas en tus preferencias y historial
- **Explorador por género** con categorías y recomendaciones
- **Playlists personalizadas** para organizar tu música
- **Modo sin conexión** (próximamente)
- **Sincronización entre dispositivos** (próximamente)

## Instalación

### Requisitos Previos

- Node.js 18.x o superior
- npm 8.x o superior
- Python 3.8 o superior (para el servicio de FreeVibes)
- Un navegador moderno (Chrome, Firefox, Edge, Safari)

### Instalación Local

1. **Clonar el repositorio**

```bash
git clone https://github.com/tu-usuario/youtube-music-web.git
cd youtube-music-web
```

2. **Configurar variables de entorno**

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```
YOUTUBE_API_KEY=tu_clave_api_de_youtube
SPOTIFY_CLIENT_ID=tu_client_id_de_spotify
SPOTIFY_CLIENT_SECRET=tu_client_secret_de_spotify
LASTFM_API_KEY=tu_clave_api_de_lastfm
```

3. **Instalar dependencias y ejecutar en desarrollo**

```bash
# Instalar dependencias
npm install

# Iniciar todos los servicios
npm run dev:all
```

O si prefieres iniciar cada servicio por separado:

```bash
# Servidor Python (API de FreeVibes)
cd python-api
pip install -r requirements.txt
python app.py

# Servidor Node.js (Proxy)
cd node-server
npm install
node server.js

# Frontend Next.js
npm run dev
```

4. **Acceder a la aplicación**

Abre tu navegador y ve a: http://localhost:3000

## Arquitectura

El sistema que he diseñado consta de tres componentes principales:

1. **Frontend Next.js** - La interfaz de usuario principal
   - Tecnologías: Next.js 14, React, TailwindCSS
   - Desplegado en: Vercel

2. **Servidor Proxy Node.js** - API para intermediar entre el frontend y las distintas fuentes
   - Tecnologías: Express, Node.js, Axios
   - Desplegado en: Render

3. **API de FreeVibes en Python** - Servicio especializado para acceder a FreeVibes
   - Tecnologías: Flask, ytmusicapi
   - Desplegado en: Render

Para más detalles sobre la arquitectura, consulta la [Documentación Técnica](TECHNICAL.md).

## Uso Básico

### Navegación Principal

- **Explorar**: Descubre música por géneros, artistas populares y nuevos lanzamientos
- **Búsqueda**: Encuentra canciones, artistas, álbumes y playlists de múltiples fuentes
- **Biblioteca**: Accede a tus favoritos, playlists y historial de reproducción
- **Reproductor**: Control completo sobre la reproducción con cola, repetición y aleatorio

### Búsqueda Universal

1. Escribe tu consulta en el campo de búsqueda
2. Los resultados se muestran agrupados por categoría (canciones, artistas, álbumes)
3. Utiliza los filtros para especificar la fuente deseada (YouTube, Spotify, Last.fm)

### Reproductor

- Controles estándar: play/pausa, anterior/siguiente, volumen
- Cola de reproducción: visualiza y gestiona las próximas canciones
- Modos: repetición (canción/lista), aleatorio, automix

## Desarrollo

### Estructura del Proyecto

```
youtube-music-web/
├── app/                   # Aplicación Next.js
│   ├── (routes)/          # Rutas de la aplicación
│   ├── api/               # API routes de Next.js
│   └── components/        # Componentes React
├── node-server/           # Servidor proxy Node.js
│   └── server.js          # Punto de entrada del servidor
├── python-api/            # API de FreeVibes
│   └── app.py             # Aplicación Flask
├── public/                # Archivos estáticos
└── docs/                  # Documentación
```

### Scripts Disponibles

- `npm run dev`: Inicia el frontend de Next.js
- `npm run build`: Construye la aplicación para producción
- `npm run start`: Inicia la versión de producción
- `npm run dev:all`: Inicia todos los servicios (frontend, node, python)

### Contribuciones

Si deseas contribuir al proyecto:

1. Haz un fork del repositorio
2. Crea una rama para tu funcionalidad (`git checkout -b feature/amazing-feature`)
3. Haz commit de tus cambios (`git commit -m 'Add some amazing feature'`)
4. Haz push a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

## Despliegue

### Vercel (Frontend)

1. Conecta tu repositorio de GitHub a Vercel
2. Configura las variables de entorno necesarias
3. Deploy automático con cada push a la rama principal

### Render (Backend - Node.js y Python)

Configura cada servicio por separado según la [Documentación Técnica](TECHNICAL.md).

## 📄 Licencias

- **Código fuente**: [MIT](../../LICENSE)
- **YouTube** y **Spotify**: El uso de sus APIs está sujeto a sus propios términos de servicio

---

<div align="center">
  <p>© 2025 FreeVibes Web</p>
</div> 