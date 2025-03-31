/**
 * Servicio de YouTube API
 * 
 * Este servicio implementa funciones para interactuar con la API de YouTube
 * con manejo estricto de cuota para evitar exceder los límites diarios.
 */
import axios from 'axios';
import { Track } from '@/types/types';
import { API_TIMEOUTS } from '@/lib/api-config';

// Interfaces para las respuestas de la API de YouTube
export interface YouTubeSearchResponse {
  items: YouTubeVideoItem[];
  nextPageToken?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
}

export interface YouTubeVideoItem {
  id: {
    videoId: string;
  };
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      default: YouTubeThumbnail;
      medium: YouTubeThumbnail;
      high: YouTubeThumbnail;
      standard?: YouTubeThumbnail;
      maxres?: YouTubeThumbnail;
    };
    channelTitle: string;
    publishedAt: string;
  };
}

export interface YouTubeThumbnail {
  url: string;
  width?: number;
  height?: number;
}

export interface YouTubeVideoDetailsResponse {
  items: YouTubeVideoDetailItem[];
}

export interface YouTubeVideoDetailItem {
  id: string;
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    thumbnails: {
      default: YouTubeThumbnail;
      medium: YouTubeThumbnail;
      high: YouTubeThumbnail;
      standard?: YouTubeThumbnail;
      maxres?: YouTubeThumbnail;
    };
  };
  contentDetails: {
    duration: string;
    dimension: string;
    definition: string;
    caption: string;
    licensedContent: boolean;
  };
}

// Clase para el control de cuota
export class YouTubeQuotaManager {
  private static instance: YouTubeQuotaManager;
  private maxDailyQuota: number;
  private usedToday: number;
  private resetTime: Date | null;
  private apiKey: string;
  private requestQueue: { resolve: Function; reject: Function; cost: number; operation: () => Promise<any> }[];
  private isProcessingQueue: boolean;
  private DEBUG: boolean;

  private constructor() {
    this.maxDailyQuota = parseInt(process.env.YOUTUBE_API_LIMIT || '40');
    this.usedToday = 0;
    this.resetTime = this.calculateNextResetTime();
    this.apiKey = process.env.YOUTUBE_API_KEY || '';
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.DEBUG = process.env.DEBUG_QUOTA === 'true';
    
    // Intentar cargar el estado guardado
    this.loadState();
    
    // Guardar estado periódicamente
    setInterval(() => this.saveState(), 5 * 60 * 1000); // Cada 5 minutos
  }

  static getInstance(): YouTubeQuotaManager {
    if (!YouTubeQuotaManager.instance) {
      YouTubeQuotaManager.instance = new YouTubeQuotaManager();
    }
    return YouTubeQuotaManager.instance;
  }

  get apiKeyValue(): string {
    return this.apiKey;
  }
  
  private calculateNextResetTime(): Date {
    const now = new Date();
    // Reset a las 00:00 UTC del día siguiente
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  }
  
  private checkQuotaReset(): void {
    const now = new Date();
    if (this.resetTime && now > this.resetTime) {
      if (this.DEBUG) console.log(`[YouTube Quota] Reseteando cuota diaria de ${this.usedToday} a 0`);
      this.usedToday = 0;
      this.resetTime = this.calculateNextResetTime();
      this.saveState();
    }
  }
  
  private saveState(): void {
    try {
      // Verificar si el estado parece estar bloqueado incorrectamente
      const now = new Date();
      
      // Si ya se ha alcanzado o excedido la cuota pero es un error
      // (la cuota usada supera la cuota máxima diaria), reiniciar el contador
      if (this.usedToday > this.maxDailyQuota || 
          (this.usedToday > 0 && this.resetTime && this.resetTime < now)) {
        console.warn('YouTubeService: Estado de cuota parece incorrecto, reiniciando contador');
        this.usedToday = 0;
        
        // Crear nueva fecha de reinicio (24 horas desde ahora)
        const nextDay = new Date();
        nextDay.setHours(nextDay.getHours() + 24);
        this.resetTime = nextDay;
      }
      
      // Guardar el estado solo si estamos en el navegador
      if (typeof window !== 'undefined' && window.localStorage) {
        const state = {
          usedToday: this.usedToday,
          resetTime: this.resetTime?.toISOString(),
        };
        
        localStorage.setItem('youtubeQuotaState', JSON.stringify(state));
        console.log(`YouTubeService: Estado guardado. Usado hoy: ${this.usedToday}, Reinicio: ${this.resetTime?.toLocaleString()}`);
      }
    } catch (error) {
      console.error('YouTubeService: Error al guardar estado de cuota', error);
    }
  }
  
  private loadState(): void {
    try {
      // Verificar si estamos en el navegador
      if (typeof window === 'undefined' || !window.localStorage) {
        // Si estamos en el servidor, inicializar con valores predeterminados
        this.usedToday = 0;
        const nextDay = new Date();
        nextDay.setHours(nextDay.getHours() + 24);
        this.resetTime = nextDay;
        return;
      }
      
      const stateStr = localStorage.getItem('youtubeQuotaState');
      if (!stateStr) return;
      
      const state = JSON.parse(stateStr);
      
      // Verificar si el tiempo de reinicio ya pasó
      const now = new Date();
      if (state.resetTime) {
        const resetTimeDate = new Date(state.resetTime);
        
        if (resetTimeDate <= now) {
          // Si el tiempo de reinicio ya pasó, reiniciar el contador
          this.usedToday = 0;
          
          // Crear nueva fecha de reinicio (24 horas desde ahora)
          const nextDay = new Date();
          nextDay.setHours(nextDay.getHours() + 24);
          this.resetTime = nextDay;
          
          console.log('YouTubeService: Se reinició el contador de cuota porque pasó el tiempo de reinicio');
        } else {
          // Si los valores parecen estar corruptos (por ejemplo, usedToday excede maxDailyQuota)
          // reiniciar el estado
          if (state.usedToday > this.maxDailyQuota || !state.resetTime) {
            console.warn('YouTubeService: Estado de cuota parece corrupto, reiniciando');
            this.usedToday = 0;
            
            // Crear nueva fecha de reinicio (24 horas desde ahora)
            const nextDay = new Date();
            nextDay.setHours(nextDay.getHours() + 24);
            this.resetTime = nextDay;
          } else {
            // Si todo parece estar bien, cargar los valores
            this.usedToday = state.usedToday;
            this.resetTime = new Date(state.resetTime);
          }
        }
      } else {
        // Si no hay tiempo de reinicio, crear uno nuevo
        this.usedToday = 0;
        const nextDay = new Date();
        nextDay.setHours(nextDay.getHours() + 24);
        this.resetTime = nextDay;
      }
      
      console.log(`YouTubeService: Estado cargado. Usado hoy: ${this.usedToday}, Reinicio: ${this.resetTime?.toLocaleString()}`);
    } catch (error) {
      // Si hay un error al cargar el estado, reiniciar
      console.error('YouTubeService: Error al cargar estado de cuota, reiniciando', error);
      this.usedToday = 0;
      
      // Crear nueva fecha de reinicio (24 horas desde ahora)
      const nextDay = new Date();
      nextDay.setHours(nextDay.getHours() + 24);
      this.resetTime = nextDay;
    }
  }
  
  /**
   * Reinicia manualmente el contador de cuota
   * @returns true si se reinició correctamente, false en caso contrario
   */
  public resetQuotaCounter(): boolean {
    try {
      console.log('YouTubeService: Reiniciando contador de cuota manualmente');
      this.usedToday = 0;
      
      // Crear nueva fecha de reinicio (24 horas desde ahora)
      const nextDay = new Date();
      nextDay.setHours(nextDay.getHours() + 24);
      this.resetTime = nextDay;
      
      // Solo guardar el estado si estamos en el navegador
      if (typeof window !== 'undefined' && window.localStorage) {
        this.saveState();
      }
      return true;
    } catch (error) {
      console.error('YouTubeService: Error al reiniciar contador de cuota', error);
      return false;
    }
  }
  
  /**
   * Verifica si hay suficiente cuota disponible para una operación
   * @param cost Costo en unidades de la operación
   * @returns true si hay cuota disponible
   */
  hasAvailableQuota(cost: number): boolean {
    this.checkQuotaReset();
    return (this.usedToday + cost) <= this.maxDailyQuota;
  }
  
  /**
   * Registra el uso de cuota
   * @param cost Costo en unidades de la operación
   */
  trackUsage(cost: number): void {
    this.usedToday += cost;
    if (this.DEBUG) {
      console.log(`[YouTube Quota] Usado: ${cost} unidades. Total: ${this.usedToday}/${this.maxDailyQuota}`);
    }
    // Solo guardar el estado si estamos en el navegador
    if (typeof window !== 'undefined' && window.localStorage) {
      this.saveState();
    }
  }
  
  /**
   * Encola una operación para ejecutarla si hay cuota disponible
   * @param operation Función que realiza la operación
   * @param cost Costo en unidades de la operación
   * @returns Resultado de la operación
   */
  async enqueueOperation<T>(operation: () => Promise<T>, cost: number = 1): Promise<T> {
    return new Promise((resolve, reject) => {
      // Añadir a la cola
      this.requestQueue.push({ resolve, reject, cost, operation });
      
      // Iniciar procesamiento de cola si no está en curso
      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }
  
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue[0];
      
      // Comprobar si hay cuota disponible
      if (!this.hasAvailableQuota(request.cost)) {
        // Si no hay cuota, esperar hasta el próximo reset
        if (this.DEBUG) {
          const now = new Date();
          const waitTime = this.resetTime ? this.resetTime.getTime() - now.getTime() : 0;
          console.log(`[YouTube Quota] Sin cuota disponible. Esperando ${Math.round(waitTime/1000/60)} minutos para reset.`);
        }
        
        // Rechazar todas las solicitudes pendientes con error de cuota excedida
        this.requestQueue.forEach(req => {
          req.reject(new Error('Quota limit reached for YouTube API'));
        });
        
        this.requestQueue = [];
        break;
      }
      
      // Ejecutar la operación y seguir la cola
      try {
        const result = await request.operation();
        this.trackUsage(request.cost);
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      } finally {
        this.requestQueue.shift(); // Eliminar el elemento procesado
      }
    }
    
    this.isProcessingQueue = false;
  }

  /**
   * Devuelve la cuota utilizada hasta el momento
   * @returns Cantidad de unidades de cuota utilizadas
   */
  getUsedQuota(): number {
    this.checkQuotaReset();
    return this.usedToday;
  }
  
  /**
   * Devuelve el límite máximo de cuota diaria
   * @returns Cantidad máxima de unidades de cuota disponibles por día
   */
  getQuotaLimit(): number {
    return this.maxDailyQuota;
  }
}

/**
 * Servicio principal para interactuar con la API de YouTube
 */
export class YouTubeService {
  private quotaManager: YouTubeQuotaManager;
  private baseUrl: string;
  
  constructor() {
    this.quotaManager = YouTubeQuotaManager.getInstance();
    this.baseUrl = 'https://www.googleapis.com/youtube/v3';
  }
  
  /**
   * Busca videos en YouTube
   * @param query Texto de búsqueda
   * @param maxResults Número máximo de resultados (por defecto 5)
   * @returns Respuesta de búsqueda de YouTube
   */
  async search(query: string, maxResults: number = 5): Promise<YouTubeSearchResponse> {
    try {
      console.log(`[YouTubeService] Buscando: "${query}"`);
      
      // Verificar si hay cuota disponible
      if (!this.quotaManager.hasAvailableQuota(1)) {
        console.warn('[YouTubeService] ⚠️ Cuota de YouTube agotada, usando caché o alternativas');
        throw new Error('Cuota de YouTube agotada');
      }
      
      // Sanitizar la consulta para mejorar los resultados de búsqueda
      const sanitizedQuery = this.sanitizeSearchQuery(query);
      
      // Realizar la operación de búsqueda con el gestor de cuota
      return await this.quotaManager.enqueueOperation(async () => {
        const params = new URLSearchParams({
          part: 'snippet',
          maxResults: maxResults.toString(),
          q: sanitizedQuery + " official", // Añadir "official" para priorizar canales oficiales
          type: 'video',
          videoCategoryId: '10', // Categoría 10 = Música
          videoEmbeddable: 'true',
          videoSyndicated: 'true', // Videos que pueden ser reproducidos fuera de youtube.com
          key: this.quotaManager.apiKeyValue
        });
        
        const response = await axios.get<YouTubeSearchResponse>(
          `${this.baseUrl}/search?${params.toString()}`,
          { timeout: API_TIMEOUTS.YOUTUBE }
        );
        
        console.log(`[YouTubeService] Encontrados ${response.data.items.length} resultados para: "${query}"`);
        
        // Si no hay resultados, intentar una búsqueda más simple
        if (response.data.items.length === 0) {
          console.log(`[YouTubeService] Intentando búsqueda simplificada para: "${query}"`);
          
          // Simplificar aún más la consulta de búsqueda
          const wordsToKeep = sanitizedQuery.split(' ').slice(0, 3).join(' ');
          
          const simpleParams = new URLSearchParams({
            part: 'snippet',
            maxResults: maxResults.toString(),
            q: wordsToKeep + ' audio',
            type: 'video',
            videoCategoryId: '10', // Categoría 10 = Música
            videoEmbeddable: 'true',
            key: this.quotaManager.apiKeyValue
          });
          
          const simpleResponse = await axios.get<YouTubeSearchResponse>(
            `${this.baseUrl}/search?${simpleParams.toString()}`,
            { timeout: API_TIMEOUTS.YOUTUBE }
          );
          
          console.log(`[YouTubeService] Búsqueda simplificada encontró ${simpleResponse.data.items.length} resultados`);
          return simpleResponse.data;
        }
        
        return response.data;
      }, 1); // Costo de cuota: 1 unidad por búsqueda
    } catch (error) {
      console.error(`[YouTubeService] Error en búsqueda:`, error);
      
      // Si hay error, devolver una respuesta vacía con formato correcto
      return {
        items: [],
        pageInfo: {
          totalResults: 0,
          resultsPerPage: 0
        }
      };
    }
  }
  
  /**
   * Sanitiza la consulta de búsqueda para mejorar resultados
   * @param query Consulta original
   * @returns Consulta sanitizada
   */
  private sanitizeSearchQuery(query: string): string {
    if (!query) return '';
    
    return query
      .replace(/\(.*?\)/g, '') // Eliminar contenido entre paréntesis
      .replace(/\[.*?\]/g, '') // Eliminar contenido entre corchetes
      .replace(/feat\.|ft\.|featuring/gi, '') // Eliminar feat, ft, featuring
      .replace(/official\s*(video|audio|music\s*video)/gi, '') // Eliminar palabras como "official video"
      .replace(/lyrics\s*(video)?/gi, '') // Eliminar "lyrics video" o "lyrics"
      .replace(/\s+/g, ' ') // Reemplazar múltiples espacios con uno solo
      .trim();
  }
  
  /**
   * Busca videos en YouTube basados en un término de búsqueda
   * 
   * @param query Término de búsqueda
   * @param maxResults Número máximo de resultados (por defecto 5)
   * @returns Lista de videos encontrados
   */
  async searchVideos(query: string, maxResults: number = 5): Promise<YouTubeSearchResponse> {
    // Costo: 100 unidades por búsqueda
    return this.quotaManager.enqueueOperation(async () => {
      try {
        // Asegurarnos que estamos buscando música
        let enhancedQuery = query;
        if (!query.toLowerCase().includes('music') && 
            !query.toLowerCase().includes('audio') && 
            !query.toLowerCase().includes('canción') && 
            !query.toLowerCase().includes('música')) {
          enhancedQuery = `${query} music`;
        }

        const response = await axios.get(`${this.baseUrl}/search`, {
          params: {
            key: this.quotaManager.apiKeyValue,
            q: enhancedQuery,
            part: 'snippet',
            maxResults,
            type: 'video',
            videoCategoryId: '10', // Música
            videoDefinition: 'high', // Preferir videos de alta definición
            videoEmbeddable: 'true', // Solo videos que se pueden embeber
            regionCode: 'ES', // Preferir contenido para España
          },
          timeout: API_TIMEOUTS.YOUTUBE,
        });
        
        return response.data as YouTubeSearchResponse;
      } catch (error) {
        console.error(`[YouTube] Error al buscar videos: ${query}`, error);
        throw new Error('Error al buscar videos en YouTube');
      }
    }, 100); // Costo de 100 unidades por búsqueda
  }
  
  /**
   * Busca un video específico para una canción
   * 
   * @param trackName Nombre de la canción
   * @param artistName Nombre del artista
   * @returns ID del video de YouTube
   */
  async findVideoForTrack(trackName: string, artistName: string): Promise<string | null> {
    try {
      // Formateamos la consulta para mejorar la probabilidad de encontrar el video oficial
      const query = `${trackName} ${artistName} official audio música`;
      
      // Intentar con términos específicos para música
      const result = await this.searchVideos(query, 3);
      
      if (result.items && result.items.length > 0) {
        // Filtrar posibles videos que no parecen música basados en el título
        const filteredItems = result.items.filter(item => 
          !item.snippet.title.toLowerCase().includes('tutorial') &&
          !item.snippet.title.toLowerCase().includes('gameplay') &&
          !item.snippet.title.toLowerCase().includes('cover') &&
          item.snippet.thumbnails.high?.url
        );
        
        // Si tenemos resultados filtrados, usar el primero
        if (filteredItems.length > 0) {
          return filteredItems[0].id.videoId;
        }
        
        // Si no hay resultados filtrados, usar el primero original
        return result.items[0].id.videoId;
      }
      
      // Si no encontramos resultados, intentar una búsqueda más amplia
      const fallbackQuery = `${trackName} ${artistName} music`;
      const fallbackResults = await this.searchVideos(fallbackQuery, 2);
      
      if (fallbackResults.items && fallbackResults.items.length > 0) {
        return fallbackResults.items[0].id.videoId;
      }
      
      return null;
    } catch (error) {
      console.error(`[YouTube] Error buscando video para: ${trackName} - ${artistName}`, error);
      return null;
    }
  }
  
  /**
   * Convierte tracks genéricos en tracks con IDs de YouTube
   * 
   * @param tracks Lista de tracks a enriquecer
   * @returns Lista de tracks con YouTubeId 
   */
  async enrichTracksWithYouTubeIds(tracks: Track[]): Promise<Track[]> {
    // Verificar si hay cuota suficiente (100 unidades por cada track)
    const requiredQuota = tracks.length * 100;
    
    if (!this.quotaManager.hasAvailableQuota(requiredQuota)) {
      console.warn(`[YouTube] No hay suficiente cuota para enriquecer ${tracks.length} tracks (necesita ${requiredQuota} unidades)`);
      return tracks;
    }
    
    // Procesar tracks en secuencia para no sobrecargar la API
    const enrichedTracks: Track[] = [];
    
    for (const track of tracks) {
      // Saltar si ya tiene ID de YouTube
      if (track.youtubeId) {
        enrichedTracks.push(track);
        continue;
      }
      
      try {
        const youtubeId = await this.findVideoForTrack(track.title, track.artist);
        
        enrichedTracks.push({
          ...track,
          youtubeId: youtubeId || undefined
        });
        
        // Pequeña pausa entre peticiones para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // Si falla, mantener el track original
        enrichedTracks.push(track);
      }
    }
    
    return enrichedTracks;
  }

  /**
   * Obtiene el estado actual de la cuota de YouTube API
   * @returns Objeto con información sobre la cuota disponible
   */
  getQuotaStatus() {
    const quotaManager = this.quotaManager;
    // Se necesitan aproximadamente 100 unidades por track, así que verificamos si hay
    // al menos 500 unidades disponibles para poder enriquecer un batch razonable de tracks
    const MIN_QUOTA_FOR_ENRICH = 500;
    const hasQuota = quotaManager.hasAvailableQuota(1);
    const quotaUsed = quotaManager.getUsedQuota();
    const quotaLimit = quotaManager.getQuotaLimit();
    const quotaRemaining = quotaLimit - quotaUsed;
    
    return {
      hasQuota,
      quotaUsed,
      quotaLimit,
      canEnrichTracks: hasQuota && quotaRemaining >= MIN_QUOTA_FOR_ENRICH
    };
  }

  /**
   * Obtiene detalles detallados de un video por su ID
   * @param videoId ID del video de YouTube
   * @returns Información detallada del video o null en caso de error
   */
  async getVideoDetails(videoId: string): Promise<YouTubeVideoDetailsResponse | null> {
    const cost = 1; // Costo en unidades de cuota
    
    return this.quotaManager.enqueueOperation(async () => {
      try {
        if (!videoId) {
          console.error('[YouTube] Error: videoId es undefined o vacío');
          return null;
        }
        
        const apiKey = this.quotaManager.apiKeyValue;
        const endpoint = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;
        
        const response = await axios.get<YouTubeVideoDetailsResponse>(endpoint, {
          timeout: API_TIMEOUTS.YOUTUBE
        });
        
        return response.data;
      } catch (error) {
        console.error(`[YouTube] Error obteniendo detalles del video ${videoId}:`, error);
        return null;
      }
    }, cost);
  }

  /**
   * Reinicia manualmente el contador de cuota de YouTube
   * Útil cuando el usuario encuentra problemas y quiere resetear el estado
   */
  resetYouTubeQuota(): void {
    this.quotaManager.resetQuotaCounter();
    console.log('Contador de cuota de YouTube reiniciado manualmente');
  }
}

// Exportar instancia del servicio
export const youtubeService = new YouTubeService(); 