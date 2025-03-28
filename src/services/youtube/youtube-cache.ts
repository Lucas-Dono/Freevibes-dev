/**
 * Caché especializado para la API de YouTube
 * 
 * Este módulo implementa un sistema de caché para guardar resultados de
 * consultas a la API de YouTube y reducir el uso de la cuota diaria.
 */
import { searchCache, trackCache } from '@/lib/cache';

// TTL más largo para YouTube por su límite estricto
const YOUTUBE_SEARCH_TTL = 7 * 24 * 60 * 60 * 1000; // 7 días
const YOUTUBE_TRACK_TTL = 30 * 24 * 60 * 60 * 1000; // 30 días
const DEBUG = process.env.DEBUG_YOUTUBE_CACHE === 'true';

/**
 * Clase para gestionar el caché de YouTube
 */
export class YouTubeCache {
  private static instance: YouTubeCache;
  
  private constructor() {}
  
  static getInstance(): YouTubeCache {
    if (!YouTubeCache.instance) {
      YouTubeCache.instance = new YouTubeCache();
    }
    return YouTubeCache.instance;
  }
  
  /**
   * Guarda resultados de búsqueda en caché
   * 
   * @param query Consulta realizada
   * @param maxResults Número máximo de resultados solicitados
   * @param data Datos devueltos por la API
   */
  async cacheSearchResults(query: string, maxResults: number, data: any): Promise<void> {
    try {
      const cacheKey = this.getSearchCacheKey(query, maxResults);
      await searchCache.set(cacheKey, JSON.stringify(data), YOUTUBE_SEARCH_TTL);
      
      if (DEBUG) console.log(`[YouTube Cache] Guardada búsqueda: "${query}" (${maxResults} resultados)`);
    } catch (error) {
      console.error(`[YouTube Cache] Error guardando búsqueda: ${query}`, error);
    }
  }
  
  /**
   * Obtiene resultados de búsqueda desde caché
   * 
   * @param query Consulta a buscar
   * @param maxResults Número máximo de resultados
   * @returns Datos de la caché o null si no existen
   */
  async getCachedSearchResults(query: string, maxResults: number): Promise<any | null> {
    try {
      const cacheKey = this.getSearchCacheKey(query, maxResults);
      const cachedData = await searchCache.get(cacheKey);
      
      if (cachedData) {
        if (DEBUG) console.log(`[YouTube Cache] Hit para búsqueda: "${query}"`);
        return JSON.parse(cachedData);
      }
      
      if (DEBUG) console.log(`[YouTube Cache] Miss para búsqueda: "${query}"`);
      return null;
    } catch (error) {
      console.error(`[YouTube Cache] Error recuperando búsqueda: ${query}`, error);
      return null;
    }
  }
  
  /**
   * Guarda la asociación entre canción y video de YouTube
   * 
   * @param trackName Nombre de la canción
   * @param artistName Nombre del artista
   * @param youtubeId ID del video de YouTube
   */
  async cacheTrackVideo(trackName: string, artistName: string, youtubeId: string | null): Promise<void> {
    try {
      const cacheKey = this.getTrackCacheKey(trackName, artistName);
      await trackCache.set(cacheKey, JSON.stringify({ youtubeId }), YOUTUBE_TRACK_TTL);
      
      if (DEBUG) console.log(`[YouTube Cache] Guardada asociación de track: "${trackName} - ${artistName}" -> ${youtubeId || 'null'}`);
    } catch (error) {
      console.error(`[YouTube Cache] Error guardando track: ${trackName} - ${artistName}`, error);
    }
  }
  
  /**
   * Obtiene el ID de video de YouTube para una canción desde caché
   * 
   * @param trackName Nombre de la canción
   * @param artistName Nombre del artista
   * @returns ID del video o null si no está en caché
   */
  async getCachedTrackVideo(trackName: string, artistName: string): Promise<string | null> {
    try {
      const cacheKey = this.getTrackCacheKey(trackName, artistName);
      const cachedData = await trackCache.get(cacheKey);
      
      if (cachedData) {
        const data = JSON.parse(cachedData);
        if (data.youtubeId) {
          if (DEBUG) console.log(`[YouTube Cache] Hit para track: "${trackName} - ${artistName}"`);
          return data.youtubeId;
        }
        
        // Si el valor es explícitamente null (indicando que ya intentamos y no encontramos)
        if (data.youtubeId === null) {
          if (DEBUG) console.log(`[YouTube Cache] Hit para track (sin video): "${trackName} - ${artistName}"`);
          return null;
        }
      }
      
      if (DEBUG) console.log(`[YouTube Cache] Miss para track: "${trackName} - ${artistName}"`);
      return null;
    } catch (error) {
      console.error(`[YouTube Cache] Error recuperando track: ${trackName} - ${artistName}`, error);
      return null;
    }
  }
  
  /**
   * Genera una clave única para la búsqueda
   */
  private getSearchCacheKey(query: string, maxResults: number): string {
    return `youtube_search:${query.toLowerCase().trim()}:${maxResults}`;
  }
  
  /**
   * Genera una clave única para el track
   */
  private getTrackCacheKey(trackName: string, artistName: string): string {
    return `youtube_track:${artistName.toLowerCase().trim()}:${trackName.toLowerCase().trim()}`;
  }
  
  /**
   * Busca coincidencias aproximadas en caché para un track
   * 
   * @param trackName Nombre de la canción
   * @param artistName Nombre del artista
   * @returns Mejor coincidencia encontrada o null
   */
  async findSimilarTrackInCache(trackName: string, artistName: string): Promise<string | null> {
    try {
      // Intentar con variaciones de nombres
      // 1. Probar quitando sufijos como "(Original Mix)", etc.
      let normalizedTrackName = trackName
        .replace(/ ?\(.*?\)$/, '')  // Eliminar texto entre paréntesis al final
        .replace(/ ?- .*$/, '')     // Eliminar texto después de guión
        .trim();
      
      // Probar con el nombre normalizado
      if (normalizedTrackName !== trackName) {
        const result = await this.getCachedTrackVideo(normalizedTrackName, artistName);
        if (result) return result;
      }
      
      // 2. Probar solo con las primeras palabras del título (hasta 4)
      const trackWords = trackName.split(' ');
      if (trackWords.length > 4) {
        const shortTrackName = trackWords.slice(0, 4).join(' ');
        const result = await this.getCachedTrackVideo(shortTrackName, artistName);
        if (result) return result;
      }
      
      return null;
    } catch (error) {
      console.error(`[YouTube Cache] Error buscando similares: ${trackName} - ${artistName}`, error);
      return null;
    }
  }
}

// Exportar instancia del caché
export const youtubeCache = YouTubeCache.getInstance(); 