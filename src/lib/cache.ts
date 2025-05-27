/**
 * Sistema de caché para datos de recomendaciones
 *
 * Utiliza un enfoque isomórfico para funcionar tanto en el navegador como en el servidor.
 * Mantiene una capa de compatibilidad para el código existente.
 */
import { isomorphicCache, DEFAULT_CACHE_TTL as ISO_CACHE_TTL } from './isomorphic-cache';

// Re-exportar la constante de TTL por defecto para mantener compatibilidad
export const DEFAULT_CACHE_TTL = ISO_CACHE_TTL;

// Cache inteligente con TTL adaptativo basado en el tipo de contenido
const ADAPTIVE_TTL = {
  // Datos que cambian con frecuencia
  search: 60 * 30, // 30 minutos
  recent: 60 * 15, // 15 minutos

  // Datos que cambian con menos frecuencia
  recommendations: 60 * 60 * 2, // 2 horas
  genres: 60 * 60 * 12, // 12 horas
  artists: 60 * 60 * 6, // 6 horas
  playlists: 60 * 60 * 4, // 4 horas

  // Datos que rara vez cambian
  albums: 60 * 60 * 24, // 24 horas
  tracks: 60 * 60 * 24, // 24 horas

  // Fallback
  default: ISO_CACHE_TTL // 4 horas por defecto
};

/**
 * Adaptador para el sistema de caché existente
 * Utiliza internamente la implementación isomórfica
 */
class RecommendationsCache {
  /**
   * Obtiene un valor de la caché
   * @param key Clave de búsqueda
   * @param allowExpired Si es true, devuelve valores expirados (como fallback)
   * @returns Valor almacenado o null si no existe o expiró
   */
  async get(key: string, allowExpired: boolean = false): Promise<string | null> {
    return isomorphicCache.get(key, allowExpired);
  }

  /**
   * Determina el TTL óptimo basado en el tipo de contenido
   * @param key Clave de caché
   * @param ttl TTL solicitado (opcional)
   * @returns TTL adaptado al tipo de contenido
   */
  private getAdaptiveTTL(key: string, ttl?: number): number {
    // Si se proporciona un TTL explícito, usarlo
    if (ttl !== undefined) return ttl;

    // Extraer el tipo de contenido de la clave
    const keyParts = key.split(':');
    if (keyParts.length > 0) {
      const contentType = keyParts[0];
      // @ts-ignore: índice dinámico
      return ADAPTIVE_TTL[contentType] || ADAPTIVE_TTL.default;
    }

    return ADAPTIVE_TTL.default;
  }

  /**
   * Almacena un valor en la caché con TTL adaptativo basado en el tipo de contenido
   * @param key Clave para almacenar
   * @param value Valor a almacenar
   * @param ttl Tiempo de vida explícito en segundos (opcional)
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    const adaptiveTTL = this.getAdaptiveTTL(key, ttl);
    return isomorphicCache.set(key, value, adaptiveTTL);
  }

  /**
   * Elimina una clave de la caché
   * @param key Clave a eliminar
   */
  async delete(key: string): Promise<void> {
    return isomorphicCache.delete(key);
  }

  /**
   * Obtiene estadísticas de uso de la caché
   */
  getStats(): { cacheMisses: number } {
    return isomorphicCache.getStats();
  }
}

// Instancia única exportada
export const recommendationsCache = new RecommendationsCache();

// Instancias adicionales para mantener compatibilidad con código existente
// Todas comparten la misma implementación subyacente
export const searchCache = new RecommendationsCache();
export const trackCache = new RecommendationsCache();
export const artistCache = new RecommendationsCache();
export const genreCache = new RecommendationsCache();

export default recommendationsCache;
