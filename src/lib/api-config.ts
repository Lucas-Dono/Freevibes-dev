/**
 * Configuración para las APIs y endpoints utilizados en la aplicación
 */

/**
 * Obtiene la URL base de las APIs
 * @returns URL base configurada o la URL por defecto
 */
export function getApiBaseUrl(): string {
  // Usar la variable de entorno si está definida, o la URL local por defecto
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
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