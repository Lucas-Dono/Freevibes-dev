const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;
const PYTHON_API_URL = process.env.YOUTUBE_API_URL || 'http://localhost:5000/api';

// Configuración CORS para producción
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Endpoint raíz para verificación de salud
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'MusicVerse Node.js API is running',
    environment: process.env.NODE_ENV || 'development',
    pythonApi: PYTHON_API_URL
  });
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Node.js API',
    version: '1.0.0'
  });
});

// Proxy para la API de Python (YouTube Music)
app.post('/api/youtube/setup', async (req, res) => {
  try {
    const response = await axios.post(`${PYTHON_API_URL}/setup`, req.body);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta para búsqueda en YouTube Music
app.get('/api/youtube/search', async (req, res) => {
  try {
    const { query, filter = 'songs', limit = 10, region = 'US' } = req.query;
    
    console.log(`Buscando en YouTube Music: "${query}" (filtro: ${filter}, límite: ${limit}, región: ${region})`);
    
    const response = await axios.get(`${PYTHON_API_URL.replace('/api', '')}/search`, {
      params: { 
        query, 
        filter, 
        limit,
        region
      },
      timeout: 12000 // Aumentar timeout a 12 segundos
    });
    
    if (response.data && Array.isArray(response.data)) {
      console.log(`Resultados encontrados para "${query}": ${response.data.length}`);
    } else {
      console.log(`Respuesta de búsqueda no es un array para "${query}"`);
    }
    
    res.json(response.data);
  } catch (error) {
    console.error('Error al buscar en YouTube Music:', error.message);
    
    // Información más detallada para depuración
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
    
    res.status(500).json({ error: 'Error al buscar en YouTube Music', message: error.message });
  }
});

app.get('/api/youtube/find-track', async (req, res) => {
  try {
    const response = await axios.get(`${PYTHON_API_URL}/find-track`, { 
      params: req.query 
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/youtube/spotify-to-youtube', async (req, res) => {
  try {
    const response = await axios.get(`${PYTHON_API_URL}/spotify-to-youtube`, { 
      params: req.query 
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/youtube/recommendations', async (req, res) => {
  try {
    const response = await axios.get(`${PYTHON_API_URL}/recommendations`, {
      params: req.query
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Nuevo endpoint para obtener recomendaciones por géneros
app.get('/api/youtube/recommendations-by-genres', async (req, res) => {
  try {
    console.log('[Node Server] Redirigiendo solicitud a recommendations-by-genres con parámetros:', req.query);
    const response = await axios.get(`${PYTHON_API_URL}/recommendations-by-genres`, {
      params: req.query
    });
    console.log('[Node Server] Respuesta recibida de recommendations-by-genres:', response.data ? 'OK' : 'Vacío');
    res.json(response.data);
  } catch (error) {
    console.error('[Node Server] Error en recommendations-by-genres:', error.message);
    // Si el servicio Python devuelve un error, intentamos enviar una respuesta con datos de respaldo
    res.status(500).json({ 
      error: error.message,
      artists: [],
      playlists: [],
      tracks: []
    });
  }
});

// Nuevo endpoint para obtener artistas populares
app.get('/api/youtube/top-artists', async (req, res) => {
  try {
    const response = await axios.get(`${PYTHON_API_URL}/top-artists`, {
      params: req.query
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error al obtener artistas populares:', error);
    // Si el endpoint no existe en Python, devolver datos de respaldo
    res.json({
      items: [
        {
          id: "fallback_artist_1",
          name: "Daft Punk",
          images: [{ url: "https://i.scdn.co/image/ab6761610000e5eb10ca40ea0b0b5082dba0ff75" }],
          genres: ["electronic", "french house"]
        },
        {
          id: "fallback_artist_2",
          name: "Coldplay",
          images: [{ url: "https://i.scdn.co/image/ab6761610000e5eb8863bc11d2aa12b54f5aeb36" }],
          genres: ["pop", "rock"]
        },
        {
          id: "fallback_artist_3",
          name: "Billie Eilish",
          images: [{ url: "https://i.scdn.co/image/ab6761610000e5eb7b9745289c1687a25638c4d0" }],
          genres: ["pop", "alt pop"]
        },
        {
          id: "fallback_artist_4",
          name: "The Weeknd",
          images: [{ url: "https://i.scdn.co/image/ab6761610000e5eb94fbdb362091111a47db337d" }],
          genres: ["r&b", "pop"]
        }
      ]
    });
  }
});

// Nuevos endpoints para las características agregadas
app.get('/api/youtube/featured-playlists', async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    const region = req.query.region || 'ES'; // Usar España como región por defecto
    console.log(`Obteniendo playlists destacadas de YouTube Music con límite ${limit} para región ${region}`);
    
    // Usar la URL base de la API de Python en lugar de hardcodear
    const pythonBaseUrl = PYTHON_API_URL.replace('/api', '');
    const response = await axios.get(`${pythonBaseUrl}/featured-playlists`, {
      params: { limit, region }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error al obtener playlists destacadas de YouTube Music:', error);
    res.status(500).json({ error: 'Error al obtener playlists destacadas' });
  }
});

app.get('/api/youtube/new-releases', async (req, res) => {
  try {
    const limit = req.query.limit || 10;
    const region = req.query.region || 'ES';
    console.log(`Obteniendo nuevos lanzamientos de YouTube Music con límite ${limit} para región ${region}`);
    
    // Usar la URL base de la API de Python en lugar de hardcodear
    const pythonBaseUrl = PYTHON_API_URL.replace('/api', '');
    const response = await axios.get(`${pythonBaseUrl}/new-releases`, {
      params: { limit, region }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error al obtener nuevos lanzamientos de YouTube Music:', error);
    res.status(500).json({ error: 'Error al obtener nuevos lanzamientos' });
  }
});

app.get('/api/youtube/artists-by-genre', async (req, res) => {
  try {
    const { genre, limit = 10, region = 'ES' } = req.query;
    console.log(`Obteniendo artistas por género ${genre} de YouTube Music con límite ${limit} para región ${region}`);
    
    // Usar la URL base de la API de Python en lugar de hardcodear
    const pythonBaseUrl = PYTHON_API_URL.replace('/api', '');
    const response = await axios.get(`${pythonBaseUrl}/artists-by-genre`, {
      params: { genre, limit, region }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error al obtener artistas por género de YouTube Music:', error);
    res.status(500).json({ error: 'Error al obtener artistas por género' });
  }
});

// Nuevo endpoint para ping explícito
app.get('/api/youtube/ping', (req, res) => {
  // Intentar conectar con el servicio Python usando una ruta que sabemos que existe
  console.log('[Server] Verificando disponibilidad del servicio Python...');
  
  // Usar la URL base de la API de Python en lugar de hardcodear
  const pythonBaseUrl = PYTHON_API_URL.replace('/api', '');
  // Intentar con la ruta /search que sabemos que existe en el servicio Python
  axios.get(`${pythonBaseUrl}/search`, { 
    params: { query: 'test', limit: 1 },
    timeout: 3000 
  })
    .then((response) => {
      console.log('[Server] Servicio Python responde correctamente');
      res.json({ 
        status: 'ok', 
        message: 'YouTube Music service is running',
        response_type: typeof response.data
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
        error: error.message
      });
    });
});

// Estado del servidor - Mejorado para verificar conectividad con Python
app.get('/api/status', async (req, res) => {
  try {
    console.log('[Server] Verificando estado general de los servicios');
    
    // Usar la URL base de la API de Python en lugar de hardcodear
    const pythonBaseUrl = PYTHON_API_URL.replace('/api', '');
    // Intentar con la ruta /search que sabemos que existe en el servicio Python
    const pythonStatus = await axios.get(`${pythonBaseUrl}/search`, { 
      params: { query: 'test', limit: 1 },
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
      timestamp: new Date().toISOString()
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor Node.js corriendo en http://localhost:${PORT}`);
  console.log(`Utilizando API de Python en: ${PYTHON_API_URL}`);
}); 