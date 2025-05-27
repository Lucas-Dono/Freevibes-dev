/**
 * Implementación de caché local en memoria
 * Esta clase proporciona una implementación básica de caché que almacena datos en memoria
 * con soporte para TTL (Time-To-Live)
 */

interface CacheItem {
  value: string;
  expires?: number;
}

export class LocalCache {
  private cache: Map<string, CacheItem> = new Map();

  /**
   * Obtiene un valor del caché
   * @param key Clave a recuperar
   * @returns Valor almacenado o null si no existe o ha expirado
   */
  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key);

    if (!item) return null;

    // Si el elemento ha expirado, eliminarlo y devolver null
    if (item.expires && item.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Almacena un valor en el caché
   * @param key Clave a almacenar
   * @param value Valor a almacenar
   * @param ttl Tiempo de vida en milisegundos (opcional)
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    this.cache.set(key, {
      value,
      expires: ttl ? Date.now() + ttl : undefined
    });
  }

  /**
   * Elimina un valor del caché
   * @param key Clave a eliminar
   */
  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * Elimina todos los valores expirados del caché
   * @returns Número de elementos eliminados
   */
  cleanup(): number {
    const now = Date.now();
    let count = 0;

    this.cache.forEach((item, key) => {
      if (item.expires && item.expires < now) {
        this.cache.delete(key);
        count++;
      }
    });

    return count;
  }

  /**
   * Limpia todo el caché
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Obtiene el número de elementos en el caché
   */
  size(): number {
    return this.cache.size;
  }
}
