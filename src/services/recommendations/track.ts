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
      console.error('[Track] Error: Se intentó obtener tracks similares sin proporcionar una pista');
      throw new Error('Pista no proporcionada');
    }

    const { title, artist, spotifyId } = track;

    // Crear una clave de caché basada en la información disponible
    const baseKey = spotifyId || `${title}_${artist}`.toLowerCase().replace(/\s+/g, '_');
    const cacheKey = `similar_track:${baseKey}:${limit}`;

    // Intentar obtener de caché primero
    let cachedData;
    try {
      cachedData = await recommendationsCache.get(cacheKey);
    } catch (cacheError) {
      console.warn(`[Track] Error accediendo a caché:`, cacheError);
      // Continuamos sin datos de caché
    }

    if (cachedData) {
      try {
        return JSON.parse(cachedData);
      } catch (parseError) {
        console.warn(`[Track] Error analizando datos de caché:`, parseError);
        // Continuamos con la obtención de datos frescos
      }
    }

    // Crear una estrategia en cascada para obtener recomendaciones
    let similarTracks: Track[] = [];
    let errors: Error[] = [];

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
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Track] Error buscando por spotifyId:`, errorMessage);
        errors.push(new Error(`Spotify ID search: ${errorMessage}`));
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
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Track] Error buscando por título/artista:`, errorMessage);
        errors.push(new Error(`Title/artist search: ${errorMessage}`));
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
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Track] Error obteniendo tracks del artista:`, errorMessage);
        errors.push(new Error(`Artist tracks: ${errorMessage}`));
      }
    }

    // Si ninguna estrategia funcionó y tenemos errores, intentar una última alternativa
    if (similarTracks.length === 0 && errors.length > 0) {
      console.warn(`[Track] Todas las estrategias fallaron con ${errors.length} errores. Intentando método alternativo.`);

      // Detectar posible género basado en el nombre del artista o el título
      try {
        const searchText = `${title} ${artist}`;
        const genres = ['rock', 'pop', 'rap', 'hiphop', 'electronic', 'dance', 'indie', 'alternative', 'latin'];

        // Intentar identificar un género en el texto
        let detectedGenre = 'pop'; // Default
        for (const genre of genres) {
          if (searchText.toLowerCase().includes(genre)) {
            detectedGenre = genre;
            break;
          }
        }

        const genreTracks = await getRecommendationsByGenre(detectedGenre, limit);
        if (genreTracks.length > 0) {
          similarTracks = genreTracks;
        }
      } catch (genreError) {
        console.error(`[Track] Error en método alternativo por género:`, genreError);
        // Si este último intento falla, continuamos con los resultados que tengamos
      }
    }

    // Limitar al número solicitado
    const finalTracks = similarTracks.slice(0, limit);

    // Guardar en caché para futuras solicitudes
    if (finalTracks.length > 0) {
      try {
        await recommendationsCache.set(
          cacheKey,
          JSON.stringify(finalTracks),
          DEFAULT_CACHE_TTL
        );
      } catch (cacheError) {
        console.warn(`[Track] Error guardando en caché:`, cacheError);
        // Continuamos sin afectar al usuario
      }
    }


    // Si después de todos los intentos no hay resultados, usar fallback
    if (finalTracks.length === 0) {
      console.warn(`[Track] No se pudieron obtener recomendaciones. Generando fallback.`);
      return getTrackFallbackTracks(track, limit);
    }

    return finalTracks;
  } catch (error) {
    console.error(`[Track] Error crítico obteniendo tracks similares:`, error);

    // En caso de error crítico, intentar recuperar datos de caché
    try {
      const { title, artist, spotifyId } = track;
      const baseKey = spotifyId || `${title}_${artist}`.toLowerCase().replace(/\s+/g, '_');
      const cacheKey = `similar_track:${baseKey}:${limit}`;
      const cachedData = await recommendationsCache.get(cacheKey);

      if (cachedData) {
        return JSON.parse(cachedData);
      }
    } catch (cacheError) {
      console.error(`[Track] Error accediendo a caché en recuperación:`, cacheError);
    }

    // Si todo falla, devolver datos fallback
    return getTrackFallbackTracks(track, limit);
  }
}

/**
 * Genera tracks fallback similares a una pista dada
 * @param track Pista de referencia
 * @param limit Número de tracks a generar
 * @returns Lista de tracks fallback
 */
function getTrackFallbackTracks(track: Track, limit: number): Track[] {

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
