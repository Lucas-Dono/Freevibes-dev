/**
 * Sistema de priorización para API keys de YouTube
 *
 * Este módulo asegura que siempre existan claves API disponibles
 * para la reproducción de música, incluso si otras operaciones
 * agotan las cuotas de las claves de menor prioridad.
 */

import { apiKeyManager } from './youtube-api-keys';

// Tipos de operaciones soportadas
export enum OperationType {
  // Operaciones de alta prioridad (reproducción musical)
  MUSIC_PLAYBACK = 'music_playback',

  // Operaciones de media prioridad
  SEARCH = 'search',

  // Operaciones de baja prioridad
  RECOMMENDATIONS = 'recommendations',
  EXPLORE = 'explore',
  GENRES = 'genres',
  ARTIST_INFO = 'artist_info',
  PLAYLIST_INFO = 'playlist_info'
}

// Configuración del porcentaje de claves reservadas para cada tipo de operación
const PRIORITY_CONFIG = {
  // Reservar el 60% de las claves para reproducción
  [OperationType.MUSIC_PLAYBACK]: 0.6,

  // Reservar el 25% para búsquedas
  [OperationType.SEARCH]: 0.25,

  // El 15% restante para otras operaciones
  [OperationType.RECOMMENDATIONS]: 0.05,
  [OperationType.EXPLORE]: 0.03,
  [OperationType.GENRES]: 0.03,
  [OperationType.ARTIST_INFO]: 0.02,
  [OperationType.PLAYLIST_INFO]: 0.02
};

// Configuración de cuota máxima para usar por cada tipo de operación
const QUOTA_LIMITS = {
  [OperationType.MUSIC_PLAYBACK]: 8000, // Reproducción puede usar hasta 8000 unidades
  [OperationType.SEARCH]: 1500,         // Búsquedas pueden usar hasta 1500 unidades
  [OperationType.RECOMMENDATIONS]: 500,
  [OperationType.EXPLORE]: 300,
  [OperationType.GENRES]: 300,
  [OperationType.ARTIST_INFO]: 200,
  [OperationType.PLAYLIST_INFO]: 200
};

// Cuota usada actualmente por cada tipo de operación (se reinicia cada día)
let quotaUsed = Object.keys(OperationType).reduce((acc, key) => {
  acc[key] = 0;
  return acc;
}, {} as Record<string, number>);

// Última fecha de reinicio de cuotas
let lastResetDate = new Date();

/**
 * Reinicia los contadores de cuota si ha pasado un día desde el último reinicio
 */
function checkAndResetQuotas(): void {
  const now = new Date();
  const dayDifference = Math.floor((now.getTime() - lastResetDate.getTime()) / (1000 * 60 * 60 * 24));

  if (dayDifference >= 1) {
    // Reiniciar contadores
    quotaUsed = Object.keys(OperationType).reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {} as Record<string, number>);

    lastResetDate = now;
    console.log('[APIPriority] Contadores de cuota reiniciados');
  }
}

/**
 * Ejecuta una función con una clave API específica para un tipo de operación
 * @param fn - Función a ejecutar con la clave API
 * @param operationType - Tipo de operación a realizar
 * @param cacheKey - Clave para el caché
 * @returns Resultado de la función
 */
export async function executeWithPriority<T>(
  fn: (apiKey: string) => Promise<T>,
  operationType: OperationType,
  cacheKey: string
): Promise<T> {
  checkAndResetQuotas();

  // Verificar si se ha excedido la cuota para esta operación
  const currentQuota = quotaUsed[operationType] || 0;
  const quotaLimit = QUOTA_LIMITS[operationType] || 500;

  if (currentQuota >= quotaLimit) {
    console.warn(`[APIPriority] Cuota excedida para operación ${operationType}: ${currentQuota}/${quotaLimit}`);
    throw new Error(`Cuota diaria excedida para operación ${operationType}`);
  }

  // Ejecutar la función con el administrador de claves API
  return apiKeyManager.withApiKey(async (apiKey: string) => {
    const result = await fn(apiKey);

    // Actualizar la cuota usada
    // La cantidad depende del tipo de operación
    let quotaIncrement = 1;

    switch (operationType) {
      case OperationType.SEARCH:
        quotaIncrement = 100; // Las búsquedas cuestan 100 unidades
        break;
      case OperationType.MUSIC_PLAYBACK:
        quotaIncrement = 1; // La reproducción cuesta 1 unidad
        break;
      case OperationType.RECOMMENDATIONS:
        quotaIncrement = 50; // Recomendaciones cuestan 50 unidades
        break;
      default:
        quotaIncrement = 10; // Otras operaciones cuestan 10 unidades
    }

    quotaUsed[operationType] = (quotaUsed[operationType] || 0) + quotaIncrement;
    console.log(`[APIPriority] Operación ${operationType} - Cuota actual: ${quotaUsed[operationType]}/${quotaLimit}`);

    return result;
  }, cacheKey);
}

/**
 * Obtiene estadísticas sobre el uso de cuota actual
 * @returns Estadísticas de uso de cuota
 */
export function getQuotaStatistics(): any {
  return {
    quotaByOperation: { ...quotaUsed },
    quotaLimits: { ...QUOTA_LIMITS },
    lastReset: lastResetDate.toISOString(),
    apiKeyStatus: apiKeyManager.getApiKeysStatus()
  };
}

export default {
  executeWithPriority,
  OperationType,
  getQuotaStatistics
};
