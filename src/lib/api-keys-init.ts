/**
 * Inicialización de claves API
 *
 * Este archivo se encarga de inicializar las claves API de YouTube
 * asignando una clave específica para reproducción de música.
 */

import { apiKeyManager } from '@/services/youtube/youtube-api-keys';

/**
 * Inicializa el gestor de claves API con la configuración correcta
 * @returns {boolean} - true si la inicialización fue exitosa
 */
export function initializeApiKeys(): boolean {
  try {
    // Recuperar las claves API del entorno
    const apiKeys = getApiKeysFromEnv();

    if (!apiKeys || apiKeys.length === 0) {
      console.error('[APIKeys] No se encontraron claves API en las variables de entorno');
      // Usar claves fijas para desarrollo en caso de que fallen las variables de entorno
      if (typeof window !== 'undefined') {
        console.warn('[APIKeys] Usando claves de respaldo para cliente');

        // En entorno cliente, usar claves de respaldo para desarrollo
        // NOTA: Estas claves son solo para desarrollo y deberían reemplazarse en producción
        const fallbackKeys = [
          'AIzaSyAFJS9N9SnuaVDqLpl7DzLJKB3L_0KUgCA',
          'AIzaSyDaug75f3CFe8aTea_JAinNOmO22Th2QGo'
        ];

        apiKeyManager.initialize(fallbackKeys, 0);
        console.log(`[APIKeys] Claves de respaldo inicializadas: ${fallbackKeys.length}`);
        return true;
      }
      return false;
    }

    // Si hay más de una clave, asignar la última a reproducción
    // Si solo hay una, se usará para todo
    const playbackKeyIndex = apiKeys.length > 1 ? apiKeys.length - 1 : 0;

    // Inicializar el gestor de claves API
    apiKeyManager.initialize(apiKeys, playbackKeyIndex);

    console.log(`[APIKeys] Claves API inicializadas. Total: ${apiKeys.length}, Índice para reproducción: ${playbackKeyIndex}`);
    return true;
  } catch (error) {
    console.error('[APIKeys] Error al inicializar claves API:', error);
    return false;
  }
}

/**
 * Obtiene las claves API de las variables de entorno
 * @returns {string[]} - Array de claves API
 */
function getApiKeysFromEnv(): string[] {
  const keys: string[] = [];

  // En el navegador, priorizar las claves públicas NEXT_PUBLIC
  const isClient = typeof window !== 'undefined';

  if (isClient) {
    // En el cliente, intentar acceder a las claves mediante window.ENV si está disponible
    // o variables de entorno NEXT_PUBLIC

    // Buscar múltiples claves con formato NEXT_PUBLIC_YOUTUBE_API_KEY_1, etc.
    for (let i = 1; i <= 10; i++) {
      const key = process.env[`NEXT_PUBLIC_YOUTUBE_API_KEY_${i}`];
      if (key) {
        keys.push(key);
      }
    }

    // Si no hay claves específicas, intentar con la clave general pública
    if (keys.length === 0) {
      const singleKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
      if (singleKey) {
        keys.push(singleKey);
      }
    }

    // Para desarrollo, usar claves codificadas si no se encontraron en entorno
    if (keys.length === 0 && process.env.NODE_ENV === 'development') {
      console.warn('[APIKeys] No se encontraron claves API en variables públicas, usando valores codificados para desarrollo');
      keys.push('AIzaSyAFJS9N9SnuaVDqLpl7DzLJKB3L_0KUgCA');
      keys.push('AIzaSyDaug75f3CFe8aTea_JAinNOmO22Th2QGo');
    }
  } else {
    // En el servidor, usar las variables de entorno normales

    // Clave única (para retrocompatibilidad)
    const singleKey = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
    if (singleKey) {
      keys.push(singleKey);
    }

    // Buscar múltiples claves con formato YOUTUBE_API_KEY_1, YOUTUBE_API_KEY_2, etc.
    for (let i = 1; i <= 10; i++) {
      const key = process.env[`YOUTUBE_API_KEY_${i}`] || process.env[`NEXT_PUBLIC_YOUTUBE_API_KEY_${i}`];
      if (key) {
        keys.push(key);
      }
    }

    // Clave específica para reproducción (si existe)
    const playbackKey = process.env.YOUTUBE_API_KEY_PLAYBACK || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY_PLAYBACK;
    if (playbackKey) {
      // Agregar esta clave al final, será la dedicada para reproducción
      keys.push(playbackKey);
    }
  }

  // Log sobre el entorno y claves encontradas
  console.log(`[APIKeys] Ambiente: ${isClient ? 'CLIENTE' : 'SERVIDOR'}, Claves encontradas: ${keys.length}`);

  // Eliminar duplicados usando Array.from en lugar del operador spread
  return Array.from(new Set(keys));
}

// Exportar una versión inicializada
export const apiKeysInitialized = initializeApiKeys();

// Re-inicializar en el cliente si es necesario
if (typeof window !== 'undefined') {
  // Este bloque se ejecuta solo en el navegador
  setTimeout(() => {
    // Verificar si hay claves configuradas
    const status = apiKeyManager.getApiKeysStatus();

    if (status.totalKeys === 0) {
      console.warn('[APIKeys] No se detectaron claves API en el cliente, reinicializando...');
      initializeApiKeys();
    }
  }, 1000); // Pequeño retraso para asegurarse de que las variables de entorno estén cargadas
}
