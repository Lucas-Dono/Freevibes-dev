/**
 * Configuración centralizada para todas las APIs y endpoints utilizados en la aplicación
 */

/**
 * Configuración centralizada para todas las URLs y APIs del proyecto
 */
export const API_CONFIG = {
  // URLs base usando las variables NEXT_PUBLIC existentes - usando getters para forzar la reconsulta
  get FRONTEND_URL() { return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'; },
  get NODE_API_URL() { return process.env.NEXT_PUBLIC_NODE_API_URL || 'http://localhost:3001'; },
  get PYTHON_API_URL() { return process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:5000'; },
  
  // Getters de compatibilidad para variables deprecadas
  get NEXT_PUBLIC_NODE_API_URL() { return process.env.NEXT_PUBLIC_NODE_API_URL || this.NODE_API_URL; },
  
  // Endpoints específicos
  SPOTIFY_API_BASE: 'https://api.spotify.com/v1',
  DEEZER_API_BASE: 'https://api.deezer.com',
  YOUTUBE_API_BASE: 'https://www.googleapis.com/youtube/v3',
  
  // Timeouts para las APIs (en ms)
  API_TIMEOUTS: {
    SPOTIFY: 15000,
    YOUTUBE: 10000,
    DEEZER: 10000,
    LASTFM: 10000,
    SEARCH: 10000,
    RECOMMENDATIONS: 15000,
    DEFAULT: 10000
  },
  
  // Métodos auxiliares para obtener timeouts específicos
  getSearchTimeout: () => {
    return API_CONFIG.API_TIMEOUTS.SEARCH;
  },
  
  getRecommendationsTimeout: () => {
    return API_CONFIG.API_TIMEOUTS.RECOMMENDATIONS;
  },
  
  // Proxies para las APIs externas
  API_PROXIES: {
    LASTFM: '/proxy/lastfm',
    SPOTIFY: '/auth/spotify',
    DEEZER: '/proxy/deezer',
    YOUTUBE: '/proxy/youtube'
  },
  
  // Determinación del modo demo
  isDemoMode: () => {
    return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  },
  
  // Función centralizada para obtener la URL base de la API
  getApiBaseUrl: () => {
    // En el navegador
    if (typeof window !== 'undefined' && window.location) {
      return `${window.location.origin}/api`;
    }
    // En el servidor - usar NEXT_PUBLIC_APP_URL actualizado
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${appUrl}/api`;
  },
  
  // Función para obtener URL del servidor Node
  getNodeApiUrl: () => {
    // Leer directamente de la variable de entorno (no usar caché)
    return process.env.NEXT_PUBLIC_NODE_API_URL || 'http://localhost:3001';
  },
  
  // Función para obtener URL del servidor Python
  getPythonApiUrl: () => {
    // Leer directamente de la variable de entorno (no usar caché)
    return process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:5000';
  },
  
  // Configuración para los throttlers de las APIs
  THROTTLE_CONFIG: {
    spotify: {
      minInterval: 100,    // 100ms entre solicitudes (max 10 por segundo)
      maxParallel: 5,      // máximo 5 solicitudes paralelas
      queueTime: 30000     // 30 segundos máximo en cola
    },
    youtube: {
      minInterval: 200,    // 200ms entre solicitudes (max 5 por segundo)
      maxParallel: 3,      // máximo 3 solicitudes paralelas
      queueTime: 30000     // 30 segundos máximo en cola
    },
    default: {
      minInterval: 50,     // 50ms entre solicitudes
      maxParallel: 10,     // máximo 10 solicitudes paralelas
      queueTime: 15000     // 15 segundos máximo en cola
    }
  }
}; 