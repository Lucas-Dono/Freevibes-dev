/**
 * Servicio de recomendaciones por artista
 *
 * Este módulo proporciona funciones para obtener recomendaciones musicales basadas en artistas,
 * utilizando el sistema multi-fuente.
 */

import { Track } from '@/types/types';
import { searchMultiSource, SearchOptions } from './search';
import { getRecommendationsByGenre, GetRecommendationsOptions } from './multi-source-recommender';
import { recommendationsCache, DEFAULT_CACHE_TTL } from '@/lib/cache';

/**
 * Obtiene canciones populares de un artista específico
 *
 * @param artistName Nombre del artista
 * @param limit Número máximo de resultados
 * @returns Lista de canciones del artista
 */
export async function getArtistTopTracks(artistName: string, limit: number = 20): Promise<Track[]> {
  try {
    if (!artistName) {
      throw new Error('Nombre de artista no proporcionado');
    }


    // Intentar obtener de caché primero
    const cacheKey = `artist_top:${artistName.toLowerCase()}:${limit}`;
    const cachedData = await recommendationsCache.get(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    // Buscar canciones del artista usando el sistema multi-fuente
    const searchQuery = `artist:"${artistName}" top`;
    const tracks = await searchMultiSource(searchQuery, limit, {
      combineResults: true,
      preferredSource: 'spotify' // Spotify suele tener buenos datos de artistas
    });

    if (tracks.length === 0) {
      // Si no hay resultados, intentar una búsqueda más simple
      const simpleSearch = await searchMultiSource(artistName, limit, {
        combineResults: true,
        preferArtist: artistName
      });

      if (simpleSearch.length > 0) {
        // Guardar en caché
        await recommendationsCache.set(
          cacheKey,
          JSON.stringify(simpleSearch),
          DEFAULT_CACHE_TTL
        );
        return simpleSearch;
      }

      throw new Error(`No se encontraron tracks para el artista: ${artistName}`);
    }

    // Guardar en caché para futuras solicitudes
    await recommendationsCache.set(
      cacheKey,
      JSON.stringify(tracks),
      DEFAULT_CACHE_TTL
    );

    return tracks;
  } catch (error) {
    console.error(`[Artist] Error obteniendo tracks de artista:`, error);

    // En caso de error, intentar recuperar datos de caché aunque estén expirados
    try {
      const cacheKey = `artist_top:${artistName.toLowerCase()}:${limit}`;
      const cachedData = await recommendationsCache.get(cacheKey);

      if (cachedData) {
        return JSON.parse(cachedData);
      }
    } catch (cacheError) {
      console.error(`[Artist] Error accediendo a caché:`, cacheError);
    }

    // Si todo falla, generar tracks fallback
    return getArtistFallbackTracks(artistName, limit);
  }
}

/**
 * Obtiene canciones similares a un artista específico
 *
 * @param artistName Nombre del artista
 * @param limit Número máximo de resultados
 * @returns Lista de canciones similares
 */
export async function getSimilarArtistTracks(artistName: string, limit: number = 20): Promise<Track[]> {
  try {
    if (!artistName) {
      throw new Error('Nombre de artista no proporcionado');
    }


    // Intentar obtener de caché primero
    const cacheKey = `similar_artists:${artistName.toLowerCase()}:${limit}`;
    const cachedData = await recommendationsCache.get(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    // Buscar artistas similares
    // Primero, intentar descubrir el género del artista
    const searchGenreQuery = `${artistName} genre`;
    const possibleGenres = await searchMultiSource(searchGenreQuery, 5, {
      extractText: true,
      combineResults: true
    });

    // Extraer posibles géneros del texto
    const popularGenres = ['pop', 'rock', 'electronic', 'hip-hop', 'alternative',
                           'indie', 'r&b', 'reggaeton', 'latin', 'metal', 'jazz'];
    let artistGenre = 'pop'; // Default

    for (const genre of popularGenres) {
      if (possibleGenres.some((track: Track) =>
          track.title?.toLowerCase().includes(genre) ||
          track.artist?.toLowerCase().includes(genre))) {
        artistGenre = genre;
        break;
      }
    }


    // Buscar canciones similares usando el género detectado
    const tracks = await getRecommendationsByGenre(artistGenre, limit, {
      combineResults: true,
      excludeArtist: artistName // Evitar canciones del mismo artista
    } as GetRecommendationsOptions);

    if (tracks.length === 0) {
      throw new Error(`No se encontraron artistas similares a: ${artistName}`);
    }

    // Guardar en caché para futuras solicitudes
    await recommendationsCache.set(
      cacheKey,
      JSON.stringify(tracks),
      DEFAULT_CACHE_TTL
    );

    return tracks;
  } catch (error) {
    console.error(`[Artist] Error obteniendo artistas similares:`, error);

    // En caso de error, intentar recuperar datos de caché aunque estén expirados
    try {
      const cacheKey = `similar_artists:${artistName.toLowerCase()}:${limit}`;
      const cachedData = await recommendationsCache.get(cacheKey);

      if (cachedData) {
        return JSON.parse(cachedData);
      }
    } catch (cacheError) {
      console.error(`[Artist] Error accediendo a caché:`, cacheError);
    }

    // En caso de error, intentar obtener recomendaciones generales como fallback
    try {
      return await getRecommendationsByGenre('pop', limit);
    } catch (fallbackError) {
      return getArtistFallbackTracks(artistName, limit);
    }
  }
}

/**
 * Función helper para generar canciones fallback para un artista
 * @param artistName Nombre del artista
 * @param limit Número de canciones a generar
 * @returns Lista de canciones fallback
 */
function getArtistFallbackTracks(artistName: string, limit: number): Track[] {

  const titles = ['Greatest Hit', 'Popular Song', 'Top Track', 'Fan Favorite', 'Classic'];
  const fallbackTracks: Track[] = [];

  // Crear tracks fallback
  for (let i = 0; i < Math.min(limit, 5); i++) {
    const title = titles[i % titles.length];
    fallbackTracks.push({
      id: `artist_fallback_${i}`,
      title: `${title} ${i + 1}`,
      artist: artistName || 'Artista Popular',
      album: 'Mejores Éxitos',
      albumCover: `https://placehold.co/300x300/darkblue/white?text=${encodeURIComponent(artistName || 'Artist')}`,
      cover: `https://placehold.co/300x300/darkblue/white?text=${encodeURIComponent(artistName || 'Artist')}`,
      duration: 180000 + (i * 30000), // Duración ficticia variada
      spotifyId: undefined,
      youtubeId: undefined
    });
  }

  return fallbackTracks;
}
