import axios from 'axios';
import { apiKeyManager } from './youtube-api-keys';

/**
 * Servicio para realizar llamadas a la API de YouTube
 */
export class YouTubeApiService {
  private static readonly BASE_URL = 'https://www.googleapis.com/youtube/v3';
  
  /**
   * Busca videos en YouTube
   * @param query - Término de búsqueda
   * @param maxResults - Número máximo de resultados (por defecto 10)
   * @returns - Respuesta de la API
   */
  public static async searchVideos(query: string, maxResults = 10): Promise<any> {
    return apiKeyManager.withApiKey(async (apiKey, cacheKey) => {
      const cacheResult = apiKeyManager.getCachedResult(cacheKey);
      if (cacheResult) return cacheResult;
      
      const params = {
        part: 'snippet',
        maxResults,
        q: query,
        type: 'video',
        key: apiKey,
      };
      
      const response = await axios.get(`${this.BASE_URL}/search`, { params });
      apiKeyManager.setCachedResult(cacheKey, response.data, 3600000); // Caché por 1 hora
      apiKeyManager.updateQuotaUsage(apiKey, 100); // Búsqueda = 100 unidades
      
      return response.data;
    }, `search_${query}_${maxResults}`);
  }
  
  /**
   * Obtiene detalles de un video específico
   * @param videoId - ID del video
   * @param parts - Partes de la respuesta a incluir
   * @returns - Respuesta de la API
   */
  public static async getVideoDetails(videoId: string, parts = 'snippet,contentDetails,statistics'): Promise<any> {
    return apiKeyManager.withApiKey(async (apiKey, cacheKey) => {
      const cacheResult = apiKeyManager.getCachedResult(cacheKey);
      if (cacheResult) return cacheResult;
      
      const params = {
        part: parts,
        id: videoId,
        key: apiKey,
      };
      
      const response = await axios.get(`${this.BASE_URL}/videos`, { params });
      apiKeyManager.setCachedResult(cacheKey, response.data, 3600000); // Caché por 1 hora
      apiKeyManager.updateQuotaUsage(apiKey, 1); // Video details = 1 unidad
      
      return response.data;
    }, `video_${videoId}_${parts}`);
  }
  
  /**
   * Obtiene videos relacionados con un videoId específico
   * @param videoId - ID del video
   * @param maxResults - Número máximo de resultados
   * @returns - Respuesta de la API
   */
  public static async getRelatedVideos(videoId: string, maxResults = 10): Promise<any> {
    return apiKeyManager.withApiKey(async (apiKey, cacheKey) => {
      const cacheResult = apiKeyManager.getCachedResult(cacheKey);
      if (cacheResult) return cacheResult;
      
      const params = {
        part: 'snippet',
        maxResults,
        relatedToVideoId: videoId,
        type: 'video',
        key: apiKey,
      };
      
      const response = await axios.get(`${this.BASE_URL}/search`, { params });
      apiKeyManager.setCachedResult(cacheKey, response.data, 1800000); // Caché por 30 minutos
      apiKeyManager.updateQuotaUsage(apiKey, 100); // Búsqueda = 100 unidades
      
      return response.data;
    }, `related_${videoId}_${maxResults}`);
  }
  
  /**
   * Busca playlists en YouTube
   * @param query - Término de búsqueda
   * @param maxResults - Número máximo de resultados
   * @returns - Respuesta de la API
   */
  public static async searchPlaylists(query: string, maxResults = 10): Promise<any> {
    return apiKeyManager.withApiKey(async (apiKey, cacheKey) => {
      const cacheResult = apiKeyManager.getCachedResult(cacheKey);
      if (cacheResult) return cacheResult;
      
      const params = {
        part: 'snippet',
        maxResults,
        q: query,
        type: 'playlist',
        key: apiKey,
      };
      
      const response = await axios.get(`${this.BASE_URL}/search`, { params });
      apiKeyManager.setCachedResult(cacheKey, response.data, 3600000); // Caché por 1 hora
      apiKeyManager.updateQuotaUsage(apiKey, 100); // Búsqueda = 100 unidades
      
      return response.data;
    }, `playlists_${query}_${maxResults}`);
  }
  
  /**
   * Obtiene videos de una playlist específica
   * @param playlistId - ID de la playlist
   * @param maxResults - Número máximo de resultados
   * @returns - Respuesta de la API
   */
  public static async getPlaylistItems(playlistId: string, maxResults = 50): Promise<any> {
    return apiKeyManager.withApiKey(async (apiKey, cacheKey) => {
      const cacheResult = apiKeyManager.getCachedResult(cacheKey);
      if (cacheResult) return cacheResult;
      
      const params = {
        part: 'snippet,contentDetails',
        maxResults,
        playlistId,
        key: apiKey,
      };
      
      const response = await axios.get(`${this.BASE_URL}/playlistItems`, { params });
      apiKeyManager.setCachedResult(cacheKey, response.data, 1800000); // Caché por 30 minutos
      apiKeyManager.updateQuotaUsage(apiKey, 1); // PlaylistItems = 1 unidad
      
      return response.data;
    }, `playlist_items_${playlistId}_${maxResults}`);
  }
  
  /**
   * Obtiene detalles de un canal de YouTube
   * @param channelId - ID del canal
   * @returns - Respuesta de la API
   */
  public static async getChannelDetails(channelId: string): Promise<any> {
    return apiKeyManager.withApiKey(async (apiKey, cacheKey) => {
      const cacheResult = apiKeyManager.getCachedResult(cacheKey);
      if (cacheResult) return cacheResult;
      
      const params = {
        part: 'snippet,statistics,brandingSettings',
        id: channelId,
        key: apiKey,
      };
      
      const response = await axios.get(`${this.BASE_URL}/channels`, { params });
      apiKeyManager.setCachedResult(cacheKey, response.data, 86400000); // Caché por 24 horas
      apiKeyManager.updateQuotaUsage(apiKey, 1); // Channel details = 1 unidad
      
      return response.data;
    }, `channel_${channelId}`);
  }
}

export default YouTubeApiService; 