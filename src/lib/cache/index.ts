/**
 * Sistema de caché centralizado
 * Proporciona una interfaz común para diferentes implementaciones de caché
 */

import { LocalCache } from './local-cache';

/**
 * Interfaz común para todas las implementaciones de caché
 */
export interface CacheInterface {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
}

/**
 * Clase para caché en Redis
 * Esta implementación se activaría en producción cuando tengamos la URL de Redis configurada
 */
class RedisCache implements CacheInterface {
  private fallbackCache: LocalCache;

  constructor() {
    this.fallbackCache = new LocalCache();

    // Aquí configurariamos Redis si tuviéramos la URL
  }

  async get(key: string): Promise<string | null> {
    return this.fallbackCache.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    return this.fallbackCache.set(key, value, ttl);
  }

  async del(key: string): Promise<void> {
    return this.fallbackCache.del(key);
  }
}

// Exportamos una instancia de caché según el entorno
// Por ahora, utilizamos LocalCache en todos los entornos
export const recommendationsCache: CacheInterface = new LocalCache();

// TTL por defecto para recomendaciones (24 horas)
export const DEFAULT_CACHE_TTL = 24 * 60 * 60 * 1000;
