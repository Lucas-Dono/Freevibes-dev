/**
 * Sistema de recomendaciones musicales multi-fuente
 *
 * Este módulo implementa un sistema de recomendaciones musicales que combina
 * resultados de múltiples fuentes para proporcionar recomendaciones robustas,
 * incluso cuando algunas fuentes fallan.
 */

import { Track } from '@/types/types';
import { DEFAULT_CACHE_TTL, recommendationsCache } from '@/lib/cache';
import { searchMultiSource } from './search';
import * as spotifyRecommender from './sources/spotify';
import { youtube, youtubeMusic } from '@/services/youtube';
import { VALID_GENRES } from '@/lib/genres';
import { YouTubeMusicAPI } from '../youtube/youtube-music-api';
import * as spotifyService from '../spotify';
import { ENABLE_CACHE_DEBUG } from '@/lib/isomorphic-cache';

// Comprobación de disponibilidad de YouTube Music
let isYouTubeMusicAvailable = false;
let ytLoggedNoAvailable = false;
let youTubeMusicAvailabilityChecked = false;

// Verificar si YouTube Music está disponible (se ejecuta una sola vez)
async function checkYouTubeMusicAvailability() {
  if (youTubeMusicAvailabilityChecked) return isYouTubeMusicAvailable;

  try {
    // Comprobar si el objeto existe
    if (!youtubeMusic) {
      isYouTubeMusicAvailable = false;
      return false;
    }

    // Verificar si la API está realmente disponible usando la nueva función isAvailable
    if (typeof youtubeMusic.isAvailable === 'function') {
      isYouTubeMusicAvailable = youtubeMusic.isAvailable();
      if (!isYouTubeMusicAvailable) {
        return false;
      }
    } else {
      // Verificación antigua basada en contar métodos
      const availableMethods = Object.keys(youtubeMusic).filter(key => {
        return typeof (youtubeMusic as any)[key] === 'function';
      });

      if (availableMethods.length > 0) {
        isYouTubeMusicAvailable = true;
      } else {
        isYouTubeMusicAvailable = false;
      }
    }
  } catch (error) {
    isYouTubeMusicAvailable = false;
  }

  youTubeMusicAvailabilityChecked = true;
  return isYouTubeMusicAvailable;
}

// Llamar a la verificación al inicio
checkYouTubeMusicAvailability().then(() => {
});

/**
 * Opciones para obtener recomendaciones
 */
export interface GetRecommendationsOptions {
  /**
   * Fuente de preferencia para las recomendaciones
   */
  preferredSource?: 'spotify' | 'deezer' | 'lastfm' | 'youtube';
  /**
   * Combinar resultados de múltiples fuentes
   */
  combine?: boolean;
  /**
   * Si se deben combinar resultados de diferentes fuentes (alias para combine)
   */
  combineResults?: boolean;
  /**
   * Tiempo máximo de espera para la operación
   */
  timeout?: number;
  /**
   * Forzar búsqueda fresca (ignorar caché)
   */
  forceFresh?: boolean;
  /**
   * Número máximo de resultados
   */
  limit?: number;
  /**
   * Excluir un artista específico de los resultados (ej: para evitar el mismo artista)
   */
  excludeArtist?: string;
  /**
   * No mejorar imágenes de portada
   */
  skipImageEnhancement?: boolean;
}

// Tipo para las fuentes disponibles
type SourceType = 'spotify' | 'lastfm' | 'deezer' | 'youtube';

// Configuración de fuentes habilitadas desde variables de entorno
export const SOURCES_CONFIG = {
  spotify: process.env.ENABLE_SPOTIFY !== 'false',
  lastfm: process.env.ENABLE_LASTFM === 'true',
  deezer: process.env.ENABLE_DEEZER === 'true',
  youtube: process.env.ENABLE_YOUTUBE === 'true' && process.env.USE_YOUTUBE_FOR_SEARCH !== 'false',
  preferred: process.env.PREFERRED_SOURCE || 'spotify',
  fallback: process.env.FALLBACK_SOURCE || 'lastfm',
  third: process.env.THIRD_SOURCE || 'deezer',
};

// Límites de API para cada fuente (para evitar throttling)
export const API_LIMITS: Record<SourceType, number> = {
  spotify: parseInt(process.env.SPOTIFY_API_LIMIT || '100'),
  lastfm: parseInt(process.env.LASTFM_API_LIMIT || '200'),
  deezer: parseInt(process.env.DEEZER_API_LIMIT || '40'),
  youtube: parseInt(process.env.YOUTUBE_API_LIMIT || '50'),
};

// Contadores de uso para cada API (se resetean periódicamente)
const apiUsage: Record<SourceType, { count: number; lastReset: number }> = {
  spotify: { count: 0, lastReset: Date.now() },
  lastfm: { count: 0, lastReset: Date.now() },
  deezer: { count: 0, lastReset: Date.now() },
  youtube: { count: 0, lastReset: Date.now() },
};

// Períodos de reset para cada API (en milisegundos)
const resetPeriods: Record<SourceType, number> = {
  spotify: 60000, // 1 minuto
  lastfm: 60000, // 1 minuto
  deezer: 5000,  // 5 segundos (muy estricto)
  youtube: 86400000, // 24 horas (cuota diaria)
};

// Lista para almacenar géneros disponibles en memoria
let availableGenres: string[] = [];

/**
 * Controla el uso de cada API para evitar superar los límites
 * @param source Nombre de la fuente/API
 * @returns true si la API está disponible, false si se debe esperar
 */
function checkApiUsage(source: SourceType): boolean {
  const now = Date.now();
  const usage = apiUsage[source];
  const resetPeriod = resetPeriods[source];

  // Resetear contador si ha pasado el período
  if (now - usage.lastReset > resetPeriod) {
    usage.count = 0;
    usage.lastReset = now;
  }

  // Verificar si se ha alcanzado el límite
  const limit = API_LIMITS[source];
  if (usage.count >= limit) {
    const debugEnabled = process.env.DEBUG_RATE_LIMITS === 'true';
    if (debugEnabled) {
      console.warn(`[Rate Limit] API ${source} ha alcanzado su límite (${limit}). Próximo reset en ${Math.ceil((resetPeriod - (now - usage.lastReset))/1000)}s`);
    }
    return false;
  }

  // Incrementar contador
  usage.count++;
  return true;
}

// Definimos los tipos para las fuentes de recomendaciones
interface RecommendationSource {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  timeout: number; // en milisegundos
  handler: (genre: string, limit: number) => Promise<Track[]>;
}

// Define la estructura y configuración de las fuentes de recomendaciones
export const SOURCES: RecommendationSource[] = [
  {
    id: 'spotify',
    name: 'Spotify',
    priority: 60,
    enabled: true,
    timeout: 12000, // Tiempo para API de Spotify
    handler: async (genre, limit) => {
      try {
        // Obtener desde la API de Spotify
        const data = await spotifyRecommender.getRecommendationsByGenre(genre, limit);
        return data;
      } catch (error) {
        console.error(`[Spotify Source] Error:`, error);
        return [];
      }
    }
  },
  {
    id: 'youtube',
    name: 'YouTube Music',
    priority: 40,
    enabled: true,
    timeout: 10000, // Tiempo para API de YouTube
    handler: async (genre, limit) => {
      try {
        // Obtener desde el servicio de YouTube Music
        const data = await youtubeMusic.getRecommendationsByGenre(genre, limit);
        return data;
      } catch (error) {
        console.error(`[YouTube Music Source] Error:`, error);
        return [];
      }
    }
  }
];

// Instancias de los servicios
const youtubeMusicAPI = new YouTubeMusicAPI();

/**
 * Obtiene recomendaciones basadas en género utilizando múltiples fuentes
 *
 * @param genre Género musical para buscar
 * @param limit Número máximo de resultados
 * @param options Opciones adicionales para la búsqueda
 * @returns Lista de canciones recomendadas
 */
export async function getRecommendationsByGenre(
  genre: string,
  limit: number = 20,
  options: GetRecommendationsOptions = {}
): Promise<Track[]> {
  try {
    if (!genre) {
      throw new Error('Género no proporcionado');
    }


    // Limpiar y normalizar el género
    const normalizedGenre = normalizeGenre(genre);

    // Definir el orden de fuentes según configuración
    // y controlar los límites de API de cada una
    const sourcePriority = [
      SOURCES_CONFIG.preferred,
      SOURCES_CONFIG.fallback,
      SOURCES_CONFIG.third,
      'youtube'  // YouTube como última opción
    ].filter(Boolean) as SourceType[];

    // Filtrar fuentes que han alcanzado sus límites
    const availableSources = sourcePriority.filter(source => {
      // Verificar si la fuente está habilitada
      const isEnabled = source === 'spotify' ? SOURCES_CONFIG.spotify :
                       source === 'lastfm' ? SOURCES_CONFIG.lastfm :
                       source === 'deezer' ? SOURCES_CONFIG.deezer :
                       source === 'youtube' ? SOURCES_CONFIG.youtube : false;

      // Verificar si la fuente tiene disponibilidad de API
      return isEnabled && checkApiUsage(source);
    });

    // Si no hay fuentes disponibles, usar caché o fallback
    if (availableSources.length === 0) {
      console.warn(`[Multi] Todas las fuentes han alcanzado sus límites de API, usando caché o fallback`);
      // Continuar el flujo - recuperará de caché o usará fallback
    } else {
      options.preferredSource = availableSources[0];
    }

    // Intentar obtener de caché primero (a menos que se fuerce una búsqueda fresca)
    if (!options.forceFresh) {
      const cacheKey = `genre:${normalizedGenre}:${limit}:${JSON.stringify(options)}`;
      const cachedData = await recommendationsCache.get(cacheKey);

      if (cachedData) {
        return JSON.parse(cachedData);
      }
    }

    // Construir query para buscar por género
    // Validar el género para evitar buscar canciones con "genre:canción completa"
    // Un género normalmente no contiene espacios ni caracteres especiales
    const isValidGenre = /^[a-zA-Z0-9-&]+$/.test(normalizedGenre.trim());
    const searchQuery = isValidGenre ? `genre:${normalizedGenre}` : normalizedGenre;

    // Realizar búsqueda multi-fuente
    let tracks = await searchMultiSource(searchQuery, limit, {
      ...options,
      combineResults: true,
      availableSources // Pasar las fuentes disponibles como strings
    });

    // Si no hay resultados suficientes, probar otra búsqueda diferente
    if (tracks.length < Math.min(limit, 10)) {
      const alternateQuery = `${normalizedGenre} music`;
      const moreTracks = await searchMultiSource(alternateQuery, limit, {
        ...options,
        combineResults: true,
        forceFresh: true,
        availableSources // Mantener las mismas fuentes disponibles
      });

      // Combinar y deduplicar resultados
      const allTracks = [...tracks, ...moreTracks];
      tracks = Array.from(new Map(allTracks.map(track => [track.id, track])).values());
    }

    // Filtrar artistas excluidos si se especifica
    if (options.excludeArtist && tracks.length > 0) {
      const excludeArtist = options.excludeArtist.toLowerCase();
      tracks = tracks.filter(track =>
        !track.artist || !track.artist.toLowerCase().includes(excludeArtist)
      );
    }

    // Limitar al número solicitado
    let finalTracks = tracks.slice(0, limit);

    // Procesar los tracks para asegurar que tengan títulos y artistas correctos
    finalTracks = finalTracks.map(track => {
      // Limpiar prefijos de género en títulos
      let cleanedTitle = track.title;

      // Eliminar prefijos de género específicos
      if (cleanedTitle.toLowerCase().startsWith('genre:')) {
        cleanedTitle = cleanedTitle.substring(cleanedTitle.indexOf(':') + 1).trim();
      }

      // Si el título contiene el género y algún separador, limpiarlo
      if (normalizedGenre && cleanedTitle.toLowerCase().includes(normalizedGenre.toLowerCase())) {
        const genreName = normalizedGenre.charAt(0).toUpperCase() + normalizedGenre.slice(1);
        cleanedTitle = cleanedTitle
          .replace(new RegExp(`^${genreName}\\s*[-:]+\\s*`, 'i'), '')
          .replace(new RegExp(`^genre:${normalizedGenre}\\s*[-:]+\\s*`, 'i'), '')
          .replace(new RegExp(`genre:${normalizedGenre}`, 'i'), '')
          .trim();
      }

      // Eliminar palabras genéricas como "Result", "Mix", "Track" seguidas de números
      cleanedTitle = cleanedTitle
        .replace(/\b(Result|Mix|Track)\s*\d*\b/gi, '')
        .replace(/\s+\d+$/, '')  // Eliminar números al final
        .trim();

      // Si después de limpiar está vacío, usar un título genérico basado en el género
      if (!cleanedTitle || cleanedTitle === '-') {
        const genreCapitalized = normalizedGenre.charAt(0).toUpperCase() + normalizedGenre.slice(1);
        cleanedTitle = `${genreCapitalized} Song`;
      }

      // Limpiar prefijos en artistas
      let cleanedArtist = track.artist;

      // Eliminar "Artista para" y otras frases genéricas
      if (cleanedArtist.toLowerCase().includes('artista para') ||
          cleanedArtist.toLowerCase().includes('artist for')) {
        // Generar un nombre de artista más natural basado en el género
        const genreCapitalized = normalizedGenre.charAt(0).toUpperCase() + normalizedGenre.slice(1);

        // Nombres de artistas por género
        const artistsByGenre: Record<string, string[]> = {
          'pop': ['Pop Sensation', 'Melody Makers', 'Chart Toppers', 'The Harmony'],
          'rock': ['Rock Legends', 'Electric Sound', 'The Stone Band', 'Amplified'],
          'hip-hop': ['Urban Flow', 'Rhyme Masters', 'Beat Collective', 'Lyrical Genius'],
          'electronic': ['Digital Dreams', 'Synth Masters', 'Electric Pulse', 'Bass Nation'],
          'jazz': ['Smooth Quartet', 'Jazz Collective', 'Blue Notes', 'Night Ensemble'],
          'r&b': ['Soul Voices', 'Rhythm & Blues', 'Smooth Groove', 'Urban Soul'],
          'latin': ['Ritmo Latino', 'Tropical Beat', 'Salsa Kings', 'Latin Passion'],
          'metal': ['Heavy Riffs', 'Metal Mayhem', 'Power Chords', 'The Headbangers'],
          'indie': ['The Independents', 'Garage Sound', 'Alternative Vibes', 'The Underground'],
          'default': ['The Artists', 'Sound Collective', 'Music Makers', 'Studio Session']
        };

        // Seleccionar un nombre basado en el género o usar uno por defecto
        const genreArtists = artistsByGenre[normalizedGenre] || artistsByGenre['default'];
        cleanedArtist = genreArtists[Math.floor(Math.random() * genreArtists.length)];
      }

      // Eliminar menciones del género en el nombre del artista
      if (cleanedArtist.toLowerCase().includes('genre:')) {
        cleanedArtist = cleanedArtist.replace(/genre:[a-z-]+/gi, '').trim();
      }

      // Si después de limpiar está vacío, usar un nombre genérico
      if (!cleanedArtist || cleanedArtist === '-') {
        const genreCapitalized = normalizedGenre.charAt(0).toUpperCase() + normalizedGenre.slice(1);
        cleanedArtist = `${genreCapitalized} Artist`;
      }

      return {
        ...track,
        title: cleanedTitle,
        artist: cleanedArtist,
        album: track.album || normalizedGenre
      };
    });

    // Guardar en caché para futuras solicitudes
    if (finalTracks.length > 0 && !options.forceFresh) {
      const cacheKey = `genre:${normalizedGenre}:${limit}:${JSON.stringify(options)}`;
      await recommendationsCache.set(
        cacheKey,
        JSON.stringify(finalTracks),
        DEFAULT_CACHE_TTL
      );

      // También almacenar este género en la lista de géneros disponibles
      await cacheAvailableGenre(normalizedGenre);
    }

    return finalTracks;
  } catch (error) {
    console.error(`[Multi] Error obteniendo recomendaciones para género ${genre}:`, error);

    // En caso de error, intentar recuperar datos de caché aunque estén expirados
    try {
      const normalizedGenre = normalizeGenre(genre);
      const cacheKey = `genre:${normalizedGenre}:${limit}:${JSON.stringify(options)}`;
      const cachedData = await recommendationsCache.get(cacheKey);

      if (cachedData) {
        return JSON.parse(cachedData);
      }
    } catch (cacheError) {
      console.error(`[Multi] Error accediendo a caché:`, cacheError);
    }

    // Si todo falla, devolver datos fallback
    return getGenreFallbackTracks(genre, limit);
  }
}

/**
 * Almacena un género en la lista de géneros disponibles
 * @param genre Género a almacenar
 */
async function cacheAvailableGenre(genre: string): Promise<void> {
  try {
    // Verificar si el género ya está en la lista
    if (!availableGenres.includes(genre)) {
      availableGenres.push(genre);

      // Guardar en caché local solo para esta sesión
      const cacheKey = `available_genres`;
      await recommendationsCache.set(
        cacheKey,
        JSON.stringify(availableGenres),
        DEFAULT_CACHE_TTL * 7 // 1 semana
      );
    }
  } catch (error) {
    console.error(`[Multi] Error almacenando género disponible:`, error);
  }
}

/**
 * Obtiene la lista de géneros disponibles (que han tenido resultados exitosos)
 * @returns Lista de géneros disponibles
 */
export async function getAvailableGenres(): Promise<string[]> {
  try {
    // Si ya tenemos géneros en memoria, devolverlos
    if (availableGenres.length > 0) {
      return availableGenres;
    }

    // Intentar recuperar de caché
    const cacheKey = `available_genres`;
    const cachedData = await recommendationsCache.get(cacheKey);

    if (cachedData) {
      availableGenres = JSON.parse(cachedData);
      return availableGenres;
    }

    // Si no hay datos en caché, devolver los géneros válidos predeterminados
    availableGenres = VALID_GENRES.slice(0, 15); // Primeros 15 géneros
    return availableGenres;
  } catch (error) {
    console.error(`[Multi] Error obteniendo géneros disponibles:`, error);
    return VALID_GENRES.slice(0, 15);
  }
}

/**
 * Normaliza el nombre de un género para hacerlo compatible con las búsquedas
 * @param genre Género a normalizar
 * @returns Género normalizado
 */
function normalizeGenre(genre: string): string {
  if (!genre) return 'pop';

  // Convertir a minúsculas y eliminar caracteres especiales
  let normalized = genre.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  // Verificar si el género normalizado está en la lista de géneros válidos
  // Si no, intentar encontrar una coincidencia parcial
  if (!VALID_GENRES.includes(normalized)) {
    for (const validGenre of VALID_GENRES) {
      if (normalized.includes(validGenre) || validGenre.includes(normalized)) {
        normalized = validGenre;
        break;
      }
    }
  }

  // Si aún no hay coincidencia, default a 'pop'
  if (!VALID_GENRES.includes(normalized)) {
    normalized = 'pop';
  }

  return normalized;
}

/**
 * Genera tracks fallback para un género específico
 * @param genre Género musical
 * @param limit Número de tracks a generar
 * @returns Lista de tracks fallback
 */
function getGenreFallbackTracks(genre: string, limit: number): Track[] {

  const normalizedGenre = normalizeGenre(genre);
  const fallbackTracks: Track[] = [];

  // Imágenes por géneros (usando Unsplash para mejor calidad)
  const genreImages: Record<string, string> = {
    'pop': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819',
    'rock': 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee',
    'hip-hop': 'https://images.unsplash.com/photo-1601643157091-ce5c665179ab',
    'electronic': 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745',
    'jazz': 'https://images.unsplash.com/photo-1511192336575-5a79af67a629',
    'r&b': 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f',
    'latin': 'https://images.unsplash.com/photo-1535324492437-d8dea70a38a7',
    'classical': 'https://images.unsplash.com/photo-1507838153414-b4b713384a76',
    'indie': 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b',
    'alternative': 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89',
    'metal': 'https://images.unsplash.com/photo-1629276301820-0f3eedc29fd0',
    'soul': 'https://images.unsplash.com/photo-1605722625766-a4c989c747a4',
    'blues': 'https://images.unsplash.com/photo-1601312378427-822b2b41da35',
    'punk': 'https://images.unsplash.com/photo-1598387993281-cecf8b71a8f8',
    'reggae': 'https://images.unsplash.com/photo-1540039628-1432a508c3fd',
    'country': 'https://images.unsplash.com/photo-1581290723777-fd2c6fba9b44',
    'folk': 'https://images.unsplash.com/photo-1499364615650-ec38552f4f34',
    'default': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
  };

  // Generar nombres de artistas por género
  const artistsByGenre: Record<string, string[]> = {
    'pop': ['Pop Star', 'Melody Maker', 'Chart Topper', 'The Hitmaker'],
    'rock': ['Rock Legend', 'Guitar Hero', 'The Amplifiers', 'Stone Edge'],
    'hip-hop': ['MC Flow', 'Beat Master', 'Lyrical Genius', 'Urban Poet'],
    'electronic': ['Digital Dreams', 'Bass Drop', 'Synth Master', 'Electric Pulse'],
    'jazz': ['Smooth Saxophone', 'Blue Note', 'Jazz Ensemble', 'Night Club'],
    'r&b': ['Soul Singer', 'Rhythm King', 'Smooth Groove', 'Urban Soul'],
    'latin': ['Ritmo Latino', 'Salsa King', 'Tropical Beat', 'Havana Nights'],
    'classical': ['Orchestra Master', 'String Quartet', 'Piano Virtuoso', 'Symphony'],
    'indie': ['The Independents', 'Alternative Sound', 'Garage Band', 'Underground'],
    'metal': ['Heavy Riffs', 'Metal Mayhem', 'Dark Thunder', 'Steel Force'],
    'alternative': ['Alt Nation', 'Different Path', 'The Outsiders', 'New Wave'],
    'default': ['The Musicians', 'Sound Creators', 'Audio Artists', 'Music Makers'],
  };

  // Seleccionar la imagen adecuada para el género
  const coverImage = genreImages[normalizedGenre] || genreImages['default'];
  const artistList = artistsByGenre[normalizedGenre] || artistsByGenre['default'];

  // Crear tracks fallback con mejor presentación
  for (let i = 0; i < Math.min(limit, 10); i++) {
    // Obtener un artista aleatorio de la lista para este género
    const randomArtist = artistList[Math.floor(Math.random() * artistList.length)];

    // Generar un nombre de canción contextual al género
    const songNumber = i + 1;
    const genreName = normalizedGenre.charAt(0).toUpperCase() + normalizedGenre.slice(1);

    // Variedad de títulos basados en el género y número
    let songTitle;
    if (i % 3 === 0) {
      songTitle = `${genreName} Vibes #${songNumber}`;
    } else if (i % 3 === 1) {
      songTitle = `The Best of ${genreName} (Track ${songNumber})`;
    } else {
      songTitle = `${genreName} Experience ${songNumber}`;
    }

    fallbackTracks.push({
      id: `genre_fallback_${normalizedGenre}_${i}`,
      title: songTitle,
      artist: randomArtist,
      album: `${genreName} Collection Vol. ${Math.floor(i/3) + 1}`,
      albumCover: coverImage,
      cover: coverImage,
      duration: 180000 + (i * 30000), // Duración ficticia entre 3 y 8 minutos
      spotifyId: undefined,
      youtubeId: undefined
    });
  }

  return fallbackTracks;
}

/**
 * Estructura de caché en memoria para detalles de pistas
 */
interface TrackDetailsCache {
  [key: string]: {
    timestamp: number;
    data: Track[];
  }
}

// Caché global para detalles de pistas - reduce las búsquedas repetidas
const trackDetailsCache: TrackDetailsCache = {};
// TTL de caché: 30 minutos
const TRACK_DETAILS_CACHE_TTL = 30 * 60 * 1000;
// Tamaño máximo de caché
const MAX_CACHE_SIZE = 200;

/**
 * Obtiene tracks con detalles de múltiples fuentes
 * Versión optimizada con caché de consultas y reducción de búsquedas duplicadas
 * @param query Consulta de búsqueda
 * @param limit Límite de resultados
 * @param options Opciones adicionales
 */
export async function getMultiSourceTrackDetails(
  query: string,
  limit: number = 5,
  options: GetRecommendationsOptions = {}
): Promise<Track[]> {
  // Usar caché si no se fuerza búsqueda fresca
  if (!options.forceFresh) {
    const cacheKey = `search:${query}:${limit}`;
    const cachedData = await recommendationsCache.get(cacheKey);

    if (cachedData) {
      try {
        const tracks = JSON.parse(cachedData);
        return tracks;
      } catch (error) {
        console.error(`[Search] Error al parsear datos de caché para "${query}":`, error);
      }
    }
  }

  // Verificar si los servicios requeridos están disponibles
  const isYouTubeMusicAvailable = youtubeMusic.isAvailable && youtubeMusic.isAvailable();

  // Track counter para evitar procesamiento excesivo
  const processedTracks = new Map<string, Track>();
  const trackIdSignatures = new Set<string>();

  // Obtener tracks de Spotify
  let spotifyResults: Track[] = [];
  try {
    spotifyResults = await spotifyService.searchTracks(query, Math.min(limit * 2, 10));

    // Registrar tracks de Spotify usando un identificador único
    spotifyResults.forEach(track => {
      // Crear una firma para identificar tracks similares
      const signature = `${track.title.toLowerCase()}:${track.artist.toLowerCase()}`;
      if (!trackIdSignatures.has(signature)) {
        trackIdSignatures.add(signature);
        processedTracks.set(track.id, track);
      }
    });
  } catch (error) {
    console.error(`[Multi-Source] Error buscando en Spotify: "${query}"`, error);
  }

  // Obtener resultados de YouTube Music si está disponible
  let youtubeResults: Track[] = [];
  if (isYouTubeMusicAvailable) {
    try {
      // Obtener tracks de YouTube solo si son necesarios
      if (processedTracks.size < limit) {
        const ytMusicRawResults = await youtubeMusic.searchSongs(query, Math.min(limit * 1.5, 8));
        youtubeResults = youtubeMusic.toTracks(ytMusicRawResults);

        // Añadir solo tracks que no sean similares a los ya procesados
        youtubeResults.forEach(track => {
          const signature = `${track.title.toLowerCase()}:${track.artist.toLowerCase()}`;
          if (!trackIdSignatures.has(signature)) {
            trackIdSignatures.add(signature);
            processedTracks.set(track.id, track);
          }
        });
      }
    } catch (error) {
      console.error(`[Multi-Source] Error buscando en YouTube Music: "${query}"`, error);
    }
  }

  // Combinar resultados
  let combinedResults: Track[] = Array.from(processedTracks.values());

  // Ordenar por relevancia (prioridad a Spotify que suele tener mejores metadatos)
  combinedResults.sort((a, b) => {
    // Priorizar resultados de Spotify
    if (a.source === 'spotify' && b.source !== 'spotify') return -1;
    if (a.source !== 'spotify' && b.source === 'spotify') return 1;
    return 0;
  });

  // Limitar al número solicitado
  combinedResults = combinedResults.slice(0, limit);

  // Guardar en caché
  const cacheKey = `search:${query}:${limit}`;
  await recommendationsCache.set(cacheKey, JSON.stringify(combinedResults));

  return combinedResults;
}

/**
 * Encuentra tracks similares según un track dado
 */
export async function getSimilarTracks(track: Track, options: GetRecommendationsOptions = {}): Promise<Track[]> {
  // Buscar por nombre del track y artista
  const query = `${track.title} ${track.artist}`;
  const limit = options.limit || 20;
  return searchMultiSource(query, limit, {
    combineResults: options.combine,
    forceFresh: options.forceFresh,
    preferredSource: options.preferredSource,
  });
}

/**
 * Mejora las imágenes de portada de los tracks combinando información de diferentes fuentes
 * @param tracks Lista de tracks a mejorar
 * @returns Lista de tracks con imágenes mejoradas
 */
async function enhanceTrackImages(tracks: Track[]): Promise<Track[]> {
  try {
    if (tracks.length === 0) return tracks;

    // Primero intentemos buscar mejores imágenes para tracks sin portada
    const tracksNeedingImages = tracks.filter(track => !track.cover || track.cover.includes('default-cover') || track.cover.includes('placeholder'));

    if (tracksNeedingImages.length === 0) {
      return tracks;
    }


    // Usar YouTube como fuente alternativa de imágenes
    const quotaStatus = youtube.getQuotaStatus();

    if (SOURCES_CONFIG.youtube && quotaStatus.hasQuota && tracksNeedingImages.length <= 10) {
      try {
        // Buscar imágenes en YouTube
        for (const track of tracksNeedingImages) {
          const query = `${track.title} ${track.artist} official`;
          const searchResult = await youtube.searchVideos(query, 1);

          if (searchResult.items && searchResult.items.length > 0) {
            const thumbnailUrl = searchResult.items[0].snippet.thumbnails.high?.url ||
                               searchResult.items[0].snippet.thumbnails.medium?.url;

            if (thumbnailUrl) {
              track.cover = thumbnailUrl;

              // También guardar el ID de YouTube si no lo tiene
              if (!track.youtubeId) {
                track.youtubeId = searchResult.items[0].id.videoId;
              }
            }
          }

          // Pequeña pausa para no sobrecargar YouTube
          await new Promise(resolve => setTimeout(resolve, 200));
        }

      } catch (error) {
        console.error('[Multi] Error buscando imágenes en YouTube:', error);
      }
    } else {
    }

    return tracks;
  } catch (error) {
    console.error('[Multi] Error en enhanceTrackImages:', error);
    return tracks;
  }
}

/**
 * Mejora las pistas con IDs de YouTube y portadas si es necesario
 *
 * @param tracks Lista de pistas a mejorar
 * @param options Opciones de mejora
 * @returns Pistas mejoradas
 */
export async function enhanceTracksWithYouTubeIds(
  tracks: Track[],
  options: { skipDuplicateChecks?: boolean } = {}
): Promise<Track[]> {
  try {
    if (!SOURCES_CONFIG.youtube) {
      return tracks;
    }

    // Verificar el estado de la cuota
    const quotaStatus = youtube.getQuotaStatus();
    if (!quotaStatus.canEnrichTracks) {
      console.warn('[Multi] Cuota de YouTube insuficiente para enriquecer tracks');
      return tracks;
    }

    // Filtrar tracks que ya tienen ID de YouTube o que tienen la misma combinación de artista+título
    const uniqueTracks: Track[] = [];
    const processedKeys = new Set<string>();

    tracks.forEach(track => {
      // Si ya tiene ID de YouTube o estamos omitiendo verificaciones de duplicados, incluirlo directamente
      if (track.youtubeId || options.skipDuplicateChecks) {
        uniqueTracks.push(track);
        return;
      }

      // Crear clave única para detectar duplicados
      const key = `${track.artist}:${track.title}`.toLowerCase();

      // Si no está duplicado, añadirlo a la lista de tracks únicos
      if (!processedKeys.has(key)) {
        processedKeys.add(key);
        uniqueTracks.push(track);
      }
    });


    // Enriquecer tracks en batch
    const enrichedTracks = await youtube.enrichTracksWithYouTubeIds(uniqueTracks);

    // Si estamos procesando todos los tracks, devolver el resultado directamente
    if (options.skipDuplicateChecks) {
      return enrichedTracks;
    }

    // Si solo procesamos tracks únicos, necesitamos aplicar los IDs a los tracks originales
    // Creamos un mapa de artista+título -> youtubeId
    const youtubeIdMap = new Map<string, string>();

    enrichedTracks.forEach(track => {
      if (track.youtubeId) {
        const key = `${track.artist}:${track.title}`.toLowerCase();
        youtubeIdMap.set(key, track.youtubeId);
      }
    });

    // Aplicar los IDs a todos los tracks originales
    return tracks.map(track => {
      const key = `${track.artist}:${track.title}`.toLowerCase();
      const youtubeId = youtubeIdMap.get(key);

      if (youtubeId && !track.youtubeId) {
        return { ...track, youtubeId };
      }

      return track;
    });
  } catch (error) {
    console.error('[Multi] Error en enhanceTracksWithYouTubeIds:', error);
    return tracks; // Devolver tracks originales en caso de error
  }
}

// Implementación de batch processing para múltiples consultas
/**
 * Procesa múltiples consultas de búsqueda en lotes para reducir llamadas API
 * @param queries Lista de consultas a procesar
 * @param options Opciones adicionales
 */
export async function batchProcessQueries(
  queries: string[],
  options: {
    limit?: number;
    cacheOnly?: boolean;
    timeout?: number;
    preferredSource?: 'spotify' | 'youtube';
  } = {}
): Promise<Record<string, Track[]>> {
  try {
    const {
      limit = 1,
      cacheOnly = false,
      timeout = 10000,
      preferredSource
    } = options;


    // Resultado final: clave = consulta, valor = tracks
    const results: Record<string, Track[]> = {};

    // Comprobar caché primero para todas las consultas
    const cachePromises = queries.map(async query => {
      const cacheKey = `track:${query}:${limit}`;
      const cached = trackDetailsCache[cacheKey];
      const now = Date.now();

      if (cached && now - cached.timestamp < TRACK_DETAILS_CACHE_TTL) {
        if (ENABLE_CACHE_DEBUG) {
        }
        results[query] = cached.data;
        return true; // Encontrado en caché
      }
      return false; // No encontrado en caché
    });

    // Esperar a que se completen todas las comprobaciones de caché
    const cacheResults = await Promise.all(cachePromises);

    // Filtrar consultas que no están en caché
    const pendingQueries = queries.filter((_, index) => !cacheResults[index]);

    // Si todas las consultas están en caché o solo queremos resultados en caché, terminar
    if (pendingQueries.length === 0 || cacheOnly) {
      return results;
    }


    // Procesar consultas pendientes en paralelo, pero con límite de concurrencia
    const maxConcurrent = 2; // Máximo 2 solicitudes concurrentes para evitar sobrecarga
    const batchSize = Math.min(maxConcurrent, pendingQueries.length);

    // Función auxiliar para procesar un lote
    const processBatch = async (batch: string[]) => {
      const promises = batch.map(async query => {
        try {
          const tracks = await getMultiSourceTrackDetails(query, limit, {
            preferredSource,
            timeout,
            forceFresh: true
          });

          // Guardar en resultados
          results[query] = tracks;

          // Actualizar caché explícitamente
          const cacheKey = `track:${query}:${limit}`;
          trackDetailsCache[cacheKey] = {
            timestamp: Date.now(),
            data: tracks
          };

          return { query, success: true };
        } catch (error) {
          console.error(`[BatchProcessor] Error procesando "${query}":`, error);
          results[query] = []; // Array vacío en caso de error
          return { query, success: false };
        }
      });

      return Promise.all(promises);
    };

    // Procesar en lotes secuenciales para mantener el rate limiting
    for (let i = 0; i < pendingQueries.length; i += batchSize) {
      const currentBatch = pendingQueries.slice(i, i + batchSize);
      await processBatch(currentBatch);

      // Si quedan más lotes, esperar un poco entre ellos
      if (i + batchSize < pendingQueries.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Agregar consultas que no pudieron procesarse con arrays vacíos
    queries.forEach(query => {
      if (!results[query]) {
        results[query] = [];
      }
    });

    return results;
  } catch (error) {
    console.error(`[BatchProcessor] Error en procesamiento por lotes:`, error);

    // Devolver objeto con arrays vacíos para todas las consultas
    return queries.reduce((acc, query) => {
      acc[query] = [];
      return acc;
    }, {} as Record<string, Track[]>);
  }
}

/**
 * Busca tracks en Spotify
 */
async function searchSpotifyTracks(query: string, limit: number): Promise<Track[]> {
  try {
    // Usar el servicio existente
    const tracks = await spotifyService.searchTracks(query, limit);
    return tracks || [];
  } catch (error) {
    console.error(`[Spotify] Error buscando tracks "${query}":`, error);
    return [];
  }
}

/**
 * Busca tracks en YouTube Music
 */
async function searchYouTubeTracks(query: string, limit: number): Promise<Track[]> {
  try {
    // Si el servicio de YouTube tiene problemas, devolver un array vacío
    if (!isYouTubeMusicAvailable || !youtubeMusic) {
      if (!ytLoggedNoAvailable) {
        console.warn(`[YouTube] El servicio de YouTube Music no está disponible`);
        ytLoggedNoAvailable = true;
      }
      return [];
    }

    // Determinar qué método usar para buscar canciones
    let searchMethod: Function | null = null;

    // Tratamos youtubeMusic como 'any' para acceder a métodos que podrían no estar en la interfaz
    const ytMusic = youtubeMusic as any;

    // Intentar encontrar un método de búsqueda apropiado
    if (typeof ytMusic.searchSongs === 'function') {
      searchMethod = ytMusic.searchSongs.bind(ytMusic);
    } else if (typeof ytMusic.search === 'function') {
      searchMethod = ytMusic.search.bind(ytMusic);
    } else if (typeof ytMusic.searchTracks === 'function') {
      searchMethod = ytMusic.searchTracks.bind(ytMusic);
    }

    if (!searchMethod) {
      console.warn('[YouTube] No se encontró método de búsqueda en YouTube Music');
      return [];
    }

    try {
      // Usar el método encontrado
      const youtubeResults = await searchMethod(query, limit);

      // Determinar cómo convertir resultados a formato Track
      if (typeof ytMusic.toTracks === 'function') {
        return ytMusic.toTracks(youtubeResults) || [];
      } else {
        // Conversión manual si no existe toTracks
        return (youtubeResults || []).map((item: any) => ({
          id: item.videoId || item.id || '',
          title: item.title || item.name || '',
          artist: item.artist || item.artistName || '',
          album: item.album || item.albumName || 'YouTube Music',
          cover: item.thumbnail || (item.thumbnails && item.thumbnails[0]?.url) || '',
          duration: item.duration || 0,
          source: 'youtube',
          youtubeId: item.videoId || item.id || ''
        }));
      }
    } catch (error) {
      console.error(`[YouTube] Error buscando tracks "${query}":`, error);
      return [];
    }
  } catch (error) {
    console.error(`[YouTube] Error general:`, error);
    return [];
  }
}

/**
 * Combina y deduplica resultados de diferentes fuentes
 */
function combineResults(spotifyTracks: Track[], youtubeTracks: Track[], limit: number): Track[] {
  try {
    // Aplicar pesos a las fuentes para priorización
    const weightedTracks = [
      ...spotifyTracks.map(track => ({ ...track, weight: track.weight || 0.8 })),
      ...youtubeTracks.map(track => ({ ...track, weight: track.weight || 0.6 }))
    ];

    // Eliminar duplicados basados en título y artista
    const uniqueMap = new Map<string, Track>();

    for (const track of weightedTracks) {
      // Normalizar título y artista para comparación
      const title = (track.title || '').toLowerCase().trim();
      const artist = (track.artist || '').toLowerCase().trim();
      const key = `${title}|${artist}`;

      const existingTrack = uniqueMap.get(key);

      if (!existingTrack) {
        uniqueMap.set(key, track);
      } else if ((track.weight || 0) > (existingTrack.weight || 0)) {
        // Reemplazar si el nuevo track tiene mayor peso
        uniqueMap.set(key, track);
      }
    }

    // Convertir a array y limitar según el parámetro
    const results = Array.from(uniqueMap.values()).slice(0, limit);
    return results;
  } catch (error) {
    console.error('[Multi-Source] Error combinando resultados:', error);
    // En caso de error, devolver simplemente los primeros N resultados de ambas fuentes
    return [...spotifyTracks, ...youtubeTracks].slice(0, limit);
  }
}
