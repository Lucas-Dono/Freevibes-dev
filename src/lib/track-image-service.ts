/**
 * Servicio para buscar imágenes y detalles de canciones en múltiples APIs
 *
 * Este servicio se encarga de buscar información completa sobre canciones
 * consultando las APIs de Spotify, Deezer y Last.fm cuando es necesario.
 */

import { cacheTrackImage, CachedTrackDetails } from './image-cache';

// Importamos los servicios de las diferentes APIs
import * as spotifyApi from '@/services/spotify';
import { getRecommendationsByGenre } from '@/services/recommendations/multi-source-recommender';
import { searchMultiSource } from '@/services/recommendations/search';

// Inicializamos una cola de solicitudes para no sobrecargar las APIs
const requestQueue: Array<() => Promise<any>> = [];
let isProcessingQueue = false;

/**
 * Busca imágenes y detalles de una canción en todas las APIs disponibles
 *
 * @param artist Nombre del artista
 * @param title Título de la canción
 * @param options Opciones adicionales
 * @returns Promise con los detalles de la canción o null si no se encuentra
 */
export async function findTrackImage(
  artist: string,
  title: string,
  options: { preferSpotify?: boolean } = {}
): Promise<CachedTrackDetails | null> {
  if (!artist || !title) {
    console.warn('[TrackImageService] Se requiere artista y título para buscar');
    return null;
  }

  const trackKey = `${artist}:${title}`;

  // Encolar la solicitud y procesarla cuando sea posible
  return new Promise((resolve) => {
    requestQueue.push(async () => {
      const result = await searchAllApis(artist, title, options);
      resolve(result);
      return result;
    });

    processQueue();
  });
}

/**
 * Procesa la cola de solicitudes secuencialmente para evitar sobrecargar las APIs
 */
async function processQueue() {
  if (isProcessingQueue || requestQueue.length === 0) return;

  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    const request = requestQueue.shift();
    if (request) {
      try {
        await request();
        // Esperar un pequeño tiempo entre solicitudes
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error('[TrackImageService] Error al procesar solicitud en cola:', error);
      }
    }
  }

  isProcessingQueue = false;
}

/**
 * Busca información de una canción en todas las APIs disponibles
 *
 * @param artist Nombre del artista
 * @param title Título de la canción
 * @param options Opciones adicionales
 * @returns Detalles de la canción encontrados o null
 */
async function searchAllApis(
  artist: string,
  title: string,
  options: { preferSpotify?: boolean } = {}
): Promise<CachedTrackDetails | null> {
  try {
    const searchQuery = `${title} ${artist}`;
    const trackKey = `${artist}:${title}`;

    // Intentamos buscar primero en Spotify (mejores metadatos)
    const spotifyResults = await searchSpotify(searchQuery);
    if (spotifyResults) {
      // Guardar en caché y retornar los resultados
      await cacheTrackImage(trackKey, spotifyResults);
      return {
        ...spotifyResults,
        timestamp: Date.now()
      };
    }

    // Si no hay resultados de Spotify, intentar con la búsqueda multi-fuente
    const multiResults = await searchMultiSource(searchQuery, 1, {
      preferredSource: options.preferSpotify ? 'spotify' : 'deezer',
      forceFresh: true
    });

    if (multiResults && multiResults.length > 0) {
      const track = multiResults[0];
      const trackResults = {
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        cover: track.cover,
        albumCover: track.albumCover,
        spotifyId: track.spotifyId
      };

      // Guardar en caché y retornar los resultados
      await cacheTrackImage(trackKey, trackResults);
      return {
        ...trackResults,
        timestamp: Date.now()
      };
    }

    return null;
  } catch (error) {
    console.error(`[TrackImageService] Error buscando detalles:`, error);
    return null;
  }
}

/**
 * Busca detalles de una canción en Spotify
 *
 * @param query Consulta de búsqueda
 * @returns Detalles de la canción o null
 */
async function searchSpotify(query: string): Promise<Omit<CachedTrackDetails, 'timestamp'> | null> {
  try {
    const results = await spotifyApi.searchTracks(query, 1);

    if (results && results.length > 0) {
      const track = results[0];

      // Verificar que tengamos una imagen de portada
      if (!track.album?.images?.[0]?.url) {
        return null;
      }

      return {
        id: track.id,
        title: track.name,
        artist: track.artists?.map((a: any) => a.name).join(', ') || 'Desconocido',
        album: track.album?.name,
        cover: track.album.images[0].url,
        albumCover: track.album.images[0].url,
        spotifyId: track.id,
        popularity: track.popularity
      };
    }

    return null;
  } catch (error) {
    console.error('[TrackImageService] Error en búsqueda de Spotify:', error);
    return null;
  }
}
