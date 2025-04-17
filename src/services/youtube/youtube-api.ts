import axios from 'axios';
import { API_CONFIG } from '@/config/api-config';

// Interfaces para los tipos de datos
interface YouTubeThumbnail {
  url: string;
  width: number;
  height: number;
}

interface YouTubeChannelResponse {
  items: Array<{
    id: {
      channelId: string;
    };
    snippet: {
      title: string;
      description: string;
      thumbnails: Record<string, YouTubeThumbnail>;
    };
  }>;
}

interface YouTubeChannelDetailsResponse {
  items: Array<{
    snippet: {
      title: string;
      description: string;
      thumbnails: Record<string, YouTubeThumbnail>;
    };
    statistics?: {
      subscriberCount?: string;
      viewCount?: string;
    };
    brandingSettings?: {
      image?: {
        bannerExternalUrl?: string;
      };
    };
  }>;
}

interface YouTubeVideoSearchResponse {
  items: Array<{
    id: {
      videoId: string;
    };
    snippet: {
      title: string;
      description: string;
      thumbnails: Record<string, YouTubeThumbnail>;
    };
  }>;
}

interface YouTubeVideoDetailsResponse {
  items: Array<{
    id: string;
    snippet: {
      title: string;
      channelId: string;
      channelTitle: string;
      publishedAt: string;
      thumbnails: Record<string, YouTubeThumbnail>;
    };
    statistics?: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
    };
    contentDetails?: {
      duration?: string;
    };
  }>;
}

// Usar la variable de entorno de la API de YouTube
const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_URL = API_CONFIG.YOUTUBE_API_BASE;

/**
 * Busca un artista en YouTube usando la API oficial de YouTube
 * @param artistName Nombre del artista a buscar
 * @returns Información del artista si se encuentra
 */
export async function searchYouTubeArtist(artistName: string) {
  try {
    console.log(`[YouTubeAPI] Buscando artista: "${artistName}"`);
    
    if (!YOUTUBE_API_KEY) {
      console.error('[YouTubeAPI] Error: API key no configurada');
      return {
        success: false,
        error: 'API key de YouTube no configurada'
      };
    }
    
    // Buscar canales con el nombre del artista
    const channelResponse = await axios.get<YouTubeChannelResponse>(`${YOUTUBE_API_URL}/search`, {
      params: {
        part: 'snippet',
        type: 'channel',
        q: `${artistName} official music`,
        maxResults: 3,
        key: YOUTUBE_API_KEY
      }
    });
    
    console.log(`[YouTubeAPI] Respuesta de búsqueda de canales:`, 
      channelResponse.data.items ? 
      `${channelResponse.data.items.length} resultados` : 
      'Sin resultados');

    if (channelResponse.data.items && channelResponse.data.items.length > 0) {
      // Tomar el primer canal que parece ser oficial
      const channel = channelResponse.data.items[0];
      const channelId = channel.id.channelId;
      
      console.log(`[YouTubeAPI] Canal encontrado: ${channel.snippet.title} (ID: ${channelId})`);
      
      // Obtener detalles adicionales del canal
      const channelDetailsResponse = await axios.get<YouTubeChannelDetailsResponse>(`${YOUTUBE_API_URL}/channels`, {
        params: {
          part: 'snippet,statistics,brandingSettings',
          id: channelId,
          key: YOUTUBE_API_KEY
        }
      });
      
      if (channelDetailsResponse.data.items && channelDetailsResponse.data.items.length > 0) {
        const channelDetails = channelDetailsResponse.data.items[0];
        
        // Formatear los datos para que sean compatibles con el formato de artista de YouTube Music
        return {
          success: true,
          artist: {
            browseId: channelId, // El ID del canal de YouTube es compatible con YouTube Music
            title: channelDetails.snippet.title,
            name: channelDetails.snippet.title,
            thumbnails: channelDetails.snippet.thumbnails ? 
              Object.values(channelDetails.snippet.thumbnails).map((thumb: YouTubeThumbnail) => ({
                url: thumb.url,
                width: thumb.width,
                height: thumb.height
              })) : [],
            subscribers: channelDetails.statistics?.subscriberCount || '0',
            description: channelDetails.snippet.description || '',
            banner: channelDetails.brandingSettings?.image?.bannerExternalUrl || '',
            source: 'youtube_api'
          }
        };
      }
    }
    
    console.log(`[YouTubeAPI] No se encontró canal para "${artistName}"`);
    return {
      success: false,
      error: 'No se encontró el canal del artista'
    };
  } catch (error) {
    console.error('[YouTubeAPI] Error buscando artista:', error);
    return {
      success: false,
      error: `Error en la API de YouTube: ${(error as Error).message}`
    };
  }
}

/**
 * Busca videos de un artista específico en YouTube
 * @param artistName Nombre del artista
 * @param limit Número máximo de videos a devolver
 * @returns Lista de videos si se encuentran
 */
export async function searchArtistVideos(artistName: string, limit = 10) {
  try {
    console.log(`[YouTubeAPI] Buscando videos para: "${artistName}"`);
    
    if (!YOUTUBE_API_KEY) {
      return {
        success: false,
        error: 'API key de YouTube no configurada'
      };
    }
    
    const videosResponse = await axios.get<YouTubeVideoSearchResponse>(`${YOUTUBE_API_URL}/search`, {
      params: {
        part: 'snippet',
        type: 'video',
        q: `${artistName} official music video`,
        maxResults: limit,
        key: YOUTUBE_API_KEY,
        videoEmbeddable: true,
        videoSyndicated: true
      }
    });
    
    if (videosResponse.data.items && videosResponse.data.items.length > 0) {
      // Extraer IDs de videos para obtener detalles
      const videoIds = videosResponse.data.items.map((item) => item.id.videoId).join(',');
      
      // Obtener detalles de los videos
      const videoDetailsResponse = await axios.get<YouTubeVideoDetailsResponse>(`${YOUTUBE_API_URL}/videos`, {
        params: {
          part: 'snippet,contentDetails,statistics',
          id: videoIds,
          key: YOUTUBE_API_KEY
        }
      });
      
      if (videoDetailsResponse.data.items && videoDetailsResponse.data.items.length > 0) {
        // Formatear videos en un formato compatible con YouTube Music
        const videos = videoDetailsResponse.data.items.map((video) => ({
          videoId: video.id,
          title: video.snippet.title,
          thumbnails: Object.values(video.snippet.thumbnails).map((thumb: YouTubeThumbnail) => ({
            url: thumb.url,
            width: thumb.width,
            height: thumb.height
          })),
          views: video.statistics?.viewCount ? `${parseInt(video.statistics.viewCount).toLocaleString()} visualizaciones` : 'N/A',
          duration: video.contentDetails?.duration || 'N/A',
          channelId: video.snippet.channelId,
          channelTitle: video.snippet.channelTitle,
          publishedAt: video.snippet.publishedAt
        }));
        
        return {
          success: true,
          results: videos
        };
      }
    }
    
    return {
      success: false,
      error: 'No se encontraron videos'
    };
  } catch (error) {
    console.error('[YouTubeAPI] Error buscando videos:', error);
    return {
      success: false,
      error: `Error en la API de YouTube: ${(error as Error).message}`
    };
  }
}

/**
 * Servicio para interactuar con la API oficial de YouTube
 */

// Interfaces para la respuesta de la API de YouTube
interface YouTubeApiResponse {
  items: YouTubeChannel[];
  nextPageToken?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
}

export interface YouTubeChannel {
  id: {
    kind: string;
    channelId: string;
  };
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      default: { url: string; width: number; height: number };
      medium: { url: string; width: number; height: number };
      high: { url: string; width: number; height: number };
    };
  };
}

/**
 * Busca canales en YouTube que coincidan con el término de búsqueda
 * @param query Término de búsqueda
 * @param maxResults Número máximo de resultados a devolver (por defecto 5)
 * @returns Lista de canales encontrados
 */
export async function searchYouTubeChannels(query: string, maxResults: number = 5): Promise<YouTubeChannel[]> {
  try {
    // Verificar si está configurada la API key
    const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
    if (!apiKey) {
      console.error('[YouTube API] No se ha configurado la API key de YouTube');
      return [];
    }

    // Preparar la URL con los parámetros
    const url = 'https://www.googleapis.com/youtube/v3/search';
    const params = {
      part: 'snippet',
      q: `${query} music artist`,  // Añadimos "music artist" para mejorar resultados
      type: 'channel',
      maxResults,
      key: apiKey
    };

    console.log(`[YouTube API] Buscando canales con término: "${query}"`);
    
    // Realizar la petición a la API
    const response = await axios.get<YouTubeApiResponse>(url, { params });
    
    if (response.data && response.data.items && response.data.items.length > 0) {
      console.log(`[YouTube API] Se encontraron ${response.data.items.length} canales`);
      return response.data.items;
    }
    
    console.log('[YouTube API] No se encontraron canales');
    return [];
  } catch (error) {
    console.error('[YouTube API] Error al buscar canales:', error);
    return [];
  }
}

export default {
  searchYouTubeArtist,
  searchArtistVideos,
  searchYouTubeChannels
}; 