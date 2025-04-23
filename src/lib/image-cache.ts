/**
 * Servicio de caché de imágenes para canciones y artistas
 *
 * Este módulo proporciona funciones para almacenar y recuperar imágenes de canciones,
 * buscando en múltiples APIs cuando sea necesario y guardando los resultados para uso futuro.
 */

import { recommendationsCache } from './cache';

// Tiempo de vida por defecto para las imágenes en caché: 7 días
const IMAGE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

// Interfaz para los detalles de una canción almacenados en caché
export interface CachedTrackDetails {
  id: string;
  title: string;
  artist: string;
  album?: string;
  cover: string;
  albumCover?: string;
  spotifyId?: string;
  deezerId?: string;
  lastfmId?: string;
  popularity?: number;
  timestamp: number;
}

// Prefijo para las claves de caché de imágenes
const IMAGE_CACHE_PREFIX = 'image_cache:';

/**
 * Guarda los detalles de una canción en el caché de imágenes
 *
 * @param trackKey Clave única para identificar la canción (típicamente "artista:título")
 * @param details Detalles de la canción a almacenar
 * @param ttl Tiempo de vida en caché (opcional, por defecto 7 días)
 * @returns Promesa que se resuelve cuando se completa el guardado
 */
export async function cacheTrackImage(
  trackKey: string,
  details: Omit<CachedTrackDetails, 'timestamp'>,
  ttl: number = IMAGE_CACHE_TTL
): Promise<void> {
  try {
    const normalizedKey = normalizeTrackKey(trackKey);
    const cacheKey = `${IMAGE_CACHE_PREFIX}${normalizedKey}`;

    // Añadir timestamp para controlar la edad de los datos
    const dataToCache: CachedTrackDetails = {
      ...details,
      timestamp: Date.now()
    };

    await recommendationsCache.set(
      cacheKey,
      JSON.stringify(dataToCache),
      ttl
    );

  } catch (error) {
    console.error(`[ImageCache] Error al almacenar información para "${trackKey}":`, error);
  }
}

/**
 * Recupera los detalles de una canción del caché de imágenes
 *
 * @param trackKey Clave única para identificar la canción (típicamente "artista:título")
 * @returns Detalles de la canción o null si no está en caché
 */
export async function getTrackImageFromCache(
  trackKey: string
): Promise<CachedTrackDetails | null> {
  try {
    const normalizedKey = normalizeTrackKey(trackKey);
    const cacheKey = `${IMAGE_CACHE_PREFIX}${normalizedKey}`;

    const cachedData = await recommendationsCache.get(cacheKey);
    if (!cachedData) return null;

    const trackDetails = JSON.parse(cachedData) as CachedTrackDetails;

    return trackDetails;
  } catch (error) {
    console.error(`[ImageCache] Error al recuperar información para "${trackKey}":`, error);
    return null;
  }
}

/**
 * Busca información completa de una canción por artista y título
 *
 * @param artist Nombre del artista
 * @param title Título de la canción
 * @returns Detalles de la canción o null si no se encuentra
 */
export async function findTrackDetails(
  artist: string,
  title: string
): Promise<CachedTrackDetails | null> {
  try {
    const trackKey = `${artist}:${title}`;

    // Primero intentar obtener de caché
    const cachedDetails = await getTrackImageFromCache(trackKey);
    if (cachedDetails) return cachedDetails;


    // Si no está en caché, buscar en las APIs externas
    // Esta función se implementará en un servicio separado
    // que será llamado desde aquí

    // Por ahora retornamos null, pero aquí iría la llamada a las APIs
    return null;
  } catch (error) {
    console.error(`[ImageCache] Error al buscar detalles para "${artist} - ${title}":`, error);
    return null;
  }
}

/**
 * Normaliza una clave de canción para usar en caché
 *
 * @param key Clave original (artista:título)
 * @returns Clave normalizada
 */
function normalizeTrackKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^\w\s:-]/g, '') // Eliminar caracteres especiales excepto :
    .replace(/\s+/g, '_')      // Reemplazar espacios con _
    .trim();
}

/**
 * Formatea la edad de un elemento en caché de forma legible
 *
 * @param ageMs Edad en milisegundos
 * @returns Edad formateada
 */
function formatAge(ageMs: number): string {
  const seconds = Math.floor(ageMs / 1000);

  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  return `${days}d`;
}
