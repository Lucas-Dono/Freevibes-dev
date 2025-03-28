import { Track } from '@/types/types';
import * as spotifyService from '@/services/spotify';
import { youtubeMusic } from "@/services/youtube";
import { VALID_GENRES } from '@/lib/genres';
import { 
  YouTubeSearchResponse, 
  YouTubeVideoItem 
} from '@/services/youtube';
import { YouTubeMusicAPI } from "../youtube/youtube-music-api";
import { recommendationsCache } from "@/lib/cache";
import { getMultiSourceTrackDetails } from "./multi-source-recommender";
import { ENABLE_CACHE_DEBUG } from "@/lib/isomorphic-cache";

/**
 * Servicio recomendador híbrido que combina resultados de Spotify y YouTube
 */
export const hybridRecommender = {
  /**
   * Obtiene recomendaciones basadas en un género específico
   * combinando resultados de Spotify (90%) y YouTube (10%)
   */
  async getRecommendationsByGenre(genre: string, limit = 50): Promise<Track[]> {
    if (!VALID_GENRES.includes(genre)) {
      console.warn(`El género ${genre} no es válido. Utilizando 'pop' como valor predeterminado.`);
      genre = 'pop';
    }

    const spotifyLimit = Math.floor(limit * 0.9); // 90% de los resultados de Spotify
    const youtubeLimit = Math.ceil(limit * 0.1); // 10% de los resultados de YouTube

    try {
      // Obtener recomendaciones de Spotify
      const spotifyPromise = spotifyService.getRecommendationsByGenre(genre, spotifyLimit);
      
      // Validar el género para evitar buscar con "genre:canción completa"
      // Un género normalmente no contiene espacios ni caracteres especiales
      const isValidGenre = /^[a-zA-Z0-9-&]+$/.test(genre.trim());
      const searchQuery = isValidGenre ? `genre:${genre}` : genre;
      console.log(`Usando query de búsqueda para YouTube Music: ${searchQuery}`);
      
      // Obtener canciones de YouTube Music API usando search() que sí existe
      const youtubePromise = youtubeMusic.getRecommendationsByGenre(genre, youtubeLimit);
      
      // Esperar a que ambas promesas se resuelvan
      const [spotifyTracks, youtubeResults] = await Promise.all([spotifyPromise, youtubePromise]);
      
      // Transformar los resultados de YouTube Music a objetos Track
      // Como no tenemos toTracks, creamos manualmente los objetos Track
      const youtubeTracks: Track[] = youtubeResults.map((item: any) => ({
        id: item.id || item.videoId,
        title: item.title,
        artist: item.artist,
        album: item.album || 'YouTube Music',
        cover: item.thumbnail,
        duration: item.duration || 0,
        source: 'youtube',
        youtubeId: item.id || item.videoId
      }));
      
      // Combinar y mezclar los resultados
      return this.shuffleResults([...spotifyTracks, ...youtubeTracks], limit);
    } catch (error) {
      console.error('Error al obtener recomendaciones híbridas:', error);
      
      // Si falla, intentamos obtener solo de Spotify como fallback
      try {
        return await spotifyService.getRecommendationsByGenre(genre, limit);
      } catch (fallbackError) {
        console.error('Error en el fallback a Spotify:', fallbackError);
        return [];
      }
    }
  },

  /**
   * Limpia el título del video eliminando términos comunes como "Official Video", "Lyrics", etc.
   */
  cleanVideoTitle(title: string): string {
    return title
      .replace(/\(Official Video\)/gi, '')
      .replace(/\(Official Music Video\)/gi, '')
      .replace(/\(Official Audio\)/gi, '')
      .replace(/\(Lyrics\)/gi, '')
      .replace(/\[Lyrics\]/gi, '')
      .replace(/\(Lyric Video\)/gi, '')
      .replace(/\(Visualizer\)/gi, '')
      .replace(/\(Audio\)/gi, '')
      .replace(/\(Video\)/gi, '')
      .replace(/\(HD\)/gi, '')
      .replace(/\(HQ\)/gi, '')
      .replace(/\(4K\)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  /**
   * Extrae el nombre del artista del título del video de YouTube
   */
  extractArtistFromTitle(title: string): string {
    // Patrones comunes de título de YouTube: "Artista - Título" o "Título - Artista"
    const dashPattern = /(.+)\s+-\s+(.+)/;
    const match = title.match(dashPattern);
    
    if (match) {
      // Asumimos que el formato es "Artista - Título"
      return match[1].trim();
    }
    
    // Si no podemos determinar el artista, devolvemos el canal como artista
    return '';
  },

  /**
   * Mezcla los resultados de ambas fuentes y limita al número solicitado
   */
  shuffleResults(tracks: Track[], limit: number): Track[] {
    // Implementación simple de Fisher-Yates shuffle
    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }
    
    // Limitar al número solicitado
    return tracks.slice(0, limit);
  }
};

export default hybridRecommender;

// Estructura para caché en memoria de recomendaciones por género
interface GenreRecommendationsCache {
  [key: string]: {
    timestamp: number;
    tracks: Track[];
  }
}

// Caché en memoria para recomendaciones por género
const genreRecommendationsCache: GenreRecommendationsCache = {};

// TTL para la caché: 30 minutos
const GENRE_CACHE_TTL = 30 * 60 * 1000;

/**
 * Valida si un texto es un género musical válido
 * @param text Texto a validar
 * @returns true si es un género válido
 */
export function isValidGenre(text: string): boolean {
  // Si viene con prefijo 'genre:', extraer el género
  const genre = text.startsWith('genre:') 
    ? text.substring(6).toLowerCase().trim()
    : text.toLowerCase().trim();
  
  // Verificar contra lista de géneros válidos
  return VALID_GENRES.some(validGenre => 
    validGenre.toLowerCase() === genre
  );
}

/**
 * Recomendador híbrido que combina resultados de múltiples fuentes
 * Especializado en recomendaciones por género musical
 */
export class HybridRecommender {
  private youtubeMusicAPI: YouTubeMusicAPI;

  constructor() {
    this.youtubeMusicAPI = new YouTubeMusicAPI();
  }

  /**
   * Obtiene recomendaciones de pistas por género musical
   * Combina resultados de Spotify y YouTube Music
   * @param genre Género musical
   * @param limit Máximo número de resultados
   * @returns Lista de pistas recomendadas
   */
  async getRecommendationsByGenre(genre: string, limit: number = 20): Promise<Track[]> {
    try {
      // Validar que sea un género real antes de buscar
      if (!isValidGenre(genre)) {
        console.log(`[HybridRecommender] "${genre}" no parece ser un género válido`);
        
        // Si no es un género válido, buscar como una canción o artista normal
        return this.getMultiSourceRecommendations(genre, limit);
      }
      
      // Normalizar el género para la caché
      const normalizedGenre = genre.toLowerCase().trim();
      const cacheKey = `hybrid:genre:${normalizedGenre}:${limit}`;
      
      // Verificar caché en memoria (más rápida)
      const now = Date.now();
      const memCached = genreRecommendationsCache[cacheKey];
      
      if (memCached && (now - memCached.timestamp < GENRE_CACHE_TTL)) {
        // Solo mostrar log si se habilita el debug
        if (ENABLE_CACHE_DEBUG) {
          console.log(`[HybridRecommender] Usando caché en memoria para género "${genre}"`);
        }
        return memCached.tracks;
      }
      
      // Verificar caché persistente
      try {
        const cachedData = await recommendationsCache.get(cacheKey);
        if (cachedData) {
          const tracks = JSON.parse(cachedData);
          
          // Actualizar también la caché en memoria
          genreRecommendationsCache[cacheKey] = {
            timestamp: now,
            tracks
          };
          
          // Solo mostrar log si se habilita el debug
          if (ENABLE_CACHE_DEBUG) {
            console.log(`[HybridRecommender] Usando caché persistente para género "${genre}"`);
          }
          return tracks;
        }
      } catch (cacheError) {
        console.warn(`[HybridRecommender] Error accediendo a caché para "${genre}":`, cacheError);
      }
      
      // Este log se mantiene porque es una búsqueda real a la API
      console.log(`[HybridRecommender] Buscando recomendaciones para género "${genre}"`);
      
      // Buscar recomendaciones de ambas fuentes en paralelo
      const [spotifyTracks, youtubeTracks] = await Promise.allSettled([
        spotifyService.getTracksByGenre(genre, Math.ceil(limit * 0.7)),
        youtubeMusic.getRecommendationsByGenre(genre, Math.ceil(limit * 0.5))
      ]);
      
      // Obtener resultados o array vacío en caso de error
      const spotifyResults = spotifyTracks.status === 'fulfilled' ? spotifyTracks.value : [];
      const youtubeResults = youtubeTracks.status === 'fulfilled' ? youtubeTracks.value : [];
      
      // Combinar resultados, alternando entre fuentes para mayor variedad
      let combinedTracks: Track[] = [];
      const maxLength = Math.max(spotifyResults.length, youtubeResults.length);
      
      for (let i = 0; i < maxLength; i++) {
        if (i < spotifyResults.length) {
          combinedTracks.push(spotifyResults[i]);
        }
        if (i < youtubeResults.length) {
          combinedTracks.push(youtubeResults[i]);
        }
      }
      
      // Quitar duplicados basados en título y artista
      const uniqueTracks = this.removeDuplicates(combinedTracks);
      
      // Limitar al número solicitado
      const finalTracks = uniqueTracks.slice(0, limit);
      
      // Guardar en caché si tenemos resultados
      if (finalTracks.length > 0) {
        // Guardar en memoria
        genreRecommendationsCache[cacheKey] = {
          timestamp: now,
          tracks: finalTracks
        };
        
        // Guardar en caché persistente
        try {
          await recommendationsCache.set(
            cacheKey,
            JSON.stringify(finalTracks),
            60 * 60 * 2 // 2 horas
          );
        } catch (cacheError) {
          console.warn(`[HybridRecommender] Error guardando en caché para "${genre}":`, cacheError);
        }
      }
      
      return finalTracks;
    } catch (error) {
      console.error('[HybridRecommender] Error en recomendaciones por género:', error);
      return [];
    }
  }
  
  /**
   * Obtiene recomendaciones de cualquier fuente disponible
   * Útil cuando no se está seguro si la consulta es un género
   * @param query Consulta de búsqueda
   * @param limit Máximo número de resultados
   * @returns Lista de pistas recomendadas
   */
  async getMultiSourceRecommendations(query: string, limit: number = 20): Promise<Track[]> {
    try {
      // Usar la función del multi-source recommender que ya tiene caché
      return getMultiSourceTrackDetails(query, limit, {
        timeout: 15000 // Mayor timeout para búsquedas generales
      });
    } catch (error) {
      console.error('[HybridRecommender] Error obteniendo recomendaciones multi-fuente:', error);
      return [];
    }
  }
  
  /**
   * Elimina pistas duplicadas de un array
   * @param tracks Lista de pistas con posibles duplicados 
   * @returns Lista de pistas sin duplicados
   */
  private removeDuplicates(tracks: Track[]): Track[] {
    const uniqueTracks = new Map<string, Track>();
    
    tracks.forEach(track => {
      // Crear clave única basada en título y artista
      const title = (track.title || '').toLowerCase();
      const artist = (track.artist || '').toLowerCase();
      const key = `${title}|${artist}`;
      
      // Solo agregar si no existe ya
      if (!uniqueTracks.has(key)) {
        uniqueTracks.set(key, track);
      }
    });
    
    return Array.from(uniqueTracks.values());
  }
} 