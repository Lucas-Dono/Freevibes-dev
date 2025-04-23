/**
 * Configuración para las APIs y endpoints utilizados en la aplicación
 */

/**
 * Utilidad para obtener la configuración de las APIs y servicios externos
 */

interface APIConfig {
  nodeServerUrl: string;
  pythonApiUrl: string;
  demoMode: boolean;
}

/**
 * Obtiene la configuración actual de la API basada en variables de entorno
 * @returns Objeto con la configuración de la API
 */
export function getAPIConfig(): APIConfig {
  // URL del servidor Node.js
  const nodeServerUrl = process.env.NODE_API_URL || 'http://localhost:3101';

  // URL de la API Python
  const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:5100';

  // Determinar si estamos en modo demo
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  return {
    nodeServerUrl,
    pythonApiUrl,
    demoMode
  };
}

/**
 * Obtiene la URL base de la API
 * @returns URL base para las llamadas a la API
 */
export function getApiBaseUrl(): string {
  // Si estamos en el navegador, usar la URL actual
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }

  // Si estamos en el servidor, usar la variable de entorno o localhost
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

/**
 * Configuración para los proxies de APIs externas
 */
export const API_PROXIES = {
  LASTFM: '/proxy/lastfm',
  SPOTIFY: '/auth/spotify',
  DEEZER: '/proxy/deezer',
  YOUTUBE: '/proxy/youtube'
};

/**
 * Tiempos de timeout para llamadas a APIs externas (en ms)
 */
export const API_TIMEOUTS = {
  LASTFM: 10000,
  SPOTIFY: 8000,
  DEEZER: 8000,
  YOUTUBE: 12000,
  DEFAULT: 10000,
  // Nuevos timeouts para operaciones específicas
  SEARCH: 10000,
  RECOMMENDATIONS: 15000
};
