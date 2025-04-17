/**
 * Gestor de datos demo
 * Este módulo carga y sirve datos mock almacenados para el modo demo
 */

const fs = require('fs').promises;
const path = require('path');

// Ruta base para los datos demo
const baseDir = path.resolve(__dirname, './spotify');

/**
 * Verifica si una solicitud está en modo demo
 * @param {Object} req - Objeto de solicitud Express
 * @returns {boolean} - true si está en modo demo
 */
function isDemoMode(req) {
  return req.headers['x-demo-mode'] === 'true';
}

/**
 * Obtiene el idioma demo de la solicitud
 * @param {Object} req - Objeto de solicitud Express
 * @returns {string} - Código de idioma (es, en, fr, it)
 */
function getDemoLanguage(req) {
  return req.headers['x-demo-lang'] || 'es';
}

/**
 * Carga un archivo JSON demo
 * @param {string} filePath - Ruta relativa del archivo dentro de demo-data/spotify
 * @returns {Promise<Object>} - Datos JSON parseados
 */
async function loadDemoData(filePath) {
  try {
    const fullPath = path.join(baseDir, filePath);
    const data = await fs.readFile(fullPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error al cargar datos demo desde ${filePath}:`, error.message);
    throw new Error(`No se pudieron cargar los datos demo (${filePath})`);
  }
}

/**
 * Mapea una acción y parámetros de solicitud a un archivo de datos demo
 * @param {string} action - Acción solicitada
 * @param {Object} params - Parámetros de la solicitud
 * @param {string} lang - Código de idioma
 * @returns {string} - Ruta relativa del archivo JSON
 */
function mapRequestToFile(action, params, lang) {
  switch (action) {
    case 'featured':
      return `${lang}/featured_playlists.json`;
    
    case 'new-releases':
      return `${lang}/new_releases.json`;
    
    case 'search':
      // Si la búsqueda incluye un artista conocido, usar datos específicos
      const query = params.q || params.query || '';
      const searchType = params.type || 'track';
      
      if (query.toLowerCase().includes('rosalía') && lang === 'es') {
        return `es/search_rosalía_${searchType}.json`;
      } else if (query.toLowerCase().includes('taylor swift') && lang === 'en') {
        return `en/search_taylor_swift_${searchType}.json`;
      } else if (query.toLowerCase().includes('stromae') && lang === 'fr') {
        return `fr/search_stromae_${searchType}.json`;
      } else if (query.toLowerCase().includes('maneskin') && lang === 'it') {
        return `it/search_maneskin_${searchType}.json`;
      }
      
      // Búsqueda genérica según el idioma
      return `${lang}/search_${searchType}.json`;
    
    case 'recommendations':
      return 'recommendations_general.json';
    
    case 'top':
      return `${lang}/top_tracks.json`;
    
    case 'saved-tracks':
      // Para proteger privacidad, usar top_tracks en lugar de saved_tracks
      return `${lang}/top_tracks.json`;
    
    case 'genre-recommendations':
      const genre = params.genre || 'pop';
      return `${lang}/genre_${genre.toLowerCase()}.json`;
    
    case 'direct':
      // Intentar mapear endpoints directos de Spotify a archivos locales
      const endpoint = params.endpoint || '';
      
      if (endpoint.includes('/browse/featured-playlists')) {
        return `${lang}/featured_playlists.json`;
      } else if (endpoint.includes('/browse/new-releases')) {
        return `${lang}/new_releases.json`;
      } else if (endpoint.includes('/search')) {
        return `${lang}/search_track.json`;
      } else if (endpoint.includes('/recommendations')) {
        return 'recommendations_general.json';
      } else if (endpoint.includes('/me/top/tracks')) {
        return `${lang}/top_tracks.json`;
      } else if (endpoint.includes('/me/tracks')) {
        // Para proteger privacidad, usar top_tracks en lugar de saved_tracks
        return `${lang}/top_tracks.json`;
      }
      
      // Si no hay un mapeo específico, usar perfil de usuario
      return 'user_profile.json';
    
    default:
      // Para cualquier acción no reconocida, usar perfil de usuario
      return 'user_profile.json';
  }
}

/**
 * Maneja una solicitud en modo demo
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @returns {Promise<boolean>} - true si la solicitud fue manejada en modo demo
 */
async function handleDemoRequest(req, res) {
  if (!isDemoMode(req)) {
    return false;
  }
  
  try {
    const lang = getDemoLanguage(req);
    const action = req.query.action || '';
    const params = req.query;
    
    console.log(`[DEMO MODE] Procesando solicitud: ${action} (idioma: ${lang})`);
    
    // Mapear la solicitud a un archivo de datos
    const filePath = mapRequestToFile(action, params, lang);
    console.log(`[DEMO MODE] Usando archivo: ${filePath}`);
    
    // Cargar datos demo
    const demoData = await loadDemoData(filePath);
    
    // Devolver respuesta
    res.json(demoData);
    return true;
  } catch (error) {
    console.error('[DEMO MODE] Error:', error);
    
    // Incluso en caso de error, indicamos que la solicitud fue manejada
    // para evitar que continúe el flujo normal
    res.status(500).json({
      error: 'Error en modo demo',
      message: error.message
    });
    return true;
  }
}

module.exports = {
  handleDemoRequest,
  isDemoMode
}; 