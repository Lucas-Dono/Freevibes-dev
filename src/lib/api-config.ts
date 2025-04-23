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
  // URL del servidor Node.js - usar variable pública para el cliente
  // Lanzar error si no está configurada para ser explícito
  const nodeServerUrl = process.env.NEXT_PUBLIC_NODE_API_URL || '';
  
  // URL de la API Python - usar variable pública para el cliente
  // Lanzar error si no está configurada para ser explícito
  const pythonApiUrl = process.env.NEXT_PUBLIC_PYTHON_API_URL || '';

  // Modo demo
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  // Registrar advertencia si faltan configuraciones esenciales
  if (!nodeServerUrl || !pythonApiUrl) {
    console.warn(
      'Advertencia: Variables de entorno faltantes para APIs:',
      !nodeServerUrl ? 'NEXT_PUBLIC_NODE_API_URL' : '',
      !pythonApiUrl ? 'NEXT_PUBLIC_PYTHON_API_URL' : ''
    );
  }

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

  // Si estamos en el servidor, usar la variable de entorno
  // Lanzar error si no está configurada para ser explícito
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  if (!appUrl && typeof window === 'undefined') {
    console.warn('Advertencia: NEXT_PUBLIC_APP_URL no está configurada');
  }
  
  return appUrl;
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
