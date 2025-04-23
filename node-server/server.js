const express = require('express');
const cors = require('cors');
require('dotenv').config();
const ytdl = require('ytdl-core');
const ytsr = require('ytsr');
const fs = require('fs');
const axios = require('axios'); // Para peticiones HTTP
const NodeCache = require('node-cache');
// Importar el manejador de modo demo
const { handleDemoRequest, isDemoMode } = require('./demo-data/demo-handler');
// Importar las funciones de manejo de playlists de demo
const { getDemoPlaylists, getPlaylistDetailsByArtist } = require('./demo-handler');

const app = express();
const PORT = process.env.PORT || '3001'; // Asegurar string
const PYTHON_API_BASE_URL = process.env.YOUTUBE_API_URL || 'http://localhost:5000'; // Nueva variable base
// URL base sin el sufijo /api para las rutas que no lo requieren (si es necesario)
// const PYTHON_BASE_URL = PYTHON_API_BASE_URL.replace(/\/api$/, ''); // Comentado/Eliminado si no se usa

// Configuración CORS
const corsOptions = {
  // Función que determina dinámicamente qué origen permitir
  origin: function(origin, callback) {
    const allowedOriginsEnv = process.env.CORS_ORIGIN;
    const defaultOrigins = ['http://localhost:3100', 'http://localhost:3000'];

    // Usar orígenes de env si existen, si no, los por defecto
    const allowedOrigins = allowedOriginsEnv ? allowedOriginsEnv.split(',') : defaultOrigins;

    // En modo desarrollo, o si no hay origen (Postman, curl), permitir
    if (!origin || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    // Normalizar el origen recibido (quitar posible / al final)
    const normalizedOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;

    // Verificar si el origen normalizado O el origen sin esquema está en la lista permitida
    const isAllowed = allowedOrigins.some(allowed =>
        allowed === normalizedOrigin || // Coincidencia exacta (ej. https://dominio.com)
        allowed === normalizedOrigin.replace(/^https?:\/\//, '') || // Coincidencia sin esquema (ej. dominio.com)
        allowed === '*' // Comodín
    );

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`Origen bloqueado por CORS: ${origin}. Orígenes permitidos: ${allowedOrigins.join(', ')}`);
      callback(new Error('No permitido por CORS'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 204
};

// Aplicar CORS restrictivo a toda la aplicación
app.use(cors(corsOptions));

// Para el endpoint de status específico que necesita CORS abierto
const openCorsOptions = {
  origin: '*', // Permitir cualquier origen para status
  methods: ['GET', 'OPTIONS'], // Solo métodos necesarios para status
  credentials: false // No necesario para status
};

// Log de la configuración CORS al inicio
console.log('Configuración CORS principal:', {
  origin: typeof corsOptions.origin === 'function'
    ? `Función dinámica basada en CORS_ORIGIN=${process.env.CORS_ORIGIN || 'default (localhost)'}`
    : corsOptions.origin,
  env: process.env.NODE_ENV || 'development'
});

// Middleware
app.use(express.json());

// Middleware para logging de modo demo - ayuda a debug
app.use((req, res, next) => {
  if (req.headers['x-demo-mode'] === 'true') {
    console.log(`[DEMO] Solicitud recibida: ${req.method} ${req.path}`);
    console.log(`[DEMO] Idioma: ${req.headers['x-demo-lang'] || 'es'}`);
  }
  next();
});

// Crear caché para resultados de Spotify con tiempo de expiración de 24 horas
const spotifyCache = new NodeCache({ stdTTL: 86400, checkperiod: 120 });

// Endpoint raíz para verificación de salud (usa CORS principal)
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'FreeVibes Node.js API is running',
    environment: process.env.NODE_ENV || 'development',
    pythonApiBaseUrl: PYTHON_API_BASE_URL, // Actualizado nombre
    demoMode: isDemoMode(req) ? 'enabled' : 'disabled'
  });
});

// Status endpoint con CORS abierto específico
app.get('/status', cors(openCorsOptions), (req, res) => {
  // Responder inmediatamente con un status 200 y datos mínimos
  console.log('[Status] Solicitud de verificación recibida (CORS abierto)');
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    server: 'node'
  });
});

// Endpoint para verificar el estado del servidor YouTube Music - ELIMINADO
/*
app.get('/api/youtube/status', cors(openCorsOptions), async (req, res) => {
  console.log('[Status] Verificando servidor YouTube Music');
  try {
    // Intentar hacer una solicitud simple al servidor Python (asumiendo ruta /status)
    const apiPrefix = PYTHON_API_BASE_URL.endsWith('/api') ? '' : '/api';
    const response = await axios.get(`${PYTHON_API_BASE_URL}${apiPrefix}/status`, { // Usa la nueva variable base
      timeout: 3000 // Timeout reducido para verificación rápida
    });

    if (response.status === 200) {
      console.log('[Status] Servidor Python está activo');
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        server: 'python'
      });
    } else {
      console.log('[Status] Servidor Python respondió con error:', response.status);
      res.status(503).json({
        status: 'ERROR',
        message: 'YouTube Music API (Python) no responde correctamente',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.log('[Status] Error al verificar servidor Python:', error.message);
    // Responder con error pero en formato JSON
    res.status(503).json({
      status: 'ERROR',
      message: 'No se pudo conectar con YouTube Music API (Python)',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});
*/

// Manejador simple para el endpoint de búsqueda que redirecciona al Python API
// Este endpoint es utilizado por la verificación de disponibilidad
app.get('/api/youtube/search', async (req, res) => {
  // Si no hay parámetros, devolver un array vacío
  if (!req.query.query) {
    console.log('[Proxy] Verificación de disponibilidad /api/youtube/search sin query');
    return res.json([]);
  }

  // Si la solicitud no tiene handler específico, redirigir al Python API
  try {
    console.log(`[Proxy] Redirigiendo /api/youtube/search a Python API: ${JSON.stringify(req.query)}`);

    // Realizar la solicitud al servicio Python (asumiendo ruta /api/search)
    // Asegurarse de incluir /api si no está ya en la URL base
    const apiPrefix = PYTHON_API_BASE_URL.endsWith('/api') ? '' : '/api';
    const response = await axios.get(`${PYTHON_API_BASE_URL}${apiPrefix}/search`, {
      params: req.query,
      timeout: 5000 // Timeout corto para verificaciones
    });

    // Enviar la respuesta al cliente
    res.json(response.data || []);
  } catch (error) {
    console.error(`[Proxy] Error en /api/youtube/search:`, error.message);
    // Devolver array vacío para evitar errores en el cliente
    res.json([]);
  }
});

// Middleware para manejar solicitudes en modo demo antes de las rutas de Spotify
app.use('/api/spotify', async (req, res, next) => {
  try {
    // Si no es modo demo o la solicitud no pudo ser manejada, continuar con el flujo normal
    const handled = await handleDemoRequest(req, res);
    if (!handled) {
      next();
    }
  } catch (error) {
    console.error('Error en middleware de modo demo:', error);
    next();
  }
});

// Proxy para la API de Python (YouTube Music)
app.post('/api/youtube/setup', async (req, res) => { // Asumiendo ruta /setup en Python
  try {
    // Asegurarse de incluir /api si no está ya en la URL base
    const apiPrefix = PYTHON_API_BASE_URL.endsWith('/api') ? '' : '/api';
    const response = await axios.post(`${PYTHON_API_BASE_URL}${apiPrefix}/setup`, req.body);
    res.json(response.data);
  } catch (error) {
    // Propagar error de Python si existe
    const status = error.response?.status || 500;
    const message = error.response?.data?.error || error.message;
    console.error(`[Proxy] Error en /api/youtube/setup: ${status} - ${message}`);
    res.status(status).json({ error: message });
  }
});

// Proxy genérico para todas las rutas de YouTube Music (Python API)
// Esta ruta capturará todas las solicitudes que no coincidan con una ruta específica
app.all('/api/youtube/*', async (req, res, next) => {
  // Lista de rutas que tienen sus propios manejadores específicos (REVISAR SI AÚN SON NECESARIOS)
  const specificEndpoints = [
    // '/api/youtube/search', // Ya tiene su propio handler arriba
    // ...otras rutas específicas si las hay...
    '/api/youtube/status', // Ya tiene su propio handler arriba
  ];

  // Si es una ruta que tiene su propio manejador específico, pasamos al siguiente middleware
  if (specificEndpoints.includes(req.path)) {
     console.log(`[Proxy] Saltando proxy genérico para ruta específica: ${req.path}`);
     return next(); // Dejar que el manejador específico se encargue
  }

  try {
    // Obtener la parte de la ruta después de /api/youtube/ -> esta será la ruta en Python
    const pythonEndpoint = req.path.replace('/api/youtube', ''); // Ej: /lyrics, /get-watch-playlist

    // Construir la URL para redirigir al servicio Python
    // Asegurarse de incluir /api si no está ya en la URL base
    const apiPrefix = PYTHON_API_BASE_URL.endsWith('/api') ? '' : '/api';
    const targetUrl = `${PYTHON_API_BASE_URL}${apiPrefix}${pythonEndpoint}`;

    console.log(`[Proxy] Redirigiendo solicitud genérica ${req.method} ${req.path} a: ${targetUrl}`);

    // Configurar las opciones de la solicitud
    const options = {
      method: req.method,
      url: targetUrl,
      params: req.query,
      headers: { 'Content-Type': 'application/json' }, // Asegurar Content-Type
      timeout: 15000 // 15 segundos de timeout
    };

    // Si es POST, PUT, etc., agregar el cuerpo de la solicitud
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      options.data = req.body;
    }

    // Realizar la solicitud al servicio Python
    const response = await axios(options);

    // Enviar la respuesta al cliente
    console.log(`[Proxy] Respuesta exitosa desde ${targetUrl} con estado ${response.status}`);
    res.status(response.status).json(response.data);
  } catch (error) {
    // Propagar error de Python si existe
    const status = error.response?.status || 502; // 502 Bad Gateway si no hay respuesta
    const responseData = error.response?.data;
    let message = error.message;
    if (responseData) {
      message = responseData.error || responseData.message || JSON.stringify(responseData);
    }

    console.error(`[Proxy] Error en proxy genérico para ${req.path}: ${status} - ${message}`);
    res.status(status).json({ error: `Error en API Python: ${message}` });
  }
});

// Ruta para búsqueda en YouTube Music
app.get('/api/youtube/search', async (req, res) => {
  try {
    const { query, filter = 'songs', limit = 10, region = 'US', language = 'es' } = req.query;

    // Guardar consulta en el historial (solo si hay contenido)
    if (query && query.trim()) {
      addToSearchHistory(query);
    }

    console.log(`Buscando en YouTube Music: "${query}" (filtro: ${filter}, límite: ${limit}, región: ${region}, idioma: ${language})`);

    // Verificar si estamos en modo demo para usar datos de demo
    const isDemoMode = req.headers['x-demo-mode'] === 'true';

    if (isDemoMode) {
      console.log('[/api/youtube/search] Usando datos demo para búsqueda');

      // Crear resultados demo basados en la consulta para hacerlo más realista
      const demoResults = [
        {
          videoId: 'demo_video_1',
          title: `${query} - Top Hit (Demo)`,
          artist: 'Demo Artist',
          thumbnailUrl: 'https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg',
          thumbnail: 'https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg',
          album: 'Demo Album',
          duration: 240
        },
        {
          videoId: 'demo_video_2',
          title: `${query} Remix (Demo)`,
          artist: 'Another Artist',
          thumbnailUrl: 'https://i.ytimg.com/vi/DWcJFNfaw9c/hqdefault.jpg',
          thumbnail: 'https://i.ytimg.com/vi/DWcJFNfaw9c/hqdefault.jpg',
          album: 'Demo Collection',
          duration: 180
        },
        {
          videoId: 'demo_video_3',
          title: `Best of ${query} (Demo)`,
          artist: 'Demo Group',
          thumbnailUrl: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
          thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
          album: 'Demo Compilation',
          duration: 300
        },
        {
          videoId: 'demo_video_4',
          title: `${query} Official Music Video (Demo)`,
          artist: 'Demo VEVO',
          thumbnailUrl: 'https://i.ytimg.com/vi/34Na4j8AVgA/hqdefault.jpg',
          thumbnail: 'https://i.ytimg.com/vi/34Na4j8AVgA/hqdefault.jpg',
          album: 'Demo Singles',
          duration: 260
        },
        {
          videoId: 'demo_video_5',
          title: `${query} Live Demo`,
          artist: 'Demo Awards Show',
          thumbnailUrl: 'https://i.ytimg.com/vi/ixkoVwKQaJg/hqdefault.jpg',
          thumbnail: 'https://i.ytimg.com/vi/ixkoVwKQaJg/hqdefault.jpg',
          album: 'Demo Live',
          duration: 280
        },
        {
          videoId: 'demo_video_6',
          title: `${query} Demo Version`,
          artist: 'Demo Sessions',
          thumbnailUrl: 'https://i.ytimg.com/vi/ZuCUXxzjqi4/hqdefault.jpg',
          thumbnail: 'https://i.ytimg.com/vi/ZuCUXxzjqi4/hqdefault.jpg',
          album: 'Demo Tracks',
          duration: 210
        }
      ];

      console.log(`[API] Usando datos demo. Resultados generados: ${demoResults.length}`);
      return res.json(demoResults);
    }

    // Intentar obtener datos reales de YouTube
    try {
      const response = await axios.get(`${PYTHON_API_BASE_URL}/api/search`, {
        params: {
          query,
          filter,
          limit,
          region,
          language
        },
        timeout: 15000, // Aumentar timeout a 15 segundos
        validateStatus: () => true // Aceptar cualquier código de estado para manejar manualmente
      });

      // Verificar estado de respuesta
      if (response.status !== 200) {
        console.error(`Error en la búsqueda de YouTube Music. Código: ${response.status}`);
        throw new Error(`Error en la API de YouTube Music. Código: ${response.status}`);
      }

      // Verificar datos de respuesta
      if (!response.data) {
        console.error('La API de YouTube Music devolvió datos vacíos');
        throw new Error('No se recibieron datos de la API de YouTube Music');
      }

      // Validar formato de los datos
      const results = Array.isArray(response.data) ? response.data : [];
      console.log(`Resultados encontrados para "${query}": ${results.length}`);

      // Transformar datos a un formato consistente
      // NOTA: Cambiamos la estructura para que sea compatible con lo que espera el frontend
      const transformedResults = results.map(item => ({
        videoId: item.id || '',
        title: item.title || 'Sin título',
        artist: item.artist || 'Artista desconocido',
        thumbnailUrl: item.thumbnail || '',
        thumbnail: item.thumbnail || '',  // Añadir campo thumbnail también
        album: item.album || '',
        duration: item.duration || 0
      }));

      console.log(`[API] Búsqueda completada. Resultados normalizados: ${transformedResults.length}`);

      // Devolver directamente el array de resultados en lugar de un objeto con propiedad "results"
      return res.json(transformedResults);
    } catch (ytError) {
      console.error('Error al buscar en YouTube Music, usando datos fallback:', ytError.message);

      // Usar datos fallback para tener resultados garantizados
      // Estos datos cambian según la búsqueda para dar sensación de resultados reales
      const seed = query.length; // Usar la longitud de la consulta como semilla para variedad

      // Crear array de resultados fallback basados en la consulta
      const fallbackResults = [];

      // Añadir al menos 6 resultados para tener suficiente contenido
      fallbackResults.push({
        videoId: `fallback_${seed}_1`,
        title: `${query} - Top Hit`,
        artist: 'Popular Artist',
        thumbnailUrl: 'https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg',
        thumbnail: 'https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg',
        album: 'Greatest Hits',
        duration: 240 + seed
      });

      fallbackResults.push({
        videoId: `fallback_${seed}_2`,
        title: `${query} Remix`,
        artist: 'DJ Example',
        thumbnailUrl: 'https://i.ytimg.com/vi/DWcJFNfaw9c/hqdefault.jpg',
        thumbnail: 'https://i.ytimg.com/vi/DWcJFNfaw9c/hqdefault.jpg',
        album: 'Remix Collection',
        duration: 180 + seed
      });

      fallbackResults.push({
        videoId: `fallback_${seed}_3`,
        title: `The Best of ${query}`,
        artist: 'Music Channel',
        thumbnailUrl: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
        album: 'Compilation',
        duration: 300 + seed
      });

      fallbackResults.push({
        videoId: `fallback_${seed}_4`,
        title: `${query} (Official Video)`,
        artist: 'VEVO',
        thumbnailUrl: 'https://i.ytimg.com/vi/34Na4j8AVgA/hqdefault.jpg',
        album: 'Singles',
        duration: 260 + seed
      });

      fallbackResults.push({
        videoId: `fallback_${seed}_5`,
        title: `${query} Live Performance`,
        artist: 'Music Awards',
        thumbnailUrl: 'https://i.ytimg.com/vi/ixkoVwKQaJg/hqdefault.jpg',
        album: 'Live Recordings',
        duration: 280 + seed
      });

      fallbackResults.push({
        videoId: `fallback_${seed}_6`,
        title: `${query} Acoustic Version`,
        artist: 'Unplugged Sessions',
        thumbnailUrl: 'https://i.ytimg.com/vi/ZuCUXxzjqi4/hqdefault.jpg',
        album: 'Acoustic Covers',
        duration: 210 + seed
      });

      // Devolver directamente el array de resultados fallback
      console.log(`[API] Usando datos fallback. Resultados generados: ${fallbackResults.length}`);
      return res.json(fallbackResults);
    }
  } catch (error) {
    console.error('Error al procesar la búsqueda:', error.message);

    // Devolver un array vacío consistente con el resto de la API
    res.json([]);
  }
});

app.get('/api/youtube/find-track', async (req, res) => {
  try {
    console.log(`Buscando track específico con parámetros:`, req.query);

    const apiPrefix = PYTHON_API_BASE_URL.endsWith('/api') ? '' : '/api';
    const response = await axios.get(`${PYTHON_API_BASE_URL}${apiPrefix}/find-track`, {
      params: req.query,
      timeout: 15000,
      validateStatus: () => true // Aceptar cualquier código de estado para manejar manualmente
    });

    // Verificar estado de respuesta
    if (response.status !== 200) {
      console.error(`Error en find-track de YouTube Music. Código: ${response.status}`);
      throw new Error(`Error en la API de YouTube Music. Código: ${response.status}`);
    }

    // Verificar datos de respuesta
    if (!response.data) {
      console.error('La API de YouTube Music devolvió datos vacíos en find-track');
      throw new Error('No se recibieron datos de la API de YouTube Music');
    }

    // Asegurarse de que la respuesta tenga un formato válido
    const data = response.data;

    // Si no hay videoId, consideramos que no se encontró
    if (!data.id && !data.videoId) {
      console.log('No se encontró ID de video para la búsqueda específica');
      return res.json({
        videoId: null,
        title: req.query.title || '',
        artist: req.query.artist || '',
        message: 'No se encontró un video para esta canción'
      });
    }

    // Normalizar datos
    const result = {
      videoId: data.id || data.videoId || null,
      title: data.title || req.query.title || '',
      artist: data.artist || req.query.artist || '',
      videoThumbnails: data.thumbnails || [{ url: data.thumbnail || '' }],
      lengthSeconds: data.duration || 0
    };

    console.log(`Video encontrado para ${req.query.title}: ${result.videoId}`);
    res.json(result);
  } catch (error) {
    console.error('Error en la búsqueda específica:', error.message);

    // Devolver un objeto con estructura similar pero indicando el error
    res.json({
      videoId: null,
      title: req.query.title || '',
      artist: req.query.artist || '',
      error: error.message,
      message: 'Error al buscar la canción'
    });
  }
});

// Endpoint para obtener información de artistas de YouTube Music
app.get('/api/youtube-artist', async (req, res) => {
  try {
    const { artistId } = req.query;

    if (!artistId) {
      return res.status(400).json({ error: 'Se requiere el parámetro artistId' });
    }

    console.log(`[API] Obteniendo información del artista de YouTube Music con ID: ${artistId}`);

    // Configuración para reintentos
    const maxRetries = 3;
    const retryDelay = 1000; // 1 segundo entre reintentos

    // Función para realizar la solicitud con reintentos
    const fetchWithRetry = async (retryCount = 0) => {
      try {
        // Hacer la petición al servidor Python - Usar PYTHON_API_BASE_URL porque la ruta en Python incluye /api/
        const apiPrefix = PYTHON_API_BASE_URL.endsWith('/api') ? '' : '/api';
        const response = await axios.get(`${PYTHON_API_BASE_URL}${apiPrefix}/youtube-artist`, {
          params: {
            artistId,
            _t: Date.now() // Parámetro para evitar caché en caso de errores
          },
          timeout: 15000, // Timeout de 15 segundos
          validateStatus: () => true // Aceptar cualquier código de estado para manejar manualmente
        });

        // Verificar estado de respuesta
        if (response.status !== 200) {
          // Si obtenemos un error 404 o 500 y aún tenemos reintentos disponibles
          if ((response.status === 404 || response.status === 500) && retryCount < maxRetries) {
            console.log(`[API] Reintento ${retryCount + 1}/${maxRetries} para artista ${artistId} - Recibido código ${response.status}`);

            // Esperar antes de reintentar (backoff exponencial)
            await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));

            // Reintentar la solicitud
            return fetchWithRetry(retryCount + 1);
          }

          console.error(`Error al obtener artista de YouTube Music. Código: ${response.status}`);
          throw new Error(`Error en la API de YouTube Music. Código: ${response.status}`);
        }

        // Verificar datos de respuesta
        if (!response.data) {
          console.error('La API de YouTube Music devolvió datos vacíos');
          throw new Error('No se recibieron datos de la API de YouTube Music');
        }

        return response.data;
      } catch (error) {
        // Si es un error de red o timeout y aún tenemos reintentos disponibles
        if ((error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.message.includes('timeout'))
            && retryCount < maxRetries) {
          console.log(`[API] Reintento ${retryCount + 1}/${maxRetries} para artista ${artistId} - Error: ${error.message}`);

          // Esperar antes de reintentar
          await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));

          // Reintentar la solicitud
          return fetchWithRetry(retryCount + 1);
        }

        // Si ya no hay reintentos o es otro tipo de error, propagarlo
        throw error;
      }
    };

    // Ejecutar la función con reintentos
    const artistData = await fetchWithRetry();

    // Devolver los datos del artista
    res.json(artistData);
  } catch (error) {
    console.error('Error al obtener información del artista de YouTube Music:', error.message);

    // Información detallada para depuración
    if (error.response) {
      console.error('Detalles de la respuesta de error:', {
        status: error.response.status,
        data: error.response.data
      });
    } else if (error.request) {
      console.error('Error de solicitud (no se recibió respuesta):', {
        method: error.request.method,
        path: error.request.path,
        host: error.request.host
      });
    }

    res.status(500).json({
      error: 'Error al obtener información del artista',
      message: error.message
    });
  }
});

// Endpoint para buscar artistas de YouTube Music por nombre
app.get('/api/youtube/find-artist-by-name', async (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({
        error: 'Se requiere el parámetro name',
        success: false
      });
    }

    console.log(`[API] Buscando artista de YouTube Music por nombre: "${name}"`);

    // Hacer la petición al servidor Python para buscar artistas por nombre
    const apiPrefix = PYTHON_API_BASE_URL.endsWith('/api') ? '' : '/api';
    const response = await axios.get(`${PYTHON_API_BASE_URL}${apiPrefix}/api/search`, {
      params: {
        query: `${name} official artist`,
        filter: 'artists',
        limit: 3
      },
      timeout: 15000,
      validateStatus: () => true
    });

    // Verificar estado de respuesta
    if (response.status !== 200) {
      console.error(`Error al buscar artista por nombre. Código: ${response.status}`);
      throw new Error(`Error en la API de YouTube Music. Código: ${response.status}`);
    }

    // Verificar datos de respuesta
    if (!response.data || !Array.isArray(response.data)) {
      console.error('La API de YouTube Music devolvió datos inválidos');
      throw new Error('No se recibieron datos válidos de la API de YouTube Music');
    }

    const artists = response.data;

    if (artists.length === 0) {
      console.log(`No se encontraron artistas para "${name}"`);
      return res.json({
        success: false,
        message: `No se encontraron artistas para "${name}"`,
        artists: []
      });
    }

    // Filtrar los resultados para encontrar el que coincida mejor con el nombre buscado
    const normalizedSearchName = name.toLowerCase().replace(/\s+/g, '');

    // Ordenar por coincidencia más cercana
    const sortedArtists = artists.map(artist => {
      const artistName = artist.name || artist.title || '';
      const normalizedArtistName = artistName.toLowerCase().replace(/\s+/g, '');

      // Calcular un puntaje simple de coincidencia
      let score = 0;
      if (normalizedArtistName.includes(normalizedSearchName)) score += 3;
      if (normalizedSearchName.includes(normalizedArtistName)) score += 2;
      if (normalizedArtistName === normalizedSearchName) score += 5;

      return { ...artist, matchScore: score };
    }).sort((a, b) => b.matchScore - a.matchScore);

    const bestMatch = sortedArtists[0];

    console.log(`Mejor coincidencia para "${name}": "${bestMatch.name || bestMatch.title}" (ID: ${bestMatch.id || bestMatch.browseId})`);

    res.json({
      success: true,
      artist: {
        id: bestMatch.browseId || bestMatch.id,
        name: bestMatch.name || bestMatch.title,
        thumbnails: bestMatch.thumbnails || []
      },
      allResults: sortedArtists.map(artist => ({
        id: artist.browseId || artist.id,
        name: artist.name || artist.title,
        thumbnails: artist.thumbnails || []
      }))
    });
  } catch (error) {
    console.error('Error al buscar artista por nombre:', error.message);

    if (error.response) {
      console.error('Detalles de la respuesta de error:', {
        status: error.response.status,
        data: error.response.data
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error al buscar artista por nombre',
      message: error.message
    });
  }
});

// Endpoint para convertir de Spotify a YouTube
app.get('/api/youtube/spotify-to-youtube', async (req, res) => {
  try {
    const apiPrefix = PYTHON_API_BASE_URL.endsWith('/api') ? '' : '/api';
    const response = await axios.get(`${PYTHON_API_BASE_URL}${apiPrefix}/spotify-to-youtube`, {
      params: req.query
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Función para obtener un token de Spotify (añadir credenciales reales para producción)
async function getSpotifyToken() {
  try {
    // Para producción: usar variables de entorno
    const clientId = process.env.SPOTIFY_CLIENT_ID || 'YOUR_CLIENT_ID';
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';

    // Si los valores son los predeterminados, devolver null
    if (clientId === 'YOUR_CLIENT_ID' || clientSecret === 'YOUR_CLIENT_SECRET') {
      console.log('[SPOTIFY] Credenciales no configuradas, utilizando base de datos local');
      return null;
    }

    // Si ya tenemos un token en caché, usarlo
    const cachedToken = spotifyCache.get('spotify_token');
    if (cachedToken) {
      return cachedToken;
    }

    // Obtener nuevo token
    const response = await axios({
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      params: {
        grant_type: 'client_credentials'
      },
      headers: {
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Guardar en caché (restando 60 segundos para asegurar validez)
    const token = response.data.access_token;
    const expiresIn = response.data.expires_in - 60;
    spotifyCache.set('spotify_token', token, expiresIn);

    return token;
  } catch (error) {
    console.error('[SPOTIFY] Error obteniendo token:', error.message);
    return null;
  }
}

// Función para buscar datos de un track en Spotify
async function searchTrackOnSpotify(title, existingArtist = '') {
  try {
    // Verificar caché primero
    const cacheKey = `track_${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const cachedData = spotifyCache.get(cacheKey);
    if (cachedData) {
      console.log(`[SPOTIFY] Cache hit para "${title}"`);
      return cachedData;
    }

    // Obtener token
    const token = await getSpotifyToken();
    if (!token) {
      console.log(`[SPOTIFY] No hay token disponible, usando base de datos local para "${title}"`);
      // Intentar buscar en la base de datos local
      return findTrackInLocalDatabase(title);
    }

    // Construir consulta
    let query = title;
    // Si hay un artista existente con valor parcial, añadirlo para mejorar la búsqueda
    if (existingArtist && existingArtist !== 'Artista desconocido') {
      query += ` artist:${existingArtist}`;
    }

    // Hacer solicitud a Spotify
    const response = await axios({
      method: 'get',
      url: 'https://api.spotify.com/v1/search',
      params: {
        q: query,
        type: 'track',
        limit: 1
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    // Procesar respuesta
    if (response.data && response.data.tracks && response.data.tracks.items.length > 0) {
      const track = response.data.tracks.items[0];
      const artistName = track.artists[0]?.name || existingArtist || 'Artista desconocido';
      const albumName = track.album?.name || '';
      const albumCover = track.album?.images[0]?.url || '';

      const result = {
        artist: artistName,
        album: albumName,
        cover: albumCover,
        spotify_id: track.id,
        source: 'spotify_search'
      };

      // Guardar en caché por 24 horas
      spotifyCache.set(cacheKey, result, 86400);

      console.log(`[SPOTIFY] Encontrado artista para "${title}": "${artistName}"`);
      return result;
    } else {
      console.log(`[SPOTIFY] No se encontró información para "${title}"`);
      // Como fallback, intentar con la base de datos local
      return findTrackInLocalDatabase(title);
    }
  } catch (error) {
    console.error(`[SPOTIFY] Error buscando "${title}":`, error.message);
    // En caso de error, usar la base de datos local
    return findTrackInLocalDatabase(title);
  }
}

// Función para buscar una canción en nuestra base de datos local
function findTrackInLocalDatabase(title) {
  // Base de datos ampliada con más canciones populares
  const songDatabase = {
    'save your tears': { artist: 'The Weeknd', album: 'After Hours' },
    'save your tears remix': { artist: 'The Weeknd & Ariana Grande', album: 'After Hours' },
    'blinding lights': { artist: 'The Weeknd', album: 'After Hours' },
    'starboy': { artist: 'The Weeknd', album: 'Starboy' },
    'die for you': { artist: 'The Weeknd', album: 'Starboy' },
    'columbia': { artist: 'Quevedo', album: 'Columbia' },
    'too sweet': { artist: 'Hozier', album: 'Unreal Unearth' },
    'la noche de anoche': { artist: 'Bad Bunny & ROSALÍA', album: 'El Último Tour Del Mundo' },
    'señorita': { artist: 'Shawn Mendes & Camila Cabello', album: 'Señorita' },
    'without me': { artist: 'Halsey', album: 'Manic' },
    'lose control': { artist: 'MEDUZA, Becky Hill & Goodboys', album: 'Lose Control' },
    'dance monkey': { artist: 'Tones and I', album: 'The Kids Are Coming' },
    '7 rings': { artist: 'Ariana Grande', album: 'thank u, next' },
    'sorry': { artist: 'Justin Bieber', album: 'Purpose' },
    'espresso': { artist: 'Sabrina Carpenter', album: 'Short n Sweet' },
    'downtown': { artist: 'Anitta & J Balvin', album: 'Kisses' },
    'young miko: bzrp music sessions, vol. 58': { artist: 'Bizarrap & Young Miko', album: 'Bzrp Music Sessions' },
    'contigo': { artist: 'Karol G & Tiësto', album: 'Contigo' },
    'love on the brain': { artist: 'Rihanna', album: 'ANTI' },
    'cupido': { artist: 'TINI', album: 'Cupido' },
    'birds of a feather': { artist: 'Billie Eilish', album: 'Hit Me Hard and Soft' },
    's91': { artist: 'KAROL G', album: 'Mañana Será Bonito' },
    'bubalu': { artist: 'KAROL G', album: 'Mañana Será Bonito (Bichota Season)' },
    'yandel 150': { artist: 'Yandel & Feid', album: 'Yandel 150' },
    'cactus': { artist: 'Imagine Dragons', album: 'Cactus' },
    'greedy': { artist: 'Tate McRae', album: 'THINK LATER' },
    'cruel summer': { artist: 'Taylor Swift', album: 'Lover' },
    'shakira: bzrp music sessions, vol. 53': { artist: 'Bizarrap & Shakira', album: 'Bzrp Music Sessions' },
    'mala mía': { artist: 'Maluma', album: 'F.A.M.E.' },
    'position': { artist: 'Ariana Grande', album: 'Positions' },
    'xq te pones así': { artist: 'Nathy Peluso & Tiago PZK', album: 'Xq Te Pones Así' },
    'bebé remix': { artist: 'Camilo & El Alfa', album: 'Bebé (Remix)' },
    'el tiempo': { artist: 'Tainy, Bad Bunny & Rauw Alejandro', album: 'Data' },
    'gata only': { artist: 'FloyyMenor & Cris MJ', album: 'Gata Only' },
    'can i get it': { artist: 'Adele', album: '30' },
    'la llevo al cielo': { artist: 'Chris Jedi & Anuel AA', album: 'La Llevo al Cielo' },
    'ley seca': { artist: 'Jhayco & Feid', album: 'Ley Seca' },
    'hawái': { artist: 'Maluma', album: 'Papi Juancho' },
    'pareja del año': { artist: 'Sebastián Yatra & Myke Towers', album: 'Pareja del Año' },
    'paradise': { artist: 'Coldplay', album: 'Mylo Xyloto' },
    'viva la vida': { artist: 'Coldplay', album: 'Viva la Vida or Death and All His Friends' },
    'something just like this': { artist: 'The Chainsmokers & Coldplay', album: 'Memories...Do Not Open' },
    'the scientist': { artist: 'Coldplay', album: 'A Rush of Blood to the Head' },
    'yellow': { artist: 'Coldplay', album: 'Parachutes' },
    'bad habits': { artist: 'Ed Sheeran', album: '=' },
    'shape of you': { artist: 'Ed Sheeran', album: '÷' },
    'perfect': { artist: 'Ed Sheeran', album: '÷' },
    'watermelon sugar': { artist: 'Harry Styles', album: 'Fine Line' },
    'as it was': { artist: 'Harry Styles', album: 'Harry\'s House' },
    'bad guy': { artist: 'Billie Eilish', album: 'WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?' },
    'happier than ever': { artist: 'Billie Eilish', album: 'Happier Than Ever' },
    'unholy': { artist: 'Sam Smith & Kim Petras', album: 'Gloria' },
    'roses': { artist: 'SAINt JHN', album: 'Ghetto Lenny\'s Love Songs' },
    'stay': { artist: 'The Kid LAROI & Justin Bieber', album: 'F*CK LOVE 3: OVER YOU' },
    'levitating': { artist: 'Dua Lipa', album: 'Future Nostalgia' },
    'don\'t start now': { artist: 'Dua Lipa', album: 'Future Nostalgia' },
    'physical': { artist: 'Dua Lipa', album: 'Future Nostalgia' },
    'montero': { artist: 'Lil Nas X', album: 'MONTERO' },
    'industry baby': { artist: 'Lil Nas X & Jack Harlow', album: 'MONTERO' },
    'drivers license': { artist: 'Olivia Rodrigo', album: 'SOUR' },
    'good 4 u': { artist: 'Olivia Rodrigo', album: 'SOUR' },
    'vampire': { artist: 'Olivia Rodrigo', album: 'GUTS' },
    'positions': { artist: 'Ariana Grande', album: 'Positions' },
    '34+35': { artist: 'Ariana Grande', album: 'Positions' },
    'thank u, next': { artist: 'Ariana Grande', album: 'thank u, next' },
    'tf': { artist: 'KAROL G', album: 'Mañana Será Bonito (Bichota Season)' },
    'qlona': { artist: 'KAROL G & Peso Pluma', album: 'Mañana Será Bonito (Bichota Season)' },
    'mi ex tenía razón': { artist: 'KAROL G', album: 'Mañana Será Bonito (Bichota Season)' },
    'amargura': { artist: 'KAROL G', album: 'Mañana Será Bonito (Bichota Season)' },
    'un beso en madrid': { artist: 'TINI & Alejandro Sanz', album: 'TINI TINI TINI' },
    'miénteme': { artist: 'TINI & María Becerra', album: 'TINI TINI TINI' },
    'bar': { artist: 'TINI & L-Gante', album: 'TINI TINI TINI' },
    'tu me dejaste de querer': { artist: 'C. Tangana, Niño de Elche & La Húngara', album: 'El Madrileño' },
    'telepatía': { artist: 'Kali Uchis', album: 'Sin Miedo (del Amor y Otros Demonios) ∞' },
    'pa mis muchachas': { artist: 'Christina Aguilera, Becky G, Nicki Nicole & Nathy Peluso', album: 'AGUILERA' },
    'don\'t be shy': { artist: 'Tiësto & KAROL G', album: 'Drive' },
    'beggin': { artist: 'Måneskin', album: 'Chosen' },
    'don\'t stop believin\'': { artist: 'Journey', album: 'Escape' },
    'eye of the tiger': { artist: 'Survivor', album: 'Eye of the Tiger' },
    'sweet child o\' mine': { artist: 'Guns N\' Roses', album: 'Appetite for Destruction' },
    'november rain': { artist: 'Guns N\' Roses', album: 'Use Your Illusion I' },
    'toxicity': { artist: 'System of a Down', album: 'Toxicity' },
    'chop suey!': { artist: 'System of a Down', album: 'Toxicity' },
    'numb': { artist: 'Linkin Park', album: 'Meteora' },
    'in the end': { artist: 'Linkin Park', album: 'Hybrid Theory' },
    'crawling': { artist: 'Linkin Park', album: 'Hybrid Theory' },
    'smells like teen spirit': { artist: 'Nirvana', album: 'Nevermind' },
    'come as you are': { artist: 'Nirvana', album: 'Nevermind' },
    'everlong': { artist: 'Foo Fighters', album: 'The Colour and the Shape' },
    'the pretender': { artist: 'Foo Fighters', album: 'Echoes, Silence, Patience & Grace' },
    'seven nation army': { artist: 'The White Stripes', album: 'Elephant' },
    'feel good inc': { artist: 'Gorillaz', album: 'Demon Days' },
    'clint eastwood': { artist: 'Gorillaz', album: 'Gorillaz' }
  };

  // Buscar en la base de datos de manera más flexible
  const titleLower = title.toLowerCase();

  // Primero buscar coincidencia exacta
  if (songDatabase[titleLower]) {
    console.log(`[LOCAL-DB] Coincidencia exacta para "${title}": ${songDatabase[titleLower].artist}`);
    return {
      artist: songDatabase[titleLower].artist,
      album: songDatabase[titleLower].album,
      source: 'local_database'
    };
  }

  // Si no hay coincidencia exacta, buscar coincidencia parcial
  for (const [dbTitle, data] of Object.entries(songDatabase)) {
    if (titleLower.includes(dbTitle) || dbTitle.includes(titleLower)) {
      console.log(`[LOCAL-DB] Coincidencia parcial para "${title}": ${data.artist}`);
      return {
        artist: data.artist,
        album: data.album,
        source: 'local_database'
      };
    }
  }

  // Si no hay coincidencia en la base de datos, intentar analizar el título
  if (title.includes(" - ")) {
    const parts = title.split(" - ");
    if (parts.length === 2) {
      // Normalmente el formato es "Artista - Título"
      const artist = parts[0].trim();
      console.log(`[LOCAL-DB] Artista extraído del título para "${title}": ${artist}`);
      return {
        artist: artist,
        album: '',
        source: 'title_parsing'
      };
    }
  }

  // Si todo falla, intentar con heurísticas de nombres
  const artistNames = Object.values(songDatabase).map(data => data.artist);
  const uniqueArtists = [...new Set(artistNames)];

  // Buscar si algún nombre de artista aparece en el título
  for (const artist of uniqueArtists) {
    if (titleLower.includes(artist.toLowerCase())) {
      console.log(`[LOCAL-DB] Artista encontrado en el título "${title}": ${artist}`);
      return {
        artist: artist,
        album: '',
        source: 'title_artist_match'
      };
    }
  }

  // Si no encontramos nada, devolver null
  console.log(`[LOCAL-DB] No se encontró información para "${title}"`);
  return null;
}

// Función para buscar múltiples tracks en Spotify en paralelo
async function enrichTracksWithSpotifyData(tracks) {
  try {
    console.log(`[SPOTIFY] Enriqueciendo ${tracks.length} tracks con datos de Spotify`);

    // Filtrar sólo los tracks que necesitan datos (sin artista o con artista genérico)
    const tracksToEnrich = tracks.filter(track =>
      !track.artist || track.artist === 'Artista desconocido' || track.artist.trim() === '');

    if (tracksToEnrich.length === 0) {
      console.log('[SPOTIFY] No hay tracks que necesiten enriquecimiento');
      return tracks;
    }

    console.log(`[SPOTIFY] ${tracksToEnrich.length} tracks necesitan información de artista`);

    // Preparar promesas para búsquedas en paralelo (máximo 5 a la vez para no sobrecargar)
    const enrichPromises = tracksToEnrich.map(track =>
      () => searchTrackOnSpotify(track.title, track.artist));

    // Ejecutar en grupos de 5 para no sobrecargar la API
    const results = [];
    for (let i = 0; i < enrichPromises.length; i += 5) {
      const batch = enrichPromises.slice(i, i + 5);
      const batchResults = await Promise.all(batch.map(p => p()));
      results.push(...batchResults);
    }

    // Combinar los resultados con los tracks originales
    return tracks.map((track, index) => {
      // Si el track necesitaba enriquecimiento, buscar su resultado
      if (!track.artist || track.artist === 'Artista desconocido' || track.artist.trim() === '') {
        const trackIndex = tracksToEnrich.findIndex(t => t.title === track.title);
        if (trackIndex >= 0) {
          const spotifyData = results[trackIndex];

          // Si encontramos datos en Spotify o base local, enriquecer el track
          if (spotifyData) {
            // Preservar explícitamente la miniatura original
            const originalThumbnail = track.thumbnail || '';
            const originalCover = track.cover || '';

            // Log de debugging
            console.log(`[SPOTIFY-ENRICH] Datos originales de track "${track.title}": thumbnail=${originalThumbnail}, cover=${originalCover}`);

            // Incluir thumbnail en la respuesta solo si el spotifyData no tiene una
            // o preservar la original si existe
            return {
              ...track,
              artist: spotifyData.artist,
              album: spotifyData.album || track.album || '',
              cover: originalCover || spotifyData.cover || '',
              albumCover: spotifyData.cover || track.albumCover || originalCover || '',
              thumbnail: originalThumbnail || spotifyData.cover || '',  // Preservar la miniatura original
              spotify_id: spotifyData.spotify_id || null,
              data_source: spotifyData.source || 'enriched'
            };
          }
        }
      }

      // Si no necesitaba enriquecimiento o no encontramos datos, devolver el track original
      return track;
    });
  } catch (error) {
    console.error('[SPOTIFY] Error enriqueciendo tracks:', error.message);
    return tracks; // En caso de error, devolver los tracks originales sin cambios
  }
}

// Modificar el endpoint de recomendaciones para usar el enriquecimiento con Spotify
app.get('/api/youtube/recommendations', async (req, res) => {
  try {
    const apiPrefix = PYTHON_API_BASE_URL.endsWith('/api') ? '' : '/api';
    const response = await axios.get(`${PYTHON_API_BASE_URL}${apiPrefix}/recommendations`, {
      params: req.query,
      timeout: 20000 // Aumentar a 20 segundos por complejidad
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error obteniendo recomendaciones:', error);
    res.status(500).json({ error: 'Error obteniendo recomendaciones' });
  }
});

// Verificar si Python API está funcionando y tiene los módulos necesarios
async function checkPythonServiceStatus() {
  try {
    console.log('[YOUTUBE-RECS] Verificando estado de la API de Python...');
    console.log('[YOUTUBE-RECS] PYTHON_API_BASE_URL configurado como:', PYTHON_API_BASE_URL);

    // Verificar si la URL está configurada correctamente
    if (!PYTHON_API_BASE_URL || PYTHON_API_BASE_URL === 'undefined' || !PYTHON_API_BASE_URL.startsWith('http')) {
      console.error('[YOUTUBE-RECS] Error: PYTHON_API_BASE_URL no está definido correctamente:', PYTHON_API_BASE_URL);
      throw new Error('URL de API de Python no configurada correctamente');
    }

    // Hacer una solicitud de prueba simple
    console.log('[YOUTUBE-RECS] Realizando solicitud de prueba a la API de Python...');
    const testResponse = await axios.get(`${PYTHON_API_BASE_URL}/api/search`, {
      params: {
        query: 'test',
        filter: 'songs',
        limit: 1
      },
      timeout: 10000
    });

    if (testResponse.status === 200) {
      console.log('[YOUTUBE-RECS] ✅ API de Python funcionando correctamente');
        return true;
      } else {
      console.error('[YOUTUBE-RECS] ❌ Error en respuesta de API de Python:', testResponse.status);
      return false;
    }
  } catch (error) {
    console.error('[YOUTUBE-RECS] ❌ Error verificando API de Python:', error.message);
    return false;
  }
}

// Función para generar tracks de fallback
function getFallbackTracks(limit = 25, options = {}) {
  // Extraer parámetros, si están disponibles
  const { seedArtist, seedTrack } = options;

  console.log(`[YOUTUBE-RECS] Generando ${limit} tracks de fallback`,
              seedArtist ? `para artista: ${seedArtist}` : '',
              seedTrack ? `y canción: ${seedTrack}` : '');

  // Usar el artista de la semilla si está disponible, o artistas genéricos si no
  const baseArtistName = seedArtist || '';

  const genres = ['Pop', 'Rock', 'Hip Hop', 'Electrónica', 'Latina', 'R&B', 'Jazz', 'Clásica'];
  const fallbackArtists = [
    `${baseArtistName}`,
    'Artista Similar',
    'Cantante Famoso',
    'Grupo Musical',
    'DJ Internacional',
    'Banda Famosa'
  ].filter(a => a.trim() !== ''); // Eliminar entradas vacías

  // Si no tenemos artistas, usar genéricos
  const artists = fallbackArtists.length > 0 ? fallbackArtists : [
    'Artista Popular', 'Cantante Famoso', 'Grupo Musical', 'DJ Internacional', 'Banda Famosa'
  ];

  // Imágenes de muestra para las canciones
  const trackImages = [
    'https://i.scdn.co/image/ab67616d0000b2737b9e5a9d697bcb8bf86a83b4',
    'https://i.scdn.co/image/ab67616d0000b273450a500a9eef89fbac8a85ff',
    'https://i.scdn.co/image/ab67616d0000b273e8107e6d9214baa81bb79bba',
    'https://i.scdn.co/image/ab67616d0000b273814456ecfe8f73373a8b147c',
    'https://i.scdn.co/image/ab67616d0000b2731f4752e83c0cf31fb4e10a12',
    'https://i.scdn.co/image/ab67616d0000b273419950fdf75f95ae50936b0a'
  ];

  // Función para generar nombres de canciones basados en la semilla si está disponible
  function generateTrackName(index, genre) {
    if (seedTrack) {
      // Si hay una canción semilla, generar nombres relacionados
      const variations = [
        `${seedTrack} (Remix)`,
        `${seedTrack} (Versión Alternativa)`,
        `Como ${seedTrack}`,
        `Inspirado en ${seedTrack}`,
        `${seedTrack} (Acústica)`,
        `${seedTrack} 2.0`,
        `Similar a ${seedTrack}`,
        `${seedTrack} (Live)`,
        `Basado en ${seedTrack}`,
        `${genre} como ${seedTrack}`
      ];
      return variations[index % variations.length];
    } else {
      // Sin canción semilla, usar géneros
      return `${genre} Track ${index + 1}`;
    }
  }

  // Timestamp para ID único
  const timestamp = Date.now();

  return Array.from({ length: limit }, (_, i) => {
    const genre = genres[i % genres.length];
    const artist = artists[i % artists.length];
    const imageUrl = trackImages[i % trackImages.length];

    return {
      id: `fallback_${timestamp}_${i}`,
      title: generateTrackName(i, genre),
      artist: `${artist} ${Math.floor(i / artists.length) + 1}`,
      thumbnail: imageUrl,
      cover: imageUrl,
      duration: 180000 + (i * 10000), // Entre 3 y 6 minutos
      source: 'fallback',
      // Agregar información de origen para mejor depuración
      fallbackInfo: {
        generatedFor: seedArtist ? `artist:${seedArtist}` : (seedTrack ? `track:${seedTrack}` : 'generic'),
        timestamp: new Date().toISOString()
      }
    };
  });
}

// Nuevo endpoint para obtener recomendaciones por géneros
app.get('/api/youtube/recommendations-by-genres', async (req, res) => {
  try {
    const apiPrefix = PYTHON_API_BASE_URL.endsWith('/api') ? '' : '/api';
    const response = await axios.get(`${PYTHON_API_BASE_URL}${apiPrefix}/recommendations-by-genres`, {
      params: req.query,
      timeout: 20000
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error obteniendo recomendaciones por géneros:', error);
    res.status(500).json({ error: 'Error obteniendo recomendaciones por géneros' });
  }
});

// Nuevo endpoint para obtener artistas populares
app.get('/api/youtube/top-artists', async (req, res) => {
  try {
    const apiPrefix = PYTHON_API_BASE_URL.endsWith('/api') ? '' : '/api';
    const response = await axios.get(`${PYTHON_API_BASE_URL}${apiPrefix}/top-artists`, {
      params: req.query,
      timeout: 15000
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error obteniendo top artistas:', error);
    res.status(500).json({ error: 'Error obteniendo top artistas' });
  }
});

app.get('/api/youtube/new-releases', async (req, res) => {
  try {
    const limit = req.query.limit || 20;
    const region = req.query.region || 'ES'; // Usar España como región por defecto
    console.log(`Obteniendo nuevos lanzamientos de YouTube Music con límite ${limit} para región ${region}`);
    const response = await axios.get(`${PYTHON_API_BASE_URL}${apiPrefix}/new-releases?limit=${limit}&region=${region}`);
    res.json(response.data);
  } catch (error) {
    console.error('Error al obtener nuevos lanzamientos de YouTube Music:', error);
    res.status(500).json({ error: 'Error al obtener nuevos lanzamientos' });
  }
});

app.get('/api/youtube/artists-by-genre', async (req, res) => {
  try {
    const { genre, limit } = req.query;
    const region = req.query.region || 'US'; // Usar US como región por defecto (mejor compatibilidad)
    const userLanguage = req.query.language || 'en'; // Usar inglés como idioma predeterminado para mejor compatibilidad

    console.log(`[GENRE-API] NUEVA SOLICITUD RECIBIDA: género=${genre}, límite=${limit}, región=${region}, idioma=${userLanguage}`);

    if (!genre) {
      console.warn('[GENRE-API] No se proporcionó género en la solicitud');
      return res.status(400).json({ error: 'Se requiere especificar un género' });
    }

    // Lista de idiomas soportados por YouTube Music
    const supportedLanguages = ['ja', 'en', 'de', 'zh_CN', 'fr', 'ur', 'ko', 'hi', 'ru', 'nl', 'es', 'ar', 'pt', 'zh_TW', 'tr', 'it'];

    // Asegurar que estamos usando un idioma soportado
    const finalLanguage = supportedLanguages.includes(userLanguage) ? userLanguage : 'en';

    console.log(`[GENRE-API] Obteniendo artistas para género: ${genre}`);

    // Añadir un parámetro timestamp para evitar caché
    const startTime = Date.now();

    try {
      // Comprobar primero si el servicio Python está disponible
      const pythonStatus = await axios.get(`${PYTHON_API_BASE_URL}${apiPrefix}/search`, {
        params: {
          query: 'test',
          limit: 1,
          language: finalLanguage
        },
        timeout: 3000
      })
        .then(() => {
          console.log('[GENRE-API] Servicio Python confirmado disponible');
          return true;
        })
        .catch((error) => {
          console.error('[GENRE-API] ¡Servicio Python no responde!:', error.message);
          return false;
        });

      if (!pythonStatus) {
        console.error('[GENRE-API] No se puede contactar al servicio Python, devolviendo fallback');
        const fallbackArtists = getFallbackArtists(genre, limit);
        return res.json({
          success: false,
          message: "Error: Servicio Python no disponible",
          details: {
            total: fallbackArtists.length,
            real: 0,
            fallback: fallbackArtists.length,
            genre,
            language: finalLanguage
          },
          artists: fallbackArtists
        });
      }

      // Si llegamos aquí, el servicio Python está disponible
      console.log(`[GENRE-API] Enviando solicitud real a Python - Género: ${genre}, Idioma: ${finalLanguage}`);

      // Desactivamos el caché añadiendo un timestamp
      const apiPrefix = PYTHON_API_BASE_URL.endsWith('/api') ? '' : '/api';
      const response = await axios.get(`${PYTHON_API_BASE_URL}${apiPrefix}/artists-by-genre`, {
        params: {
          genre,
          limit,
          region,
          language: finalLanguage,
          _t: Date.now() // Para evitar caché
        },
        timeout: 15000 // Aumentar el timeout a 15 segundos para dar tiempo suficiente
      });

      const elapsedTime = Date.now() - startTime;
      console.log(`[GENRE-API] Respuesta recibida en ${elapsedTime}ms`);

      // Verificar que realmente tenemos datos
      if (Array.isArray(response.data) && response.data.length > 0) {
        console.log(`[GENRE-API] Datos recibidos: ${response.data.length} artistas`);

        // Validar la calidad de los artistas recibidos
        const validArtists = response.data.filter(artist =>
          artist && artist.images && artist.images.length > 0 && artist.images[0].url &&
          !artist.id.startsWith('fallback-') // Excluir artistas fallback que pudiera enviar Python
        );

        if (validArtists.length > 0) {
          console.log(`[GENRE-API] Artistas válidos obtenidos: ${validArtists.length}`);

          // Añadir información de que son artistas reales
          const enhancedArtists = validArtists.map(artist => ({
            ...artist,
            fromSearch: true,
            source: artist.source || 'youtube'
          }));

          // Devolver los artistas en el formato estructurado que funciona en la prueba
          return res.json({
            success: true,
            message: `${enhancedArtists.length} artistas encontrados para el género ${genre}`,
            details: {
              total: enhancedArtists.length,
              real: enhancedArtists.length,
              fallback: 0,
              genre,
              language: finalLanguage
            },
            artists: enhancedArtists
          });
        } else {
          console.warn(`[GENRE-API] No hay artistas válidos con imágenes o solo hay fallbacks`);
          // Solo si no hay artistas válidos, devolvemos fallback
          const fallbackArtists = getFallbackArtists(genre, limit);
          return res.json({
            success: false,
            message: "No se encontraron artistas válidos",
            details: {
              total: fallbackArtists.length,
              real: 0,
              fallback: fallbackArtists.length,
              genre,
              language: finalLanguage
            },
            artists: fallbackArtists
          });
        }
      } else {
        console.warn(`[GENRE-API] El servidor Python devolvió un array vacío o datos inválidos`);
        // Solo si no hay datos, devolvemos fallback
        const fallbackArtists = getFallbackArtists(genre, limit);
        return res.json({
          success: false,
          message: "El servidor Python devolvió datos inválidos",
          details: {
            total: fallbackArtists.length,
            real: 0,
            fallback: fallbackArtists.length,
            genre,
            language: finalLanguage
          },
          artists: fallbackArtists
        });
      }
    } catch (apiError) {
      console.error('[GENRE-API] Error llamando a la API de Python:', apiError.message);

      // Solo en caso de error real, mostrar detalles y usar fallback
      if (apiError.response) {
        console.error('[GENRE-API] Detalles:', {
          status: apiError.response.status,
          data: apiError.response.data
        });
      }

      // Si el error es sobre idioma no soportado, intentar con inglés
      if (finalLanguage !== 'en' && apiError.message.includes('Language not supported')) {
        console.log('[GENRE-API] Error de idioma. Reintentando con inglés...');
        try {
          const apiPrefix = PYTHON_API_BASE_URL.endsWith('/api') ? '' : '/api';
          const retryResponse = await axios.get(`${PYTHON_API_BASE_URL}/artists-by-genre`, {
            params: {
              genre,
              limit,
              region,
              language: 'en',
              _t: Date.now() // Para evitar caché
            },
            timeout: 15000
          });

          if (Array.isArray(retryResponse.data) && retryResponse.data.length > 0) {
            console.log(`[GENRE-API] Éxito en segundo intento con inglés: ${retryResponse.data.length} artistas`);

            // Añadir información de que son artistas reales
            const enhancedArtists = retryResponse.data.map(artist => ({
              ...artist,
              fromSearch: true,
              source: artist.source || 'youtube'
            }));

            return res.json({
              success: true,
              message: `${enhancedArtists.length} artistas encontrados con idioma alternativo`,
              details: {
                total: enhancedArtists.length,
                real: enhancedArtists.length,
                fallback: 0,
                genre,
                language: 'en' // Usar inglés como idioma alternativo
              },
              artists: enhancedArtists
            });
          } else {
            const fallbackArtists = getFallbackArtists(genre, limit);
            return res.json({
              success: false,
              message: "Error de idioma e intento fallido con idioma alternativo",
              details: {
                total: fallbackArtists.length,
                real: 0,
                fallback: fallbackArtists.length,
                genre,
                language: 'en'
              },
              artists: fallbackArtists
            });
          }
        } catch (retryError) {
          console.error('[GENRE-API] Error en segundo intento:', retryError.message);
          const fallbackArtists = getFallbackArtists(genre, limit);
          return res.json({
            success: false,
            message: "Error en ambos intentos con idiomas",
            details: {
              total: fallbackArtists.length,
              real: 0,
              fallback: fallbackArtists.length,
              genre,
              language: 'en'
            },
            artists: fallbackArtists
          });
        }
      } else {
        const fallbackArtists = getFallbackArtists(genre, limit);
        return res.json({
          success: false,
          message: `Error en API Python: ${apiError.message}`,
          details: {
            total: fallbackArtists.length,
            real: 0,
            fallback: fallbackArtists.length,
            genre,
            language: finalLanguage
          },
          artists: fallbackArtists
        });
      }
    }
  } catch (error) {
    console.error('[GENRE-API] Error general:', error.message);
    const fallbackArtists = getFallbackArtists(genre || 'general', limit || 10);
    return res.status(500).json({
      success: false,
      message: `Error general: ${error.message}`,
      details: {
        total: fallbackArtists.length,
        real: 0,
        fallback: fallbackArtists.length,
        genre: genre || 'general',
        language: 'en'
      },
      artists: fallbackArtists
    });
  }
});

// Función auxiliar para generar artistas de respaldo
function getFallbackArtists(genre, limit) {
  console.log(`[GENRE-API] Generando artistas FALLBACK para género: ${genre}`);

  const fallbackArtists = [
    {
      id: 'fallback-1',
      name: 'Arctic Monkeys [FB]',
      description: 'Banda de rock británica (Fallback)',
      images: [{ url: '/placeholder-artist.jpg' }],
      genres: [genre || 'rock'],
      popularity: 80,
      source: 'fallback',
      isFallback: true
    },
    {
      id: 'fallback-2',
      name: 'Dua Lipa [FB]',
      description: 'Artista pop (Fallback)',
      images: [{ url: '/placeholder-artist.jpg' }],
      genres: [genre || 'pop'],
      popularity: 85,
      source: 'fallback',
      isFallback: true
    },
    {
      id: 'fallback-3',
      name: 'Bad Bunny [FB]',
      description: 'Artista urbano (Fallback)',
      images: [{ url: '/placeholder-artist.jpg' }],
      genres: [genre || 'urbano'],
      popularity: 90,
      source: 'fallback',
      isFallback: true
    },
    {
      id: 'fallback-4',
      name: 'Billie Eilish [FB]',
      description: 'Cantante y compositora (Fallback)',
      images: [{ url: '/placeholder-artist.jpg' }],
      genres: [genre || 'pop'],
      popularity: 85,
      source: 'fallback',
      isFallback: true
    },
    {
      id: 'fallback-5',
      name: 'The Weeknd [FB]',
      description: 'Artista R&B (Fallback)',
      images: [{ url: '/placeholder-artist.jpg' }],
      genres: [genre || 'r&b'],
      popularity: 88,
      source: 'fallback',
      isFallback: true
    }
  ];

  return fallbackArtists.slice(0, limit || 5);
}

// Nuevo endpoint para ping explícito
app.get('/api/youtube/ping', (req, res) => {
  // Intentar conectar con el servicio Python usando una ruta que sabemos que existe
  console.log('[Server] Verificando disponibilidad del servicio Python...');

  // Obtener el idioma del navegador o usar español como predeterminado
  const userLanguage = req.query.language || 'es';

  // Intentar con la ruta /search que sabemos que existe en el servicio Python
  axios.get('http://localhost:5000/api/search', {
    params: {
      query: 'test',
      limit: 1,
      language: userLanguage
    },
    timeout: 3000
  })
    .then((response) => {
      console.log('[Server] Servicio Python responde correctamente');
      res.json({
        status: 'ok',
        message: 'YouTube Music service is running',
        response_type: typeof response.data,
        language: userLanguage
      });
    })
    .catch(error => {
      console.warn('[Server] No se pudo conectar con el servicio Python de YouTube Music:', error.message);
      if (error.response) {
        console.warn('[Server] Detalles:', {
          status: error.response.status,
          statusText: error.response.statusText,
          headers: error.response.headers
        });
      }

      // Responder con status pero indicando que el servicio no está disponible
      res.status(200).json({
        status: 'warning',
        message: 'YouTube Music service may not be available',
        error: error.message,
        language: userLanguage
      });
    });
});

// Estado del servidor - Mejorado para verificar conectividad con Python
app.get('/api/status', async (req, res) => {
  try {
    console.log('[Server] Verificando estado general de los servicios');

    // Obtener el idioma del navegador o usar español como predeterminado
    const userLanguage = req.query.language || 'es';

    // Intentar con la ruta /search que sabemos que existe en el servicio Python
    const apiPrefix = PYTHON_API_BASE_URL.endsWith('/api') ? '' : '/api';
    const pythonStatus = await axios.get(`${PYTHON_API_BASE_URL}${apiPrefix}/search`, {
      params: {
        query: 'test',
        limit: 1,
        language: userLanguage
      },
      timeout: 3000
    })
      .then(() => {
        console.log('[Server] Servicio Python está activo');
        return true;
      })
      .catch((error) => {
        console.warn('[Server] Servicio Python no responde:', error.message);
        return false;
      });

    res.json({
      status: 'ok',
      services: {
        node_server: true,
        youtube_music: pythonStatus
      },
      language: userLanguage,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
  res.json({
    status: 'ok',
    services: {
        node_server: true,
        youtube_music: false
      },
      error: error.message,
      language: req.query.language || 'es',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint de prueba para comprobar directamente la API de artistas
app.get('/api/youtube/test-artists-endpoint', async (req, res) => {
  const genre = req.query.genre || 'rock';
  const limit = req.query.limit || 10;
  const language = req.query.language || 'es';

  try {
    console.log(`[TEST-API] Iniciando prueba directa para género ${genre} con idioma ${language}`);

    // 1. Verificar que el servicio Python está activo
    console.log('[TEST-API] Paso 1: Verificando servicio Python');
    const pingResponse = await axios.get(`${PYTHON_API_BASE_URL}${apiPrefix}/search`, {
      params: {
        query: 'test',
        limit: 1,
        language
      },
      timeout: 3000
    });

    console.log('[TEST-API] Servicio Python activo y respondiendo correctamente');

    // 2. Hacer llamada directa a Python (sin caché)
    console.log('[TEST-API] Paso 2: Llamando directamente a la API Python para artistas por género');
    const timestamp = Date.now();
    const pythonResponse = await axios.get(`${PYTHON_API_BASE_URL}${apiPrefix}/artists-by-genre`, {
      params: {
        genre,
        limit,
        language,
        _t: timestamp // Para evitar caché
      },
      timeout: 15000
    });

    // 3. Verificar respuesta
    if (Array.isArray(pythonResponse.data)) {
      console.log(`[TEST-API] Éxito! Recibidos ${pythonResponse.data.length} artistas directamente de Python`);

      const realArtists = pythonResponse.data.filter(a => a.source === 'youtube' || a.fromSearch);
      const fallbackArtists = pythonResponse.data.filter(a => a.source === 'fallback' || a.isFallback);

      console.log(`[TEST-API] Artistas reales: ${realArtists.length}, Fallbacks: ${fallbackArtists.length}`);

      // Devolver resultados del test
      res.json({
        success: true,
        message: `Prueba exitosa - Recibidos ${pythonResponse.data.length} artistas`,
        details: {
          total: pythonResponse.data.length,
          real: realArtists.length,
          fallback: fallbackArtists.length,
          genre,
          language
        },
        artists: pythonResponse.data.slice(0, 5) // Solo devolver los primeros 5 para no sobrecargar la respuesta
      });
    } else {
      console.warn(`[TEST-API] Python devolvió una respuesta no esperada:`, typeof pythonResponse.data);
      res.json({
        success: false,
        message: 'Respuesta inválida del servidor Python',
        response: pythonResponse.data
      });
    }
  } catch (error) {
    console.error('[TEST-API] Error durante la prueba:', error.message);

    // Intentar obtener más información del error
    let errorDetails = {
      message: error.message
    };

    if (error.response) {
      errorDetails.status = error.response.status;
      errorDetails.data = error.response.data;
    }

    res.status(500).json({
      success: false,
      message: 'Error durante la prueba',
      error: errorDetails
    });
  }
});

// Ruta para buscar playlists/álbumes de YouTube por nombre
app.get('/api/youtube-album-search', async (req, res) => {
  try {
    const { albumName } = req.query;

    if (!albumName) {
      return res.status(400).json({ error: 'Se requiere el parámetro albumName' });
    }

    console.log(`[YouTube Album Search] Buscando: ${albumName}`);

    const API_KEY = process.env.YOUTUBE_API_KEY;
    if (!API_KEY) {
      console.warn('[YouTube Album Search] API_KEY de YouTube no configurada');
      return res.status(500).json({ error: 'API de YouTube no configurada' });
    }

    const { google } = require('googleapis');
    const youtube = google.youtube('v3');

    // Buscar playlist/álbum por nombre
    const searchResponse = await youtube.search.list({
      key: API_KEY,
      part: 'snippet',
      q: `${albumName} album official`,
      type: 'playlist',
      maxResults: 5
    });

    if (searchResponse.data.items.length === 0) {
      console.log('[YouTube Album Search] No se encontraron álbumes');
      return res.json({ results: [] });
    }

    // Procesar resultados
    const albums = searchResponse.data.items.map(item => ({
      id: item.id.playlistId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      description: item.snippet.description,
      publishedAt: item.snippet.publishedAt,
      thumbnails: item.snippet.thumbnails
    }));

    console.log(`[YouTube Album Search] Encontrados ${albums.length} álbumes`);

    return res.json({ results: albums });

  } catch (error) {
    console.error('[YouTube Album Search] Error:', error.message);
    return res.status(500).json({ error: 'Error al buscar álbumes', details: error.message });
  }
});

// Ruta para obtener detalles de un álbum/playlist específico
app.get('/api/youtube-album', async (req, res) => {
  try {
    const { albumId } = req.query;

    if (!albumId) {
      return res.status(400).json({ error: 'Se requiere el parámetro albumId' });
    }

    console.log(`[YouTube Album] Obteniendo álbum: ${albumId}`);

    // Verificar si debemos obtener los datos de la API de Python
    const pythonApiUrl = process.env.PYTHON_API_URL || PYTHON_API_BASE_URL;

    try {
      // Verificar si el servicio de Python está disponible
      await axios.get(`${pythonApiUrl}/status`, { timeout: 2000 });

      // Obtenemos datos detallados del álbum desde la API de YouTube Music (Python)
      const response = await axios.get(`${pythonApiUrl}/api/playlist`, {
        params: { playlistId: albumId },
        timeout: 10000
      });

      console.log(`[YouTube Album] Datos obtenidos correctamente de YTMusic API`);
      return res.json(response.data);

    } catch (pythonError) {
      console.error('[YouTube Album] Error al obtener datos de YTMusic API:', pythonError.message);

      // Si el servicio de Python no está disponible, enviamos un error
      return res.status(503).json({
        error: 'Servicio de YouTube Music API no disponible',
        message: 'No se pudieron obtener los detalles del álbum'
      });
    }

  } catch (error) {
    console.error('[YouTube Album] Error:', error.message);
    return res.status(500).json({ error: 'Error al obtener detalles del álbum', details: error.message });
  }
});

// Endpoint para obtener playlists destacadas en modo demo
app.get('/api/demo/playlists', (req, res) => {
  try {
    console.log('[Node Server] Obteniendo playlists destacadas en modo demo');
    const { limit = 10, language = 'es' } = req.query;

    // Obtener playlists usando la función optimizada
    const playlists = getDemoPlaylists(language, parseInt(limit));

    console.log(`[Node Server] Se encontraron ${playlists.length} playlists destacadas`);
    res.json(playlists);
  } catch (error) {
    console.error('Error en endpoint de playlists:', error);
    res.status(500).json({ error: 'Error obteniendo playlists' });
  }
});

// Endpoint para obtener detalles de una playlist en modo demo
app.get('/api/demo/playlist/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { language = 'es' } = req.query;

    console.log(`[Node Server] Obteniendo detalles de playlist ${id} en idioma ${language}`);

    // Obtener detalles de la playlist usando la función optimizada por artista
    const playlist = getPlaylistDetailsByArtist(id, language);

    if (playlist) {
      console.log(`[Node Server] Playlist ${id} encontrada con ${playlist.tracks?.items?.length || 0} canciones`);
      res.json(playlist);
    } else {
      console.log(`[Node Server] Playlist ${id} no encontrada`);
      res.status(404).json({ error: 'Playlist no encontrada' });
    }
  } catch (error) {
    console.error(`Error obteniendo detalles de playlist ${req.params.id}:`, error);
    res.status(500).json({ error: 'Error obteniendo detalles de playlist' });
  }
});

// Endpoint para obtener detalles de un álbum en modo demo
app.get('/api/demo/album/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { language = 'es' } = req.query;

    console.log(`[Node Server] Obteniendo detalles de álbum ${id} en idioma ${language}`);

    // Primero intentamos obtener datos del almacenamiento local
    const localAlbum = getPlaylistDetailsByArtist(id, language);

    if (localAlbum) {
      console.log(`[Node Server] Álbum ${id} encontrado localmente con ${localAlbum.tracks?.items?.length || 0} canciones`);
      return res.json(localAlbum);
    }

    // Si no encontramos datos locales, intentamos obtenerlos directamente de Spotify
    console.log(`[Node Server] Álbum ${id} no encontrado localmente. Intentando obtener de Spotify...`);

    try {
      // Verificar si tenemos credenciales configuradas
      if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
        console.error('[Node Server] Credenciales de Spotify no configuradas');
        return res.status(404).json({
          error: 'Álbum no encontrado y credenciales de Spotify no configuradas'
        });
      }

      // Obtener datos de Spotify
      const spotifyAlbum = await getAlbumDetailsFromSpotify(id);

      // Obtener artista principal
      const mainArtist = spotifyAlbum.artists && spotifyAlbum.artists.length > 0
        ? spotifyAlbum.artists[0].name
        : 'Artista Desconocido';

      // Obtener todos los nombres de artistas para la descripción
      const artistNames = spotifyAlbum.artists
        ? spotifyAlbum.artists.map(artist => artist.name).join(', ')
        : 'Artista Desconocido';

      // Formatear fecha de lanzamiento
      const releaseDate = spotifyAlbum.release_date || 'Fecha desconocida';

      // Descripción mejorada
      const description = `Álbum de ${artistNames} - ${releaseDate}`;

      // Transformar el formato al esperado por el cliente, con campos adicionales
      const transformedAlbum = {
        id: spotifyAlbum.id,
        name: spotifyAlbum.name,
        description: description,
        images: spotifyAlbum.images || [],
        owner: {
          display_name: mainArtist,
          id: spotifyAlbum.artists[0]?.id || 'unknown'
        },
        followers: { total: spotifyAlbum.popularity * 1000 || 5000 }, // Estimación basada en popularidad

        // Este es el formato específico que espera el componente de la página del álbum
        tracks: {
          total: spotifyAlbum.total_tracks || 0,

          // El frontend espera este formato exacto para las canciones
          items: spotifyAlbum.tracks?.items?.map((track, index) => {
            return {
              id: track.id,
              name: track.name,  // Este es el campo principal que necesita la página
              duration_ms: track.duration_ms,
              explicit: track.explicit || false,
              artists: track.artists?.map(artist => ({
                id: artist.id,
                name: artist.name,
                uri: artist.uri
              })) || spotifyAlbum.artists,
              // Estos campos son importantes para la reproducción
              uri: track.uri,
              href: track.href,
              external_urls: track.external_urls,

              // Estos campos adicionales se mostrarán en la UI
              track_number: track.track_number || index + 1,
              disc_number: track.disc_number || 1,
              preview_url: track.preview_url || null,

              // Esto es para que el cliente pueda recuperar los datos
              track: {
                id: track.id,
                name: track.name,
                popularity: track.popularity || 50,
                duration_ms: track.duration_ms,
                explicit: track.explicit || false,
                artists: track.artists?.map(artist => ({
                  id: artist.id,
                  name: artist.name,
                  uri: artist.uri
                })) || spotifyAlbum.artists,
                album: {
                  id: spotifyAlbum.id,
                  name: spotifyAlbum.name,
                  images: spotifyAlbum.images,
                  release_date: releaseDate,
                  artists: spotifyAlbum.artists
                },
                uri: track.uri,
                href: track.href,
                external_urls: track.external_urls
              }
            };
          }) || []
        },
        // Información adicional para el panel de detalles
        mainArtist: mainArtist,
        artistName: mainArtist, // Para compatibilidad
        artists: spotifyAlbum.artists || [],
        albumType: spotifyAlbum.album_type || 'album',
        // Múltiples formatos de fecha para garantizar que la UI pueda mostrarla
        releaseDate: releaseDate,
        release_date: spotifyAlbum.release_date || 'Fecha desconocida', // Campo original sin procesar
        release_date_precision: spotifyAlbum.release_date_precision || 'day',
        fecha: releaseDate, // Campo adicional en español
        fechaLanzamiento: releaseDate, // Alternativa en español
        label: spotifyAlbum.label || 'Sello desconocido',
        // Quitamos el campo genres ya que puede ser impreciso o estar vacío
        // genres: spotifyAlbum.genres || [],
        popularity: spotifyAlbum.popularity || 50,
        copyrights: spotifyAlbum.copyrights || [],
        external_urls: spotifyAlbum.external_urls || { spotify: '' },
        // Campos específicos para la visualización en la UI
        type: 'album',
        available_markets: spotifyAlbum.available_markets || [],
        total_tracks: spotifyAlbum.total_tracks || 0,
        uri: spotifyAlbum.uri
      };

      // Log detallado de la estructura transformada
      console.log('[Node Server] Estructura transformada del álbum:');
      console.log(JSON.stringify({
        id: transformedAlbum.id,
        name: transformedAlbum.name,
        release_date: transformedAlbum.release_date,
        releaseDate: transformedAlbum.releaseDate,
        total_tracks: transformedAlbum.total_tracks,
        mainArtist: transformedAlbum.mainArtist,
        tracks_count: transformedAlbum.tracks?.items?.length,
        tracks_sample: transformedAlbum.tracks?.items?.slice(0, 2)?.map(item => ({
          added_at: item.added_at,
          track_id: item.track?.id,
          track_name: item.track?.name,
          duration_ms: item.track?.duration_ms
        }))
      }, null, 2));

      console.log(`[Node Server] Álbum ${id} obtenido de Spotify con ${transformedAlbum.tracks.items.length} canciones`);
      return res.json(transformedAlbum);

    } catch (spotifyError) {
      console.error(`[Node Server] Error al obtener álbum ${id} de Spotify:`, spotifyError.message);

      // Si hay un error con Spotify también, devolver un 404
      return res.status(404).json({
        error: 'Álbum no encontrado',
        details: 'No se pudo recuperar de fuentes locales ni de Spotify'
      });
    }
  } catch (error) {
    console.error(`Error obteniendo detalles de álbum ${req.params.id}:`, error);
    res.status(500).json({ error: 'Error obteniendo detalles de álbum', details: error.message });
  }
});

// Historial de búsquedas recientes en memoria
const searchHistory = new Set();
const MAX_HISTORY_ITEMS = 50;

// Credenciales para la API de Spotify (Client Credentials Flow)
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';

// Caché para token de Spotify
let spotifyTokenCache = {
  token: null,
  expiresAt: 0
};

// Función para obtener token de Spotify usando Client Credentials Flow
async function getSpotifyClientToken() {
  try {
    // Verificar si tenemos un token válido en caché
    const now = Date.now();
    if (spotifyTokenCache.token && spotifyTokenCache.expiresAt > now) {
      console.log('[Spotify API] Usando token en caché');
      return spotifyTokenCache.token;
    }

    console.log('[Spotify API] Obteniendo nuevo token de acceso');
    const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');

    const response = await axios.post('https://accounts.spotify.com/api/token', params, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Guardar token en caché
    const expiresIn = response.data.expires_in || 3600; // Tiempo en segundos
    spotifyTokenCache.token = response.data.access_token;
    spotifyTokenCache.expiresAt = now + (expiresIn * 1000); // Convertir a milisegundos

    return spotifyTokenCache.token;
  } catch (error) {
    console.error('[Spotify API] Error al obtener token:', error.message);
    throw error;
  }
}

// Función para obtener detalles de un álbum directamente de Spotify
async function getAlbumDetailsFromSpotify(albumId) {
  try {
    const token = await getSpotifyClientToken();

    console.log(`[Spotify API] Obteniendo detalles del álbum: ${albumId}`);
    const response = await axios.get(`https://api.spotify.com/v1/albums/${albumId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    // Log detallado de la respuesta de Spotify
    console.log('[Spotify API] Datos originales del álbum:');
    console.log(JSON.stringify({
      id: response.data.id,
      name: response.data.name,
      release_date: response.data.release_date,
      release_date_precision: response.data.release_date_precision,
      artists: response.data.artists.map(a => ({ id: a.id, name: a.name })),
      total_tracks: response.data.total_tracks,
      tracks_sample: response.data.tracks?.items?.slice(0, 2)?.map(t => ({
        id: t.id,
        name: t.name,
        duration_ms: t.duration_ms
      }))
    }, null, 2));

    return response.data;
  } catch (error) {
    console.error('[Spotify API] Error al obtener detalles del álbum:', error.message);
    throw error;
  }
}

// Función para añadir un término al historial
function addToSearchHistory(term) {
  // Normalizar el término (minúsculas, sin espacios adicionales)
  const normalizedTerm = term.toLowerCase().trim();

  // Solo añadir si tiene al menos 3 caracteres y no es una URL
  if (normalizedTerm.length >= 3 && !normalizedTerm.includes('http')) {
    // Si ya existe, elimínalo para añadirlo al principio (más reciente)
    if (searchHistory.has(normalizedTerm)) {
      searchHistory.delete(normalizedTerm);
    }

    // Añadir al principio
    searchHistory.add(normalizedTerm);

    // Mantener el límite de elementos
    if (searchHistory.size > MAX_HISTORY_ITEMS) {
      // Eliminar el elemento más antiguo
      const oldest = Array.from(searchHistory)[0];
      searchHistory.delete(oldest);
    }
  }
}

// Endpoint para sugerencias de búsqueda (autocompletado)
app.get('/api/youtube/suggest', (req, res) => {
  try {
    const { query = '', limit = 5 } = req.query;

    if (!query || query.length < 2) {
      return res.json([]);
    }

    console.log(`[API] Buscando sugerencias para: "${query}"`);

    // Base de datos de sugerencias populares (artistas, géneros, etc. relevantes a 2025)
    // Esta lista se podría expandir y guardar en una base de datos real
    const suggestions = [
      // Artistas populares actuales (2025)
      "Bad Bunny", "Taylor Swift", "BTS", "The Weeknd", "Billie Eilish",
      "Olivia Rodrigo", "Ariana Grande", "Dua Lipa", "Drake", "Adele",
      "Harry Styles", "Karol G", "Justin Bieber", "Rosalía", "Post Malone",
      "J Balvin", "Miley Cyrus", "Rauw Alejandro", "Feid", "Peso Pluma",
      "SZA", "Cardi B", "Travis Scott", "Beyoncé", "Doja Cat",
      "Imagine Dragons", "Blackpink", "Kendrick Lamar", "Bruno Mars", "Coldplay",
      "Young Miko", "Quevedo", "Arctic Monkeys", "Sabrina Carpenter", "Daddy Yankee",

      // Géneros populares
      "Pop", "Hip Hop", "Rock", "R&B", "Reggaeton", "K-pop", "Latin", "EDM",
      "Trap", "Country", "Jazz", "Alternative", "Indie", "Classical", "Metal",
      "Afrobeats", "Amapiano", "Drill", "Phonk", "Hyperpop", "Neosoul",

      // Términos de búsqueda más específicos
      "Top hits 2025", "New releases", "Club music", "Workout playlist",
      "Trending songs", "Charts 2025", "Summer hits", "Viral TikTok songs",
      "Gaming music", "Party hits", "Romantic songs", "Chill music",
      "Focus playlist", "Acoustic covers", "Remix 2025", "Viral", "Top 50"
    ];

    // Combinar con el historial de búsqueda
    const allSuggestions = [...suggestions, ...Array.from(searchHistory)];

    // Filtrar sugerencias que coincidan con la consulta (ignorando mayúsculas/minúsculas)
    const queryLower = query.toLowerCase();
    let matches = allSuggestions.filter(item =>
      item.toLowerCase().includes(queryLower)
    );

    // Eliminar duplicados (puede haber términos que estén tanto en sugerencias como en historial)
    matches = [...new Set(matches)];

    // Ordenar para poner primero:
    // 1. Los del historial que comienzan con la consulta
    // 2. Los predefinidos que comienzan con la consulta
    // 3. Los del historial que contienen la consulta
    // 4. Los predefinidos que contienen la consulta
    matches.sort((a, b) => {
      const aInHistory = searchHistory.has(a.toLowerCase());
      const bInHistory = searchHistory.has(b.toLowerCase());
      const aStartsWith = a.toLowerCase().startsWith(queryLower);
      const bStartsWith = b.toLowerCase().startsWith(queryLower);

      // Prioridad 1: Historial + comienza con consulta
      if (aInHistory && aStartsWith && (!bInHistory || !bStartsWith)) return -1;
      if (bInHistory && bStartsWith && (!aInHistory || !aStartsWith)) return 1;

      // Prioridad 2: Comienza con consulta
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      // Prioridad 3: En el historial
      if (aInHistory && !bInHistory) return -1;
      if (!aInHistory && bInHistory) return 1;

      return 0;
    });

    // Limitar resultados
    matches = matches.slice(0, parseInt(limit));

    console.log(`[API] Se encontraron ${matches.length} sugerencias para "${query}"`);

    // Devolver como array de objetos con texto e id
    const response = matches.map(text => ({
      id: text.toLowerCase().replace(/\s+/g, '-'),
      text,
      isHistory: searchHistory.has(text.toLowerCase())
    }));

    res.json(response);
  } catch (error) {
    console.error('[API] Error al obtener sugerencias:', error.message);
    res.json([]);
  }
});

// Configuración para Last.fm
const LASTFM_API_KEY = process.env.LASTFM_API_KEY || '4ef2cc2f144a00e44b7f1820f2768887';  // Usar la clave correcta
const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';

// Cachés simples para las búsquedas más frecuentes
const lastfmCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 }); // 1 hora de TTL
const suggestionsCache = new NodeCache({ stdTTL: 7200, checkperiod: 600 }); // 2 horas de TTL

// Módulo de sugerencias - Fácilmente intercambiable entre distintas APIs
const suggestionProviders = {
  // Proveedor actual: Last.fm
  lastfm: async (query, limit) => {
    try {
      // Validar y limpiar parámetros
      if (!query || typeof query !== 'string') {
        console.warn('[Last.fm] Query inválido:', query);
        return [];
      }

      // Asegurar que limit sea un número entero positivo
      const safeLimit = Math.max(1, Math.min(parseInt(limit) || 5, 20));

      // Limpiar la consulta
      const cleanQuery = query.trim();
      if (cleanQuery.length < 2) {
        console.warn('[Last.fm] Query demasiado corto:', cleanQuery);
        return [];
      }

      const cacheKey = `lastfm_${cleanQuery.toLowerCase()}_${safeLimit}`;
      const cachedResults = lastfmCache.get(cacheKey);

      if (cachedResults) {
        console.log(`[Last.fm] Usando resultados en caché para "${cleanQuery}"`);
        return cachedResults;
      }

      console.log(`[Last.fm] Buscando sugerencias para: "${cleanQuery}"`);

      // Array para almacenar todos los resultados combinados
      let combinedResults = [];

      // 1. Buscar artistas
      try {
        const artistResponse = await axios.get(LASTFM_API_URL, {
          params: {
            method: 'artist.search',
            artist: cleanQuery,
            api_key: LASTFM_API_KEY,
            format: 'json',
            limit: Math.min(safeLimit, 10) // Limitar a 10 artistas máximo
          },
          timeout: 3000
        });

        if (artistResponse.data &&
            artistResponse.data.results &&
            artistResponse.data.results.artistmatches &&
            artistResponse.data.results.artistmatches.artist) {

          const artists = artistResponse.data.results.artistmatches.artist;

          // Transformar y agregar al array combinado
          const artistSuggestions = artists.map(artist => ({
            id: `lastfm-artist-${artist.mbid || artist.name.toLowerCase().replace(/\s+/g, '-')}`,
            text: artist.name,
            type: 'artist',
            source: 'lastfm',
            imageUrl: artist.image && artist.image.length > 0 ? artist.image[1]['#text'] : null
          }));

          combinedResults = [...combinedResults, ...artistSuggestions];
        }
      } catch (error) {
        console.error('[Last.fm] Error al buscar artistas:', error.message);
      }

      // 2. Buscar canciones (tracks)
      try {
        const trackResponse = await axios.get(LASTFM_API_URL, {
          params: {
            method: 'track.search',
            track: cleanQuery,
            api_key: LASTFM_API_KEY,
            format: 'json',
            limit: Math.min(safeLimit, 15) // Más canciones que artistas
          },
          timeout: 3000
        });

        if (trackResponse.data &&
            trackResponse.data.results &&
            trackResponse.data.results.trackmatches &&
            trackResponse.data.results.trackmatches.track) {

          const tracks = trackResponse.data.results.trackmatches.track;

          // Transformar y agregar al array combinado
          const trackSuggestions = tracks.map(track => ({
            id: `lastfm-track-${track.mbid || `${track.artist}-${track.name}`.toLowerCase().replace(/\s+/g, '-')}`,
            text: `${track.name} - ${track.artist}`,
            artist: track.artist,
            trackName: track.name,
            type: 'track',
            source: 'lastfm',
            imageUrl: track.image && track.image.length > 0 ? track.image[1]['#text'] : null
          }));

          combinedResults = [...combinedResults, ...trackSuggestions];
        }
      } catch (error) {
        console.error('[Last.fm] Error al buscar canciones:', error.message);
      }

      // 3. Buscar álbumes
      try {
        const albumResponse = await axios.get(LASTFM_API_URL, {
          params: {
            method: 'album.search',
            album: cleanQuery,
            api_key: LASTFM_API_KEY,
            format: 'json',
            limit: Math.min(safeLimit, 8) // Menos álbumes que canciones
          },
          timeout: 3000
        });

        if (albumResponse.data &&
            albumResponse.data.results &&
            albumResponse.data.results.albummatches &&
            albumResponse.data.results.albummatches.album) {

          const albums = albumResponse.data.results.albummatches.album;

          // Transformar y agregar al array combinado
          const albumSuggestions = albums.map(album => ({
            id: `lastfm-album-${album.mbid || `${album.artist}-${album.name}`.toLowerCase().replace(/\s+/g, '-')}`,
            text: `${album.name} - ${album.artist}`,
            artist: album.artist,
            albumName: album.name,
            type: 'album',
            source: 'lastfm',
            imageUrl: album.image && album.image.length > 0 ? album.image[1]['#text'] : null
          }));

          combinedResults = [...combinedResults, ...albumSuggestions];
        }
      } catch (error) {
        console.error('[Last.fm] Error al buscar álbumes:', error.message);
      }

      // Ordenar y limitar los resultados
      combinedResults.sort((a, b) => {
        // Prioridad por tipo: primero canciones, luego artistas, finalmente álbumes
        const typeOrder = { 'track': 0, 'artist': 1, 'album': 2 };
        if (typeOrder[a.type] !== typeOrder[b.type]) {
          return typeOrder[a.type] - typeOrder[b.type];
        }

        // Si son del mismo tipo, ordenar alfabéticamente
        return a.text.localeCompare(b.text);
      });

      const results = combinedResults.slice(0, safeLimit);

      // Guardar en caché los resultados
      lastfmCache.set(cacheKey, results);
      return results;
    } catch (error) {
      console.error('[Last.fm] Error al obtener sugerencias:', error.message);
      return [];
    }
  },

  // Proveedor de sugerencias locales
  local: async (query, limit) => {
    try {
      // Base de datos de sugerencias populares (artistas, canciones y álbumes)
      const suggestions = [
        // Artistas populares actuales (2025)
        { text: "Bad Bunny", type: "artist" },
        { text: "Taylor Swift", type: "artist" },
        { text: "BTS", type: "artist" },
        { text: "The Weeknd", type: "artist" },
        { text: "Billie Eilish", type: "artist" },
        { text: "Olivia Rodrigo", type: "artist" },
        { text: "Ariana Grande", type: "artist" },
        { text: "Dua Lipa", type: "artist" },
        { text: "Drake", type: "artist" },
        { text: "Adele", type: "artist" },
        { text: "Harry Styles", type: "artist" },
        { text: "Karol G", type: "artist" },
        { text: "Justin Bieber", type: "artist" },
        { text: "Rosalía", type: "artist" },
        { text: "Post Malone", type: "artist" },
        { text: "J Balvin", type: "artist" },
        { text: "Miley Cyrus", type: "artist" },
        { text: "Rauw Alejandro", type: "artist" },
        { text: "Feid", type: "artist" },
        { text: "Peso Pluma", type: "artist" },

        // Géneros populares
        { text: "Pop", type: "genre" },
        { text: "Hip Hop", type: "genre" },
        { text: "Rock", type: "genre" },
        { text: "R&B", type: "genre" },
        { text: "Reggaeton", type: "genre" },
        { text: "K-pop", type: "genre" },

        // Canciones populares 2025
        { text: "Die For You - The Weeknd", type: "track", artist: "The Weeknd", trackName: "Die For You" },
        { text: "As It Was - Harry Styles", type: "track", artist: "Harry Styles", trackName: "As It Was" },
        { text: "Kill Bill - SZA", type: "track", artist: "SZA", trackName: "Kill Bill" },
        { text: "Calm Down - Rema", type: "track", artist: "Rema", trackName: "Calm Down" },
        { text: "Flowers - Miley Cyrus", type: "track", artist: "Miley Cyrus", trackName: "Flowers" },
        { text: "BZRP Music Sessions #53 - Bizarrap & Shakira", type: "track", artist: "Bizarrap & Shakira", trackName: "BZRP Music Sessions #53" },
        { text: "Anti-Hero - Taylor Swift", type: "track", artist: "Taylor Swift", trackName: "Anti-Hero" },
        { text: "La Bachata - Manuel Turizo", type: "track", artist: "Manuel Turizo", trackName: "La Bachata" },
        { text: "Unholy - Sam Smith & Kim Petras", type: "track", artist: "Sam Smith & Kim Petras", trackName: "Unholy" },
        { text: "Lavender Haze - Taylor Swift", type: "track", artist: "Taylor Swift", trackName: "Lavender Haze" },

        // Álbumes populares 2025
        { text: "Midnights - Taylor Swift", type: "album", artist: "Taylor Swift", albumName: "Midnights" },
        { text: "Un Verano Sin Ti - Bad Bunny", type: "album", artist: "Bad Bunny", albumName: "Un Verano Sin Ti" },
        { text: "SOS - SZA", type: "album", artist: "SZA", albumName: "SOS" },
        { text: "Harry's House - Harry Styles", type: "album", artist: "Harry Styles", albumName: "Harry's House" },
        { text: "MAÑANA SERÁ BONITO - Karol G", type: "album", artist: "Karol G", albumName: "MAÑANA SERÁ BONITO" },
        { text: "Endless Summer Vacation - Miley Cyrus", type: "album", artist: "Miley Cyrus", albumName: "Endless Summer Vacation" }
      ];

      // Transformar las búsquedas históricas para que sean compatibles con el formato de sugerencias
      const historyItems = Array.from(searchHistory).map(text => ({
        text,
        type: "search",
        isHistory: true
      }));

      // Combinar todas las sugerencias
      const allSuggestions = [...suggestions, ...historyItems];

      // Filtrar sugerencias que coincidan con la consulta (ignorando mayúsculas/minúsculas)
      const queryLower = query.toLowerCase();
      let matches = allSuggestions.filter(item =>
        item.text.toLowerCase().includes(queryLower)
      );

      // Eliminar duplicados basados en texto
      const uniqueMatches = [];
      const seenTexts = new Set();

      for (const match of matches) {
        if (!seenTexts.has(match.text.toLowerCase())) {
          seenTexts.add(match.text.toLowerCase());
          uniqueMatches.push(match);
        }
      }

      // Ordenar por relevancia
      uniqueMatches.sort((a, b) => {
        const aInHistory = a.isHistory;
        const bInHistory = b.isHistory;
        const aStartsWith = a.text.toLowerCase().startsWith(queryLower);
        const bStartsWith = b.text.toLowerCase().startsWith(queryLower);

        // Prioridad: 1. Historia + Comienza con, 2. Comienza con, 3. Historia, 4. Resto
        if (aInHistory && aStartsWith && (!bInHistory || !bStartsWith)) return -1;
        if (bInHistory && bStartsWith && (!aInHistory || !aStartsWith)) return 1;
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        if (aInHistory && !bInHistory) return -1;
        if (!aInHistory && bInHistory) return 1;

        // Secundario: por tipo (canción > artista > álbum > género)
        const typeOrder = { 'track': 0, 'artist': 1, 'album': 2, 'genre': 3, 'search': 4 };
        if (typeOrder[a.type] !== typeOrder[b.type]) {
          return typeOrder[a.type] - typeOrder[b.type];
        }

        return 0;
      });

      // Transformar al formato esperado
      return uniqueMatches.map(item => ({
        id: `local-${item.type}-${item.text.toLowerCase().replace(/\s+/g, '-')}`,
        text: item.text,
        isHistory: item.isHistory || false,
        source: 'local',
        type: item.type,
        artist: item.artist || null,
        trackName: item.trackName || null,
        albumName: item.albumName || null
      })).slice(0, limit);
    } catch (error) {
      console.error('[Local] Error al obtener sugerencias locales:', error.message);
      return [];
    }
  },

  /* Placeholder para futura integración con Spotify
  spotify: async (query, limit) => {
    try {
      // Obtener token de Spotify
      const token = await getSpotifyToken();

      // Realizar búsqueda en Spotify
      const response = await axios.get('https://api.spotify.com/v1/search', {
        headers: { 'Authorization': `Bearer ${token}` },
        params: {
          q: query,
          type: 'artist',
          limit: limit
        }
      });

      if (response.data && response.data.artists && response.data.artists.items) {
        return response.data.artists.items.map(artist => ({
          id: `spotify-${artist.id}`,
          text: artist.name,
          source: 'spotify'
        }));
      }

      return [];
    } catch (error) {
      console.error('[Spotify] Error al obtener sugerencias:', error.message);
      return [];
    }
  }
  */
};

// Configuración de proveedores activos (fácil de cambiar en el futuro)
const ACTIVE_SUGGESTION_PROVIDERS = ['lastfm', 'local']; // Cambiar a ['spotify', 'local'] en el futuro

// Endpoint para obtener sugerencias de Last.fm
app.get('/api/lastfm/suggest', async (req, res) => {
  try {
    const { query = '', limit = 5 } = req.query;

    if (!query || query.length < 2) {
      return res.json([]);
    }

    const suggestions = await suggestionProviders.lastfm(query, limit);
    return res.json(suggestions);
  } catch (error) {
    console.error('[API] Error en sugerencias de Last.fm:', error.message);
    res.json([]);
  }
});

// Endpoint combinado de sugerencias (usando proveedores configurados)
app.get('/api/combined/suggest', async (req, res) => {
  try {
    const { query = '', limit = 8 } = req.query;

    if (!query || query.length < 2) {
      return res.json([]);
    }

    console.log(`[API] Buscando sugerencias combinadas para: "${query}"`);

    // Verificar si ya tenemos esta consulta en caché
    const cacheKey = `suggestions_${query.toLowerCase()}_${limit}`;
    const cachedResults = suggestionsCache.get(cacheKey);

    if (cachedResults) {
      console.log(`[API] Usando sugerencias combinadas en caché para "${query}"`);
      return res.json(cachedResults);
    }

    // Obtener sugerencias de todos los proveedores activos
    let allSuggestions = [];

    for (const provider of ACTIVE_SUGGESTION_PROVIDERS) {
      if (suggestionProviders[provider]) {
        const providerLimit = Math.floor(parseInt(limit) * (provider === 'lastfm' ? 0.7 : 1.0));
        const results = await suggestionProviders[provider](query, providerLimit);
        allSuggestions = allSuggestions.concat(results);
      }
    }

    // Eliminar duplicados (por nombre)
    const uniqueSuggestions = [];
    const seenTexts = new Set();

    for (const suggestion of allSuggestions) {
      const lowerText = suggestion.text.toLowerCase();
      if (!seenTexts.has(lowerText)) {
        seenTexts.add(lowerText);
        uniqueSuggestions.push(suggestion);
      }
    }

    // Ordenar las sugerencias combinadas (priorizando historial e inicios de palabra)
    uniqueSuggestions.sort((a, b) => {
      const aIsHistory = a.isHistory;
      const bIsHistory = b.isHistory;
      const aStartsWith = a.text.toLowerCase().startsWith(query.toLowerCase());
      const bStartsWith = b.text.toLowerCase().startsWith(query.toLowerCase());
      const aIsLastfm = a.source === 'lastfm';
      const bIsLastfm = b.source === 'lastfm';

      // Priorizar historial
      if (aIsHistory && !bIsHistory) return -1;
      if (!aIsHistory && bIsHistory) return 1;

      // Luego priorizar coincidencias al inicio
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      // Luego priorizar Last.fm/Spotify sobre local
      if (aIsLastfm && !bIsLastfm) return -1;
      if (!aIsLastfm && bIsLastfm) return 1;

      return 0;
    });

    // Limitar el número total de resultados
    const combined = uniqueSuggestions.slice(0, parseInt(limit));

    // Guardar en caché antes de devolver los resultados
    console.log(`[API] Enviando ${combined.length} sugerencias combinadas`);
    suggestionsCache.set(cacheKey, combined);
    res.json(combined);
  } catch (error) {
    console.error('[API] Error general en sugerencias combinadas:', error.message);
    res.json([]);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor Node.js escuchando en el puerto ${PORT}`);
  console.log(`Redirigiendo a Python API en: ${PYTHON_API_BASE_URL}`);
});

// Endpoint para guardar en historial
app.post('/api/search/history', (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Se requiere un término de búsqueda válido' });
    }

    // Añadir al historial
    addToSearchHistory(query);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[API] Error al guardar historial:', error.message);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para obtener la playlist de reproducción de un video (incluye browseId de letras)
app.get('/api/youtube/get-watch-playlist', async (req, res) => {
  try {
    const { videoId } = req.query;

    if (!videoId) {
      return res.status(400).json({
        error: 'Se requiere el parámetro videoId',
        success: false
      });
    }

    console.log(`[API] Obteniendo información de reproducción para: ${videoId}`);

    // Llamada a la API de Python para obtener la playlist de reproducción
    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:5000';

    try {
      const response = await axios.get(`${pythonApiUrl}/watch-playlist`, {
        params: { videoId },
        timeout: 10000 // 10 segundos de timeout
      });

      // La respuesta debe incluir información sobre lyrics si está disponible
      const data = response.data;

      // Verificamos si hay información de letras disponible
      if (data && data.lyrics && data.lyrics.browseId) {
        console.log(`[API] Se encontró browseId de letras: ${data.lyrics.browseId}`);
      } else {
        console.log(`[API] No se encontró información de letras para el video`);
      }

      res.json(data);
    } catch (error) {
      console.error(`[API] Error en la llamada a la API de Python:`, error.message);

      res.status(500).json({
        error: 'Error al comunicarse con el servicio de YouTube Music',
        details: error.message,
        success: false
      });
    }
  } catch (error) {
    console.error(`[API] Error general en get-watch-playlist:`, error);

    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
      success: false
    });
  }
});

// Endpoint para obtener letras de canciones mediante browseId
app.get('/api/youtube/get-lyrics', async (req, res) => {
  try {
    const { browseId, timestamps } = req.query;

    if (!browseId) {
      return res.status(400).json({
        error: 'Se requiere el parámetro browseId',
        success: false
      });
    }

    // Convertir timestamps a booleano si es necesario
    const useTimestamps = timestamps === 'true';

    console.log(`[API] Obteniendo letras para browseId: ${browseId} (timestamps: ${useTimestamps})`);

    // Llamada a la API de Python para obtener las letras
    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:5000';

    try {
      const response = await axios.get(`${pythonApiUrl}/lyrics`, {
        params: {
          browseId,
          timestamps: useTimestamps
        },
        timeout: 10000 // 10 segundos de timeout
      });

      const lyricsData = response.data;

      // Verificar si tenemos información de letras
      if (lyricsData && (typeof lyricsData.lyrics === 'string' ||
                         (Array.isArray(lyricsData.lyrics) && lyricsData.lyrics.length > 0))) {
        console.log(`[API] Letras obtenidas correctamente (con timestamps: ${lyricsData.hasTimestamps})`);
      } else {
        console.log(`[API] No se encontraron letras para el browseId`);
      }

      res.json(lyricsData);
    } catch (error) {
      console.error(`[API] Error en la llamada a la API de Python:`, error.message);

      res.status(500).json({
        error: 'Error al comunicarse con el servicio de YouTube Music',
        details: error.message,
        success: false
      });
    }
  } catch (error) {
    console.error(`[API] Error general en get-lyrics:`, error);

    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
      success: false
    });
  }
});

// YouTube Music géneros y charts
app.get('/api/youtube/get-mood-categories', async (req, res) => {
  try {
    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:5000';
    const response = await axios.get(`${pythonApiUrl}/get_mood_categories`);
    return res.json(response.data);
  } catch (error) {
    console.error('Error obteniendo categorías de YouTube Music:', error.message);
    return res.status(error.response?.status || 500).json({
      error: 'Error obteniendo categorías',
      message: error.message
    });
  }
});

app.get('/api/youtube/get-mood-playlists', async (req, res) => {
  try {
    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:5000';
    const { params } = req.query;
    if (!params) {
      return res.status(400).json({ error: 'El parámetro "params" es requerido' });
    }

    const response = await axios.get(`${pythonApiUrl}/get_mood_playlists`, {
      params: { params }
    });
    return res.json(response.data);
  } catch (error) {
    console.error('Error obteniendo playlists de géneros:', error.message);
    return res.status(error.response?.status || 500).json({
      error: 'Error obteniendo playlists de géneros',
      message: error.message
    });
  }
});

app.get('/api/youtube/get-charts', async (req, res) => {
  try {
    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:5000';
    const { country } = req.query;
    const response = await axios.get(`${pythonApiUrl}/get_charts`, {
      params: { country: country || 'ZZ' }
    });
    return res.json(response.data);
  } catch (error) {
    console.error('Error obteniendo charts de YouTube Music:', error.message);
    return res.status(error.response?.status || 500).json({
      error: 'Error obteniendo charts',
      message: error.message
    });
  }
});
