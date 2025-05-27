/**
 * Sistema de caché isomórfico
 *
 * Proporciona una implementación de caché que funciona tanto en el navegador
 * como en el servidor, utilizando estrategias diferentes según el entorno.
 */

// Detección de entorno: navegador vs servidor
export const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

// Tiempo de vida por defecto para datos en caché (4 horas en segundos)
export const DEFAULT_CACHE_TTL = 4 * 60 * 60;

// Habilitar logs detallados (desactivado por defecto)
export const ENABLE_CACHE_DEBUG = false;

// Caché en memoria para todos los entornos
interface MemoryCacheItem {
  value: string;
  expires: number;
}

interface MemoryCache {
  [key: string]: MemoryCacheItem;
}

// Caché en memoria global
const memCache: MemoryCache = {};

// Registro de solicitudes para detección de patrones
interface RequestLog {
  [key: string]: {
    timestamp: number;
    count: number;
  }
}

const recentRequests: RequestLog = {};

/**
 * Clase para manejar la caché de forma isomórfica
 */
class IsomorphicCache {
  // Contador de fallos de caché para diagnóstico
  private cacheMisses = 0;

  /**
   * Obtiene un valor de la caché
   * @param key Clave de búsqueda
   * @param allowExpired Si es true, devuelve valores expirados (como fallback)
   * @returns Valor almacenado o null si no existe o expiró
   */
  async get(key: string, allowExpired: boolean = false): Promise<string | null> {
    try {
      // Registrar solicitud para detección de duplicados
      this.logRequest(key);

      // Buscar en la caché en memoria
      const now = Date.now();
      const memoryItem = memCache[key];

      if (memoryItem) {
        // Si existe en caché
        if (memoryItem.expires > now || allowExpired) {
          // Devolver valor si está vigente o se permiten expirados
          if (memoryItem.expires < now && allowExpired) {
            // Log solo si usamos un valor expirado
            if (ENABLE_CACHE_DEBUG) {
            }
          }
          return memoryItem.value;
        }
      }

      // Si estamos en el navegador, también podríamos buscar en localStorage
      // pero eso sería una implementación adicional opcional

      this.cacheMisses++;
      return null;
    } catch (error) {
      console.error('[IsomorphicCache] Error obteniendo valor:', error);
      this.cacheMisses++;
      return null;
    }
  }

  /**
   * Almacena un valor en la caché
   * @param key Clave para almacenar
   * @param value Valor a almacenar
   * @param ttl Tiempo de vida en segundos
   */
  async set(key: string, value: string, ttl: number = DEFAULT_CACHE_TTL): Promise<void> {
    try {
      const now = Date.now();
      const expires = now + (ttl * 1000);

      // Guardar en memoria
      memCache[key] = { value, expires };

      // Si estamos en el navegador, podríamos guardar en localStorage también
      // pero eso sería una implementación adicional opcional

      // Limpieza periódica
      this.periodicCleanup();
    } catch (error) {
      console.error('[IsomorphicCache] Error almacenando valor:', error);
    }
  }

  /**
   * Elimina una clave de la caché
   * @param key Clave a eliminar
   */
  async delete(key: string): Promise<void> {
    try {
      delete memCache[key];
    } catch (error) {
      console.error('[IsomorphicCache] Error eliminando clave:', error);
    }
  }

  /**
   * Limpia entradas expiradas de la caché periódicamente
   */
  private periodicCleanup(): void {
    // Solo limpiar ocasionalmente (10% de probabilidad)
    if (Math.random() > 0.1) return;

    const now = Date.now();
    let expiredCount = 0;

    // Limpiar caché en memoria
    for (const key in memCache) {
      if (memCache[key].expires < now) {
        delete memCache[key];
        expiredCount++;
      }
    }

    // Limpiar registro de solicitudes antiguas
    for (const key in recentRequests) {
      if (now - recentRequests[key].timestamp > 60 * 1000) { // Más de 1 minuto
        delete recentRequests[key];
      }
    }

    if (expiredCount > 0 && ENABLE_CACHE_DEBUG) {
    }

    // Si hay demasiadas entradas, eliminar las más antiguas
    const maxEntries = 100;
    const keys = Object.keys(memCache);

    if (keys.length > maxEntries) {
      const entriesToRemove = keys.length - maxEntries;

      // Ordenar por tiempo de expiración (los que expiran antes primero)
      const sortedKeys = keys.sort((a, b) => memCache[a].expires - memCache[b].expires);

      // Eliminar las entradas más antiguas
      for (let i = 0; i < entriesToRemove; i++) {
        delete memCache[sortedKeys[i]];
      }

      if (ENABLE_CACHE_DEBUG) {
      }
    }
  }

  /**
   * Registra una solicitud para detectar patrones de uso
   * @param key Clave solicitada
   */
  private logRequest(key: string): void {
    const now = Date.now();

    if (!recentRequests[key]) {
      recentRequests[key] = { timestamp: now, count: 1 };
      return;
    }

    // Incrementar contador y actualizar timestamp
    recentRequests[key].count++;
    recentRequests[key].timestamp = now;

    // Detectar patrones de solicitudes excesivas (más de 5 en menos de 10 segundos)
    // Este log siempre se mostrará ya que es una advertencia importante
    if (recentRequests[key].count > 5 &&
        now - recentRequests[key].timestamp < 10000) {
      console.warn(`[IsomorphicCache] Detección de solicitudes duplicadas excesivas: ${key}`);
    }
  }

  /**
   * Obtiene estadísticas de la caché
   */
  getStats(): { cacheMisses: number } {
    return { cacheMisses: this.cacheMisses };
  }
}

// Instancia única exportada
export const isomorphicCache = new IsomorphicCache();

export default isomorphicCache;
