/**
 * Gestor de claves API de YouTube con rotación y monitoreo de cuotas
 */

// Interfaz para una entrada de caché
interface CacheEntry {
  data: any;
  timestamp: number;
  expiryTime: number;
}

// Interfaz para una clave API con su información de uso
interface ApiKeyInfo {
  key: string;
  quotaUsed: number;
  lastReset: number;
  enabled: boolean;
  purpose?: 'playback' | 'general'; // Propósito de la clave API
  lastError?: {
    timestamp: number;
    message: string;
  };
}

// Constantes de cuotas y config
const DAILY_QUOTA_LIMIT = 10000; // Límite diario por clave API
const QUOTA_WARNING_THRESHOLD = 8000; // Umbral para advertencia
const CACHE_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutos
const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;

export class YouTubeApiKeyManager {
  private apiKeys: ApiKeyInfo[] = [];
  private currentKeyIndex: number = 0;
  private cache: Map<string, CacheEntry> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private playbackKeyIndex: number = -1; // Índice de la clave dedicada a reproducción
  private initialized: boolean = false;

  constructor() {
    this.startCacheCleanup();
    this.tryAutoInitialize();
  }

  /**
   * Intenta inicializar automáticamente las claves API
   * utilizando datos de window.YOUTUBE_API_KEYS o variables de entorno públicas
   */
  private tryAutoInitialize(): void {
    // Solo en el cliente intentamos la auto-inicialización
    if (typeof window !== 'undefined') {
      console.log('[YouTubeApiKeyManager] Intentando auto-inicialización en el cliente...');

      // Intentar usar las claves expuestas en window.YOUTUBE_API_KEYS
      setTimeout(() => {
        if (this.apiKeys.length === 0) {
          try {
            // @ts-ignore - Ignoramos error de TS porque window.YOUTUBE_API_KEYS es una variable global
            const windowKeys = window.YOUTUBE_API_KEYS;

            if (Array.isArray(windowKeys) && windowKeys.length > 0) {
              console.log(`[YouTubeApiKeyManager] Encontradas ${windowKeys.length} claves API en window.YOUTUBE_API_KEYS`);
              this.initialize(windowKeys);
              return;
            }
          } catch (error) {
            console.warn('[YouTubeApiKeyManager] Error accediendo a window.YOUTUBE_API_KEYS:', error);
          }

          // Si no hay claves en window, intentar con variables de entorno públicas
          this.initializeFromPublicEnv();
        }
      }, 500); // Pequeño retraso para asegurar que el script en layout.tsx se ha ejecutado
    }
  }

  /**
   * Inicializa claves API desde variables de entorno públicas
   */
  private initializeFromPublicEnv(): void {
    const keys: string[] = [];

    // Buscar múltiples claves con formato NEXT_PUBLIC_YOUTUBE_API_KEY_1, etc.
    for (let i = 1; i <= 10; i++) {
      // @ts-ignore - process.env puede no tener el índice como propiedad
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

    // Si encontramos claves, inicializar el gestor
    if (keys.length > 0) {
      console.log(`[YouTubeApiKeyManager] Auto-inicializando con ${keys.length} claves de variables de entorno públicas`);
      this.initialize(keys);
    } else {
      console.warn('[YouTubeApiKeyManager] No se encontraron claves API en variables de entorno públicas');

      // En modo desarrollo, usar claves hardcodeadas como último recurso
      if (process.env.NODE_ENV === 'development') {
        console.warn('[YouTubeApiKeyManager] Usando claves hardcodeadas como último recurso (solo para desarrollo)');
        this.initialize([
          'AIzaSyAFJS9N9SnuaVDqLpl7DzLJKB3L_0KUgCA',
          'AIzaSyDaug75f3CFe8aTea_JAinNOmO22Th2QGo'
        ]);
      }
    }
  }

  /**
   * Inicializa el gestor con múltiples claves API
   * @param keys - Array de claves API
   * @param playbackKeyIndex - Índice de la clave que se usará exclusivamente para reproducción (opcional)
   */
  public initialize(keys: string[], playbackKeyIndex?: number): void {
    if (!keys || keys.length === 0) {
      throw new Error('Se requiere al menos una clave API de YouTube');
    }

    this.apiKeys = keys.map((key, index) => ({
      key,
      quotaUsed: 0,
      lastReset: Date.now(),
      enabled: true,
      purpose: playbackKeyIndex === index ? 'playback' : 'general'
    }));

    // Si se especifica un índice para reproducción, guardarlo
    if (playbackKeyIndex !== undefined && playbackKeyIndex >= 0 && playbackKeyIndex < keys.length) {
      this.playbackKeyIndex = playbackKeyIndex;
      console.log(`YouTubeApiKeyManager: Clave #${playbackKeyIndex + 1} reservada para reproducción de música`);
    } else if (keys.length > 1) {
      // Si hay más de una clave y no se especifica un índice, usar la última clave para reproducción
      this.playbackKeyIndex = keys.length - 1;
      this.apiKeys[this.playbackKeyIndex].purpose = 'playback';
      console.log(`YouTubeApiKeyManager: Última clave (${keys.length}) reservada para reproducción de música`);
    }

    console.log(`YouTubeApiKeyManager: Inicializado con ${keys.length} claves API`);
    this.initialized = true;
  }

  /**
   * Ejecuta una función con una clave API, gestionando automáticamente la rotación y errores
   * @param fn - Función a ejecutar con la clave API
   * @param cacheKey - Clave para cachear el resultado
   * @param forPlayback - Indica si la operación es para reproducción de música
   * @returns - Resultado de la función
   */
  public async withApiKey<T>(
    fn: (apiKey: string, cacheKey: string) => Promise<T>,
    cacheKey: string,
    forPlayback: boolean = false
  ): Promise<T> {
    // Si no hay claves disponibles, intentar auto-inicializar
    if (this.apiKeys.length === 0) {
      // Intentar inicializar una última vez
      if (!this.initialized) {
        this.tryAutoInitialize();
      }

      // Esperar un momento para ver si se pudieron cargar claves
      if (this.apiKeys.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Si aún no hay claves, lanzar error
      if (this.apiKeys.length === 0) {
        throw new Error('No hay claves API de YouTube configuradas');
      }
    }

    // Intentar con diferentes claves hasta que una funcione
    let attempts = 0;
    const maxAttempts = this.apiKeys.length;

    while (attempts < maxAttempts) {
      const keyInfo = forPlayback
        ? this.getPlaybackKey()
        : this.getNextAvailableKey(forPlayback);

      if (!keyInfo) {
        throw new Error('No hay claves API disponibles. Todas han alcanzado el límite de cuota o están deshabilitadas');
      }

      try {
        const result = await fn(keyInfo.key, cacheKey);
        return result;
      } catch (error: any) {
        const statusCode = error.response?.status;

        // Manejar errores específicos de la API
        if (statusCode === 403 || statusCode === 429) {
          console.warn(`Clave API ${this.maskApiKey(keyInfo.key)} llegó al límite de cuota o fue rechazada. Deshabilitando.`);
          this.disableKey(keyInfo.key, error.message);
        } else if (statusCode === 400) {
          console.error(`Error de solicitud con clave API ${this.maskApiKey(keyInfo.key)}: ${error.message}`);
          // No deshabilitar la clave para errores de solicitud
          throw error;
        } else {
          console.error(`Error con clave API ${this.maskApiKey(keyInfo.key)}: ${error.message}`);
          // Para otros errores, intentar con otra clave
        }

        attempts++;
      }
    }

    throw new Error('Todos los intentos con diferentes claves API han fallado');
  }

  /**
   * Obtiene la clave API dedicada para reproducción de música
   * @returns - Información de la clave para reproducción
   */
  private getPlaybackKey(): ApiKeyInfo | null {
    // Si hay una clave dedicada para reproducción
    if (this.playbackKeyIndex >= 0 && this.playbackKeyIndex < this.apiKeys.length) {
      const keyInfo = this.apiKeys[this.playbackKeyIndex];

      // Verificar si está habilitada
      if (keyInfo.enabled) {
        return keyInfo;
      }

      // Si la clave de reproducción está deshabilitada, registrar advertencia
      console.warn('La clave API dedicada para reproducción está deshabilitada, usando clave general como fallback');
    }

    // Si no hay clave dedicada o está deshabilitada, buscar cualquier clave disponible
    return this.getNextAvailableKey(false);
  }

  /**
   * Actualiza el uso de cuota para una clave API
   * @param apiKey - Clave API
   * @param units - Unidades de cuota usadas
   */
  public updateQuotaUsage(apiKey: string, units: number): void {
    const keyInfo = this.apiKeys.find(k => k.key === apiKey);
    if (!keyInfo) return;

    // Verificar si es un nuevo día y resetear la cuota si es necesario
    const now = Date.now();
    if (now - keyInfo.lastReset >= MILLISECONDS_IN_DAY) {
      keyInfo.quotaUsed = 0;
      keyInfo.lastReset = now;

      // Si la clave estaba deshabilitada por cuota, habilitarla nuevamente
      if (keyInfo.lastError && keyInfo.lastError.message.includes('quota')) {
        keyInfo.enabled = true;
        delete keyInfo.lastError;
      }
    }

    // Actualizar el uso de cuota
    keyInfo.quotaUsed += units;

    // Verificar si se alcanzó el límite
    if (keyInfo.quotaUsed >= DAILY_QUOTA_LIMIT) {
      keyInfo.enabled = false;
      keyInfo.lastError = {
        timestamp: now,
        message: `Cuota diaria excedida (${keyInfo.quotaUsed}/${DAILY_QUOTA_LIMIT})`
      };
      console.warn(`La clave API ${this.maskApiKey(apiKey)} ha excedido su cuota diaria.`);

      // Si es la clave de reproducción, mostrar advertencia especial
      if (keyInfo.purpose === 'playback') {
        console.error('⚠️ LA CLAVE DE REPRODUCCIÓN HA EXCEDIDO SU CUOTA. LA FUNCIONALIDAD DE REPRODUCCIÓN PUEDE VERSE AFECTADA.');
      }
    } else if (keyInfo.quotaUsed >= QUOTA_WARNING_THRESHOLD) {
      console.warn(`Advertencia: La clave API ${this.maskApiKey(apiKey)} está cerca de su límite de cuota (${keyInfo.quotaUsed}/${DAILY_QUOTA_LIMIT})`);
    }
  }

  /**
   * Guarda un resultado en caché
   * @param key - Clave del caché
   * @param data - Datos a guardar
   * @param expiryTime - Tiempo de expiración en ms
   */
  public setCachedResult(key: string, data: any, expiryTime: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiryTime
    });
  }

  /**
   * Obtiene un resultado del caché si existe y no ha expirado
   * @param key - Clave del caché
   * @returns - Datos del caché o undefined
   */
  public getCachedResult(key: string): any {
    const entry = this.cache.get(key);

    if (!entry) return undefined;

    const now = Date.now();
    if (now - entry.timestamp > entry.expiryTime) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  /**
   * Inicia el proceso de limpieza periódica del caché
   */
  private startCacheCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupCache();
    }, CACHE_CLEANUP_INTERVAL);
  }

  /**
   * Limpia entradas expiradas del caché
   */
  private cleanupCache(): void {
    const now = Date.now();
    let expiredCount = 0;

    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      if (now - entry.timestamp > entry.expiryTime) {
        this.cache.delete(key);
        expiredCount++;
      }
    });

    if (expiredCount > 0) {
      console.log(`Caché limpiado: ${expiredCount} entradas expiradas eliminadas.`);
    }
  }

  /**
   * Obtiene la siguiente clave disponible para usar
   * @param excludePlaybackKey - Si es true, excluye la clave de reproducción
   */
  private getNextAvailableKey(excludePlaybackKey: boolean = true): ApiKeyInfo | null {
    // Verificar si hay alguna clave habilitada
    const availableKeys = this.apiKeys.filter(k => {
      // Excluir la clave de reproducción si se solicita
      const isPlaybackKey = this.playbackKeyIndex >= 0 && k === this.apiKeys[this.playbackKeyIndex];
      return k.enabled && !(excludePlaybackKey && isPlaybackKey);
    });

    if (availableKeys.length === 0) return null;

    // Buscar la siguiente clave disponible usando rotación
    for (let i = 0; i < this.apiKeys.length; i++) {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      const keyInfo = this.apiKeys[this.currentKeyIndex];

      // Verificar si esta clave está disponible y no es la de reproducción (si debe excluirse)
      const isPlaybackKey = this.playbackKeyIndex >= 0 && this.currentKeyIndex === this.playbackKeyIndex;
      if (keyInfo.enabled && !(excludePlaybackKey && isPlaybackKey)) {
        return keyInfo;
      }
    }

    return null;
  }

  /**
   * Deshabilita una clave API
   * @param apiKey - Clave a deshabilitar
   * @param reason - Razón de la deshabilitación
   */
  private disableKey(apiKey: string, reason: string): void {
    const keyInfo = this.apiKeys.find(k => k.key === apiKey);
    if (!keyInfo) return;

    keyInfo.enabled = false;
    keyInfo.lastError = {
      timestamp: Date.now(),
      message: reason
    };
  }

  /**
   * Enmascara una clave API para mostrarla en logs
   * @param apiKey - Clave API completa
   * @returns - Clave enmascarada (solo primeros y últimos 4 caracteres)
   */
  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) return '****';
    return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
  }

  /**
   * Obtiene estadísticas de uso de las claves API
   * @returns - Estadísticas formateadas
   */
  public getApiKeysStatus(): any {
    return {
      totalKeys: this.apiKeys.length,
      enabledKeys: this.apiKeys.filter(k => k.enabled).length,
      disabledKeys: this.apiKeys.filter(k => !k.enabled).length,
      playbackKeyIndex: this.playbackKeyIndex,
      keysStatus: this.apiKeys.map((k, index) => ({
        key: this.maskApiKey(k.key),
        purpose: k.purpose || 'general',
        isPlaybackKey: index === this.playbackKeyIndex,
        quotaUsed: k.quotaUsed,
        enabled: k.enabled,
        lastError: k.lastError
      }))
    };
  }
}

// Exportar una instancia singleton
export const apiKeyManager = new YouTubeApiKeyManager();
