/**
 * Configuración para autenticación y redirecciones de servicios externos
 */

/**
 * Obtiene la URL base de la aplicación según el entorno
 * @returns URL base de la aplicación sin trailing slash
 */
export function getBaseUrl(): string {
  // En producción, usar la variable de entorno o determinar dinámicamente
  if (process.env.NODE_ENV === 'production') {
    return process.env.NEXT_PUBLIC_APP_URL || '';
  }
  
  // En cliente, usar la URL actual
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // En desarrollo/servidor, usar localhost
  return 'http://localhost:3000';
}

/**
 * Obtiene la URL base del backend según el entorno
 * @returns URL base del backend sin trailing slash
 */
export function getBackendBaseUrl(): string {
  // En producción, usar variable específica para el backend (Render)
  if (process.env.NODE_ENV === 'production') {
    return process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || getBaseUrl();
  }
  
  // En desarrollo, normalmente es la misma que la del frontend
  return process.env.BACKEND_URL || 'http://localhost:3000';
}

/**
 * Determina si un callback debe ir al frontend o al backend
 * @param service Nombre del servicio ('spotify', 'lastfm', 'deezer')
 * @returns true si el callback debe ir al frontend, false si debe ir al backend
 */
function isCallbackOnFrontend(service: string): boolean {
  // En producción, verificar si hay una configuración específica
  if (process.env.NODE_ENV === 'production') {
    const config = process.env[`${service.toUpperCase()}_CALLBACK_ON_FRONTEND`];
    if (config !== undefined) {
      return config === 'true';
    }
  }
  
  // Por defecto:
  // - Spotify y LastFM se manejan en frontend
  // - Deezer se maneja en backend
  return ['spotify', 'lastfm'].includes(service.toLowerCase());
}

/**
 * Obtiene la URL de callback para un servicio específico
 * @param service Nombre del servicio ('spotify', 'lastfm', 'deezer')
 * @returns URL completa para el callback del servicio
 */
function getServiceCallbackUrl(service: string): string {
  const upperService = service.toUpperCase();
  const lowerService = service.toLowerCase();
  
  // Verificar si hay una URL específica configurada
  const specificUrl = process.env[`NEXT_PUBLIC_${upperService}_CALLBACK_URL`];
  if (specificUrl) {
    return specificUrl;
  }
  
  // Verificar si hay una ruta específica en producción
  if (process.env.NODE_ENV === 'production') {
    const specificPath = process.env[`NEXT_PUBLIC_${upperService}_CALLBACK_PATH`];
    if (specificPath) {
      // Determinar si debe usar frontend o backend
      const baseUrl = isCallbackOnFrontend(lowerService) ? getBaseUrl() : getBackendBaseUrl();
      return `${baseUrl}${specificPath}`;
    }
  }
  
  // Construir URL con base + ruta por defecto
  // Determinar si debe usar frontend o backend
  const baseUrl = isCallbackOnFrontend(lowerService) ? getBaseUrl() : getBackendBaseUrl();
  return `${baseUrl}/api/auth/${lowerService}/callback`;
}

/**
 * Obtiene la URL de callback para Spotify adaptándose al entorno
 * @returns URL completa para el callback de Spotify
 */
export function getSpotifyCallbackUrl(): string {
  return getServiceCallbackUrl('spotify');
}

/**
 * Obtiene la URL de callback para LastFM adaptándose al entorno
 * @returns URL completa para el callback de LastFM
 */
export function getLastFMCallbackUrl(): string {
  return getServiceCallbackUrl('lastfm');
}

/**
 * Obtiene la URL de callback para Deezer adaptándose al entorno
 * @returns URL completa para el callback de Deezer
 */
export function getDeezerCallbackUrl(): string {
  return getServiceCallbackUrl('deezer');
}

/**
 * Obtiene la URL de login para Spotify adaptándose al entorno
 * @param state Valor de estado para CSRF protection
 * @returns URL completa para la autorización de Spotify
 */
export function getSpotifyAuthUrl(state: string): string {
  const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
  const redirectUri = getSpotifyCallbackUrl();
  
  // Definir los scopes que necesitamos
  const scopes = [
    'user-read-private',
    'user-read-email',
    'user-library-read',
    'playlist-read-private', 
    'playlist-read-collaborative',
    'user-top-read'
  ].join(' ');

  // Construir URL
  return 'https://accounts.spotify.com/authorize' + 
    '?response_type=code' +
    '&client_id=' + encodeURIComponent(clientId || '') +
    '&scope=' + encodeURIComponent(scopes) + 
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&state=' + encodeURIComponent(state);
}

/**
 * Obtiene la URL de login para LastFM adaptándose al entorno
 * @param token Token de autenticación
 * @returns URL completa para la autorización de LastFM
 */
export function getLastFMAuthUrl(token: string): string {
  const apiKey = process.env.LASTFM_API_KEY;
  const redirectUri = getLastFMCallbackUrl();
  
  // Construir URL
  return 'https://www.last.fm/api/auth/' + 
    '?api_key=' + encodeURIComponent(apiKey || '') +
    '&token=' + encodeURIComponent(token) + 
    '&redirect_uri=' + encodeURIComponent(redirectUri);
}

/**
 * Obtiene la URL de login para Deezer adaptándose al entorno
 * @param state Valor de estado para CSRF protection
 * @returns URL completa para la autorización de Deezer
 */
export function getDeezerAuthUrl(state: string): string {
  const appId = process.env.DEEZER_APP_ID;
  const redirectUri = getDeezerCallbackUrl();
  
  // Construir URL
  return 'https://connect.deezer.com/oauth/auth.php' + 
    '?app_id=' + encodeURIComponent(appId || '') +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&perms=basic_access,email,offline_access' + 
    '&state=' + encodeURIComponent(state);
}

/**
 * Obtiene la URL del front para redirigir después del logout
 */
export function getLogoutRedirectUrl(): string {
  return `${getBaseUrl()}/login`;
} 