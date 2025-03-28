/**
 * Servicio de YouTube Music API
 * 
 * Este servicio implementa funciones específicas para música usando la API de YouTube.
 * Se basa en las prácticas de ytmusicapi para ofrecer funcionalidades similares.
 */
import { youtubeService } from './youtube-service';
import { YouTubeVideoItem, YTMusicResult, mapToYTMusic } from './index';
import { Track } from '@/types/types';
import { recommendationsCache } from '@/lib/cache';
import youtubeMusicAPI from './youtube-music-api';

// Géneros musicales para categorización
const MUSIC_GENRES = [
  'pop', 'rock', 'hip hop', 'rap', 'latin', 'r&b', 'jazz',
  'electronic', 'dance', 'indie', 'classical', 'metal', 'folk', 'country'
];

// Términos que indican música en varios idiomas
const MUSIC_TERMS = ['music', 'música', 'canción', 'song', 'audio', 'oficial', 'official'];

// Categorías de mood para YouTube Music
const MOOD_CATEGORIES = {
  'energy': ['workout', 'enérgico', 'energetic', 'dance'],
  'chill': ['relax', 'chill', 'calm', 'peaceful'],
  'focus': ['focus', 'concentration', 'study', 'concentrate'],
  'party': ['party', 'fiesta', 'dance', 'club'],
  'romance': ['romantic', 'love', 'passion', 'sensual']
};

class YouTubeMusicService {
  /**
   * Verifica si el servicio está disponible
   * @returns true si YouTube Music API está disponible
   */
  isAvailable(): boolean {
    return youtubeMusicAPI.isAvailable();
  }

  /**
   * Busca canciones en YouTube Music utilizando términos optimizados
   * @param query Consulta de búsqueda
   * @param limit Número máximo de resultados
   * @returns Lista de canciones en formato de YouTube Music
   */
  async searchSongs(query: string, limit: number = 10): Promise<YTMusicResult[]> {
    try {
      // Primero verificar si el servicio está disponible
      const isAvailable = await youtubeMusicAPI.isAvailable();
      if (!isAvailable) {
        console.warn('[YouTubeMusic] Servicio no disponible');
        return [];
      }
      
      // Detectar si el query ya incluye términos musicales
      const hasGenre = MUSIC_GENRES.some(genre => query.toLowerCase().includes(genre));
      const hasMusicTerm = MUSIC_TERMS.some(term => query.toLowerCase().includes(term));
      
      // Optimizar la consulta para mejores resultados musicales
      let enhancedQuery = query;
      
      if (!hasGenre && !hasMusicTerm) {
        enhancedQuery = `${query} music`;
      }
      
      // Usar la API de YouTube Music 
      const musicResults = await youtubeMusicAPI.searchTracks(enhancedQuery, limit * 2);
      
      if (!musicResults || musicResults.length === 0) {
        return [];
      }
      
      // Convertir el formato de YouTube Music API a YTMusicResult
      const ytMusicResults: YTMusicResult[] = musicResults.map(item => ({
        videoId: item.id || item.videoId,
        title: item.title,
        artist: item.artist || '',
        album: item.album || '',
        thumbnails: [
          { 
            url: item.thumbnail || (item.thumbnails && item.thumbnails[0]?.url) || '',
            width: item.thumbnails?.[0]?.width || 120,  // Valor predeterminado
            height: item.thumbnails?.[0]?.height || 90   // Valor predeterminado
          }
        ],
        duration: item.duration || 0
      })).slice(0, limit);
      
      return ytMusicResults;
    } catch (error) {
      console.error('[YouTubeMusic] Error buscando canciones:', 
        error instanceof Error ? error.message : 'Error desconocido');
      return [];
    }
  }
  
  /**
   * Convierte resultados de YouTube Music a formato de Track de la aplicación
   * @param ytmusicResults Resultados de YouTube Music
   * @returns Lista de tracks
   */
  toTracks(ytmusicResults: YTMusicResult[]): Track[] {
    return ytmusicResults.map(item => ({
      id: item.videoId,
      title: item.title,
      artist: item.artist,
      album: item.album || 'YouTube Music',
      cover: item.thumbnails[0]?.url || '',
      duration: item.duration || 0,
      source: 'youtube',
      youtubeId: item.videoId
    }));
  }
  
  /**
   * Busca recomendaciones musicales basadas en un género
   * @param genre Género musical
   * @param limit Número máximo de resultados
   * @returns Lista de tracks recomendados
   */
  async getRecommendationsByGenre(genre: string, limit: number = 10): Promise<Track[]> {
    const cacheKey = `ytmusic:genre:${genre}:${limit}`;
    
    try {
      // Verificar caché
      const cached = await recommendationsCache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      // Construir consulta basada en género
      const query = genre.startsWith('genre:') 
        ? genre.substring(6) // Extraer género si viene con prefijo
        : genre;
      
      // Usar la API de YouTube Music directamente
      const enhancedQuery = `${query} music playlist`;
      const ytResults = await youtubeMusicAPI.searchSongs(enhancedQuery, limit);
      // Convertir directamente a formato Track sin la doble conversión
      const tracks = youtubeMusicAPI.toTracks(ytResults);
      
      // Guardar en caché
      if (tracks.length > 0) {
        await recommendationsCache.set(cacheKey, JSON.stringify(tracks), 60 * 60 * 24); // 24 horas
      }
      
      return tracks;
    } catch (error) {
      console.error(`[YouTubeMusic] Error obteniendo recomendaciones para género ${genre}:`, error);
      return [];
    }
  }
  
  /**
   * Busca canciones similares a una canción dada
   * @param trackName Nombre de la canción
   * @param artistName Nombre del artista
   * @param limit Número máximo de resultados
   * @returns Lista de tracks similares
   */
  async getSimilarSongs(trackName: string, artistName: string, limit: number = 10): Promise<Track[]> {
    try {
      // Intentar primero con API de YouTube Music
      const track = await youtubeMusicAPI.findTrack(trackName, artistName);
      
      if (track) {
        // Si se encontró el track, convertirlo a Track
        const tracks = youtubeMusicAPI.toTracks([track]);
        
        // Buscar recomendaciones similares
        const query = `${trackName} ${artistName} similar songs`;
        const similarSongs = await youtubeMusicAPI.searchSongs(query, limit);
        const similarTracks = youtubeMusicAPI.toTracks(similarSongs);
        
        // Combinar con el track original y devolver
        return [...tracks, ...similarTracks].slice(0, limit);
      }
      
      // Como fallback, usar searchSongs
      const query = `${trackName} ${artistName} similar songs`;
      const ytResults = await this.searchSongs(query, limit);
      return this.toTracks(ytResults);
    } catch (error) {
      console.error(`[YouTubeMusic] Error obteniendo canciones similares a ${trackName}:`, error);
      return [];
    }
  }
  
  /**
   * Obtiene tracks populares de YouTube Music
   * @param limit Número máximo de resultados
   * @returns Lista de tracks populares
   */
  async getTopTracks(limit: number = 20): Promise<Track[]> {
    const cacheKey = `ytmusic:top:${limit}`;
    
    try {
      // Verificar caché
      const cached = await recommendationsCache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      // Intentar obtener recomendaciones directamente de YouTube Music API
      const recommendations = await youtubeMusicAPI.getRecommendations(limit);
      
      if (recommendations && recommendations.length > 0) {
        const tracks = youtubeMusicAPI.toTracks(recommendations);
        
        // Guardar en caché
        await recommendationsCache.set(cacheKey, JSON.stringify(tracks), 60 * 60 * 4); // 4 horas
        
        return tracks;
      }
      
      // Como fallback, usar searchSongs con términos para top charts
      const queries = [
        'top songs this week',
        'canciones más populares',
        'top charts music'
      ];
      
      // Seleccionar query aleatorio
      const randomQuery = queries[Math.floor(Math.random() * queries.length)];
      const ytResults = await this.searchSongs(randomQuery, limit);
      const tracks = this.toTracks(ytResults);
      
      // Guardar en caché
      if (tracks.length > 0) {
        await recommendationsCache.set(cacheKey, JSON.stringify(tracks), 60 * 60 * 4); // 4 horas
      }
      
      return tracks;
    } catch (error) {
      console.error('[YouTubeMusic] Error obteniendo top tracks:', error);
      return [];
    }
  }
  
  /**
   * Obtiene recomendaciones basadas en estado de ánimo (mood)
   * @param mood Categoría de estado de ánimo
   * @param limit Número máximo de resultados
   * @returns Lista de tracks para el mood solicitado
   */
  async getRecommendationsByMood(mood: string, limit: number = 15): Promise<Track[]> {
    const cacheKey = `ytmusic:mood:${mood}:${limit}`;
    
    try {
      // Verificar caché
      const cached = await recommendationsCache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      // Obtener términos de búsqueda para el mood
      let searchTerms: string[] = [];
      
      if (mood in MOOD_CATEGORIES) {
        searchTerms = MOOD_CATEGORIES[mood as keyof typeof MOOD_CATEGORIES];
      } else {
        // Si el mood no está en las categorías predefinidas, usarlo directamente
        searchTerms = [mood];
      }
      
      // Seleccionar un término aleatorio
      const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
      const query = `${randomTerm} music playlist`;
      
      // Usar directamente YouTube Music API
      const ytResults = await youtubeMusicAPI.searchSongs(query, limit);
      const tracks = youtubeMusicAPI.toTracks(ytResults);
      
      // Guardar en caché
      if (tracks.length > 0) {
        await recommendationsCache.set(cacheKey, JSON.stringify(tracks), 60 * 60 * 12); // 12 horas
      }
      
      return tracks;
    } catch (error) {
      console.error(`[YouTubeMusic] Error obteniendo recomendaciones para mood ${mood}:`, error);
      return [];
    }
  }
  
  /**
   * Obtiene información detallada sobre un track específico
   * @param videoId ID de video de YouTube
   * @returns Track con información detallada o null si no se encuentra
   */
  async getTrackDetails(videoId: string): Promise<Track | null> {
    try {
      const videoDetails = await youtubeService.getVideoDetails(videoId);
      
      if (!videoDetails || videoDetails.items.length === 0) {
        return null;
      }
      
      const videoItem = videoDetails.items[0];
      const ytMusic = mapToYTMusic({
        id: { videoId: videoItem.id },
        snippet: {
          title: videoItem.snippet.title,
          description: videoItem.snippet.description,
          channelTitle: videoItem.snippet.channelTitle,
          thumbnails: videoItem.snippet.thumbnails,
          publishedAt: new Date().toISOString()
        }
      });
      
      const tracks = this.toTracks([ytMusic]);
      return tracks[0] || null;
    } catch (error) {
      console.error(`[YouTubeMusic] Error obteniendo detalles para video ${videoId}:`, error);
      return null;
    }
  }
}

// Exportar instancia singleton
export const youtubeMusic = new YouTubeMusicService(); 