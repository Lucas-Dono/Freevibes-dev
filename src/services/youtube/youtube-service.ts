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
    if (typeof localStorage !== 'undefined') {
      try {
        const state = {
          usedToday: this.usedToday,
          resetTime: this.resetTime?.toISOString()
        };
        localStorage.setItem('youtube_quota_state', JSON.stringify(state));
      } catch (error) {
        console.error('[YouTube Quota] Error guardando estado', error);
      }
    }
  }
  
  private loadState(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const savedState = localStorage.getItem('youtube_quota_state');
        if (savedState) {
          const state = JSON.parse(savedState);
          this.usedToday = state.usedToday || 0;
          if (state.resetTime) {
            const resetTime = new Date(state.resetTime);
            // Solo cargar si el tiempo de reset es en el futuro
            if (resetTime > new Date()) {
              this.resetTime = resetTime;
            } else {
              // Si ya pasó, crear uno nuevo y resetear la cuota
              this.resetTime = this.calculateNextResetTime();
              this.usedToday = 0;
            }
          }
          if (this.DEBUG) console.log(`[YouTube Quota] Estado cargado: ${this.usedToday}/${this.maxDailyQuota} unidades`);
        }
      } catch (error) {
        console.error('[YouTube Quota] Error cargando estado', error);
      }
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
    this.saveState();
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
}

// Exportar instancia del servicio
export const youtubeService = new YouTubeService(); 