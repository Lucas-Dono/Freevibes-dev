/**
 * Servicio de recomendaciones basadas en pistas
 * 
 * Este módulo proporciona funciones para obtener recomendaciones musicales basadas en pistas específicas,
 * utilizando el sistema multi-fuente.
 */

import { Track } from '@/types/types';
import { searchMultiSource } from './search';
import { getSimilarArtistTracks } from './artist';
import { getRecommendationsByGenre } from './multi-source-recommender';
import { recommendationsCache, DEFAULT_CACHE_TTL } from '@/lib/cache';

/**
 * Obtiene recomendaciones de canciones similares a una pista específica
 * 
 * @param track Pista de referencia
 * @param limit Número máximo de resultados
 * @returns Lista de canciones recomendadas
 */
export async function getSimilarTracks(track: Track, limit: number = 20): Promise<Track[]> {
  try {
    if (!track) {
      throw new Error('Pista no proporcionada');
    }
    
    const { title, artist, spotifyId } = track;
    console.log(`[Track] Obteniendo tracks similares a: ${title} - ${artist}`);
    
    // Crear una clave de caché basada en la información disponible
    const baseKey = spotifyId || `${title}_${artist}`.toLowerCase().replace(/\s+/g, '_');
    const cacheKey = `similar_track:${baseKey}:${limit}`;
    
    // Intentar obtener de caché primero
    const cachedData = await recommendationsCache.get(cacheKey);
    
    if (cachedData) {
      console.log(`[Track] Cache hit para tracks similares a ${title}`);
      return JSON.parse(cachedData);
    }
    
    // Crear una estrategia en cascada para obtener recomendaciones
    let similarTracks: Track[] = [];
    
    // Estrategia 1: Buscar por ID de Spotify si está disponible
    if (spotifyId) {
      try {
        const searchQuery = `related:${spotifyId}`;
        const spotifyResults = await searchMultiSource(searchQuery, limit, {
          combineResults: true,
          preferredSource: 'spotify'
        });
        
        if (spotifyResults.length >= Math.min(5, limit)) {
          similarTracks = spotifyResults;
          console.log(`[Track] Encontradas ${similarTracks.length} canciones por ID de Spotify`);
        }
      } catch (error) {
        console.error(`[Track] Error buscando por spotifyId:`, error);
      }
    }
    
    // Estrategia 2: Si no hay suficientes resultados, buscar por título y artista
    if (similarTracks.length < Math.min(5, limit) && title && artist) {
      try {
        const searchQuery = `similar:"${title}" artist:"${artist}"`;
        const searchResults = await searchMultiSource(searchQuery, limit, {
          combineResults: true
        });
        
        if (searchResults.length > 0) {
          // Combinar con resultados existentes
          const allTracks = [...similarTracks, ...searchResults];
          // Deduplicar por ID
          similarTracks = Array.from(new Map(allTracks.map(t => [t.id, t])).values());
          console.log(`[Track] Añadidas ${searchResults.length} canciones por título/artista`);
        }
      } catch (error) {
        console.error(`[Track] Error buscando por título/artista:`, error);
      }
    }
    
    // Estrategia 3: Si aún no hay suficientes resultados, obtener tracks del mismo artista
    if (similarTracks.length < Math.min(limit, 10) && artist) {
      try {
        const artistTracks = await getSimilarArtistTracks(artist, limit);
        
        if (artistTracks.length > 0) {
          // Excluir la canción original
          const filteredTracks = artistTracks.filter(t => 
            t.id !== track.id && 
            (t.title !== track.title || t.artist !== track.artist)
          );
          
          // Combinar con resultados existentes
          const allTracks = [...similarTracks, ...filteredTracks];
          // Deduplicar por ID
          similarTracks = Array.from(new Map(allTracks.map(t => [t.id, t])).values());
          console.log(`[Track] Añadidas ${filteredTracks.length} canciones de artistas similares`);
        }
      } catch (error) {
        console.error(`[Track] Error obteniendo tracks del artista:`, error);
      }
    }
    
    // Limitar al número solicitado
    const finalTracks = similarTracks.slice(0, limit);
    
    // Guardar en caché para futuras solicitudes
    if (finalTracks.length > 0) {
      await recommendationsCache.set(
        cacheKey,
        JSON.stringify(finalTracks),
        DEFAULT_CACHE_TTL
      );
    }
    
    console.log(`[Track] Recomendaciones finales para ${title}: ${finalTracks.length} tracks`);
    return finalTracks;
  } catch (error) {
    console.error(`[Track] Error obteniendo tracks similares:`, error);
    
    // En caso de error, intentar recuperar datos de caché
    try {
      const { title, artist, spotifyId } = track;
      const baseKey = spotifyId || `${title}_${artist}`.toLowerCase().replace(/\s+/g, '_');
      const cacheKey = `similar_track:${baseKey}:${limit}`;
      const cachedData = await recommendationsCache.get(cacheKey);
      
      if (cachedData) {
        console.log(`[Track] Usando caché para recuperar después de error`);
        return JSON.parse(cachedData);
      }
    } catch (cacheError) {
      console.error(`[Track] Error accediendo a caché:`, cacheError);
    }
    
    // Si todo falla, intentar obtener recomendaciones basadas en el género de la pista
    try {
      // Detectar posible género basado en el nombre del artista o el título
      const title = track.title || '';
      const artist = track.artist || '';
      const searchText = `${title} ${artist}`;
      
      // Lista de géneros populares para detectar
      const genres = ['rock', 'pop', 'rap', 'hiphop', 'electronic', 'dance', 'indie', 'alternative', 'latin'];
      
      // Intentar identificar un género en el texto
      let detectedGenre = 'pop'; // Default
      for (const genre of genres) {
        if (searchText.toLowerCase().includes(genre)) {
          detectedGenre = genre;
          break;
        }
      }
      
      console.log(`[Track] Intentando obtener recomendaciones por género: ${detectedGenre}`);
      return await getRecommendationsByGenre(detectedGenre, limit);
    } catch (genreError) {
      console.error(`[Track] Error en fallback por género:`, genreError);
      
      // Último recurso: devolver datos fallback
      return getTrackFallbackTracks(track, limit);
    }
  }
}

/**
 * Genera tracks fallback similares a una pista dada
 * @param track Pista de referencia
 * @param limit Número de tracks a generar
 * @returns Lista de tracks fallback
 */
function getTrackFallbackTracks(track: Track, limit: number): Track[] {
  console.log(`[Track] Generando tracks fallback similares a: ${track.title}`);
  
  const { title, artist } = track;
  const fallbackTracks: Track[] = [];
  
  // Crear tracks fallback basados en el track original
  for (let i = 0; i < Math.min(limit, 5); i++) {
    fallbackTracks.push({
      id: `track_fallback_${i}`,
      title: `Canción similar a ${title || 'Pista Original'} ${i + 1}`,
      artist: artist || 'Artista Similar',
      album: 'Álbum Recomendado',
      albumCover: track.albumCover || `https://placehold.co/300x300/darkblue/white?text=Similar`,
      cover: track.cover || `https://placehold.co/300x300/darkblue/white?text=Similar`,
      duration: track.duration || 180000 + (i * 20000), // Duración similar a la original
      spotifyId: undefined,
      youtubeId: undefined
    });
  }
  
  return fallbackTracks;
} 