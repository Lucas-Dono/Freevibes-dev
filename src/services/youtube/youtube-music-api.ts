/**
 * Servicio de YouTube Music API
 *
 * Este servicio implementa funciones específicas para música usando la API de YouTube.
 * Se basa en las prácticas de ytmusicapi para ofrecer funcionalidades similares.
 */
import axios from 'axios';
import { Artist, Track } from '@/types/types';
import { API_CONFIG } from '@/config/api-config';
import { getCountryCode } from '../../lib/utils';
import { withThrottle } from '@/lib/request-throttler';
import { youtubeService } from './youtube-service';
import { YouTubeVideoItem, YTMusicResult, mapToYTMusic } from './index';
import { recommendationsCache } from '@/lib/cache';

// URL del servidor Node.js que actúa como proxy para el microservicio Python
// IMPORTANTE: Siempre apuntar al servidor Node.js para evitar problemas de CORS
const YTMUSIC_API_URL = `${API_CONFIG.getNodeApiUrl()}/api/youtube`;

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

const baseURL = YTMUSIC_API_URL;
const api = axios.create({ baseURL });

// Constantes de configuración
const SHOW_YT_MUSIC_ERRORS = false;
const DISABLE_YT_MUSIC_PING = false; // Configura a true para evitar pings constantes si sabes que el servicio no está disponible
const MAX_RETRY_ATTEMPTS = 2; // Número máximo de reintentos para las operaciones
const RETRY_DELAY_MS = 1000; // Tiempo entre reintentos (1 segundo)

// Objetos vacíos para retornar cuando el servicio no está disponible (evita errores null)
const EMPTY_RESPONSE = {
  tracks: [],
  artists: [],
  albums: []
};

// Estado de disponibilidad compartido para evitar verificaciones innecesarias
let globalAvailabilityStatus = {
  checked: false,
  available: false,
  lastCheck: 0
};

// Interfaz de respuesta de estado
interface StatusResponse {
  status: string;
  services: {
    node_server: boolean;
    youtube_music: boolean;
  };
  timestamp?: string;
  error?: string;
}

// Función auxiliar para esperar entre reintentos
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Función auxiliar para reintentar operaciones
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRY_ATTEMPTS
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Si no es el primer intento, esperar antes de reintentar
      if (attempt > 0) {
        await sleep(RETRY_DELAY_MS);
      }
      return await operation();
    } catch (error) {
      lastError = error;
      if (SHOW_YT_MUSIC_ERRORS) {
        console.warn(`[YouTubeMusicAPI] Intento ${attempt}/${maxRetries} fallido: ${(error as Error).message}`);
      }
    }
  }
  throw lastError;
}

export interface YouTubeMusicAlbum {
  id: string;
  name: string;
  artists: { name: string }[];
  images: { url: string }[];
  release_date: string;
  type: string;
  region?: string;
}

export interface YouTubeMusicPlaylist {
  title: string;
  playlistId: string;
  author: string;
  description: string;
  trackCount: number;
  thumbnails: { url: string }[];
  region?: string;
}

export interface YouTubeMusicArtist {
  id: string;
  name: string;
  images: { url: string }[];
  genres: string[];
  popularity: number;
  source: string;
  region?: string;
}

// Definir una interfaz Track interna para evitar problemas de importación
interface TrackInterface {
  id: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
  duration: number;
  source: string;
  youtubeId?: string;
}

/**
 * Función para normalizar tracks recibidos del backend
 * Asegura que los campos thumbnail se mapeen correctamente a cover
 */
function normalizeYTMusicTracks(tracks: any[]): Track[] {
  if (!Array.isArray(tracks)) {
    console.error('[YTMusic API] Se esperaba un array de tracks, recibido:', typeof tracks);
    return [];
  }

  return tracks
    .map((track, index) => {
      // Validar IDs
      const trackId = track.id || track.videoId || '';

      // Validar y procesar la miniatura
      let coverUrl = '';

      console.log(`[YTMusic API] Procesando track ${index}:`,
                  `ID=${trackId}`,
                  `thumbnail=${track.thumbnail}`,
                  `cover=${track.cover}`);

      // Preferir thumbnail si existe y parece ser una URL válida
      if (track.thumbnail && typeof track.thumbnail === 'string' && track.thumbnail.length > 10 &&
          (track.thumbnail.startsWith('http') || track.thumbnail.startsWith('/'))) {
        coverUrl = track.thumbnail;
        console.log(`[YTMusic API] Track ${index}: usando thumbnail: ${coverUrl}`);
      }
      // Si no hay thumbnail pero hay cover, usar cover
      else if (track.cover && typeof track.cover === 'string' && track.cover.length > 10 &&
              (track.cover.startsWith('http') || track.cover.startsWith('/'))) {
        coverUrl = track.cover;
        console.log(`[YTMusic API] Track ${index}: usando cover: ${coverUrl}`);
      }
      // Si hay thumbnails y es un array
      else if (track.thumbnails && Array.isArray(track.thumbnails) && track.thumbnails.length > 0) {
        // Encontrar la primera URL válida
        const validThumbnail = track.thumbnails.find(
          (t: any) => t && t.url && typeof t.url === 'string' && t.url.length > 10 &&
          (t.url.startsWith('http') || t.url.startsWith('/'))
        );

        if (validThumbnail && validThumbnail.url) {
          coverUrl = validThumbnail.url;
          console.log(`[YTMusic API] Track ${index}: usando thumbnails[].url: ${coverUrl}`);
        }
      }

      // Si tenemos un ID válido de YouTube y no tenemos coverUrl o es inválida, generar uno
      if (trackId && trackId !== 'default' && trackId.length > 5 &&
          (!coverUrl || !coverUrl.startsWith('http'))) {
        // Asegurarse de que estamos usando un ID real y no una URL completa
        const cleanId = extractYouTubeId(trackId);
        coverUrl = `https://img.youtube.com/vi/${cleanId}/hqdefault.jpg`;
        console.log(`[YTMusic API] Track ${index}: generando thumbnail desde ID: ${coverUrl}`);
      }

      // Verificar si la URL es una URL de imagen válida
      const isValidImageUrl =
        coverUrl &&
        typeof coverUrl === 'string' &&
        coverUrl.length > 10 &&
        coverUrl.startsWith('http') &&
        (coverUrl.includes('.jpg') ||
         coverUrl.includes('.jpeg') ||
         coverUrl.includes('.png') ||
         coverUrl.includes('.webp') ||
         coverUrl.includes('ytimg.com') ||
         coverUrl.includes('googleusercontent.com'));

      // Fallback final si después de todo no tenemos URL válida
      if (!isValidImageUrl) {
        // Usar una URL de fallback conocida si tenemos un ID de YouTube
        if (trackId && trackId !== 'default' && trackId.length > 5) {
          // Asegurarse de que estamos usando un ID real y no una URL completa
          const cleanId = extractYouTubeId(trackId);
          coverUrl = `https://img.youtube.com/vi/${cleanId}/hqdefault.jpg`;
        } else {
          // Último recurso: imagen de placeholder
          coverUrl = '/placeholder-album.jpg';
        }
        console.log(`[YTMusic API] Track ${index}: usando URL de fallback: ${coverUrl}`);
      }

      // Crear objeto Track normalizado
      return {
        id: trackId || `unknown-${index}`,
        title: track.title || 'Desconocido',
        artist: track.artist || 'Artista desconocido',
        album: track.album || '',
        cover: coverUrl, // Usamos la URL procesada
        duration: track.duration ? parseFloat(track.duration.toString()) : 0,
        youtubeId: trackId || '',
        source: 'youtube'
      } as Track;
    })
    .filter((track): track is Track => !!track.id); // Solo mantener tracks con ID válido
}

/**
 * Función auxiliar para extraer el ID de YouTube de una URL o un ID malformado
 */
function extractYouTubeId(idOrUrl: string): string {
  // Si el valor es nulo o vacío, devolver un ID predeterminado
  if (!idOrUrl) {
    console.log('[YTMusic API] ID vacío o nulo, usando default_img');
    return 'default_img';
  }

  // Limpiar la URL si contiene espacios o caracteres no deseados
  const cleanedUrl = idOrUrl.trim();

  // Primero verificar si la URL está duplicada
  if (cleanedUrl.includes('https://img.youtube.com/vi/https://') ||
      cleanedUrl.includes('https://i.ytimg.com/vi/https://')) {
    console.log('[YTMusic API] Detectada URL duplicada:', cleanedUrl);

    // Usar una regex más robusta para extraer el ID de la URL duplicada
    const duplicatedPatterns = [
      /https:\/\/img\.youtube\.com\/vi\/https:\/\/img\.youtube\.com\/vi\/([a-zA-Z0-9_-]{11})\/[^\/]+\.jpg/i,
      /https:\/\/img\.youtube\.com\/vi\/https:\/\/i\.ytimg\.com\/vi\/([a-zA-Z0-9_-]{11})\/[^\/]+\.jpg/i,
      /https:\/\/i\.ytimg\.com\/vi\/https:\/\/img\.youtube\.com\/vi\/([a-zA-Z0-9_-]{11})\/[^\/]+\.jpg/i,
      /https:\/\/i\.ytimg\.com\/vi\/https:\/\/i\.ytimg\.com\/vi\/([a-zA-Z0-9_-]{11})\/[^\/]+\.jpg/i
    ];

    for (const pattern of duplicatedPatterns) {
      const match = cleanedUrl.match(pattern);
      if (match && match[1]) {
        console.log('[YTMusic API] ID extraído de URL duplicada:', match[1]);
        return match[1];
      }
    }

    // Si los patrones específicos fallan, intentar extraer usando una regex más genérica
    const genericDuplicatedMatch = cleanedUrl.match(/https:\/\/[^\/]+\/vi\/https:\/\/[^\/]+\/vi\/([a-zA-Z0-9_-]{11})/i);
    if (genericDuplicatedMatch && genericDuplicatedMatch[1]) {
      console.log('[YTMusic API] ID extraído con regex genérica:', genericDuplicatedMatch[1]);
      return genericDuplicatedMatch[1];
    }
  }

  // Si ya es un ID limpio (11 caracteres), devolverlo directamente
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleanedUrl)) {
    return cleanedUrl;
  }

  // Extraer ID de una URL de YouTube
  const patterns = [
    // YouTube video URL
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
    // YouTube image URL (both domains)
    /(?:i\.ytimg\.com\/vi\/|img\.youtube\.com\/vi\/)([a-zA-Z0-9_-]{11})(?:\/[^\/]+\.jpg|\/)/i,
    // Last attempt to find any 11-character sequence that looks like a YouTube ID
    /([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = cleanedUrl.match(pattern);
    if (match && match[1]) {
      console.log('[YTMusic API] ID extraído con patrón estándar:', match[1], 'de URL:', cleanedUrl.substring(0, 50) + '...');
      return match[1];
    }
  }

  // Si no pudimos extraer un ID válido, registrar el problema y devolver un valor por defecto
  console.warn('[YTMusic API] No se pudo extraer un ID válido de:', cleanedUrl);
  return 'default_img';
}

/**
 * Función para normalizar playlists recibidas del backend
 * Asegura que los URLs de imágenes sean válidos
 */
function normalizeFeaturedPlaylists(playlists: any[]): YouTubeMusicPlaylist[] {
  if (!Array.isArray(playlists)) {
    console.error('[YTMusic API] Se esperaba un array de playlists, recibido:', typeof playlists);
    return [];
  }

  return playlists
    .map((playlist, index) => {
      // Validar y procesar las miniaturas
      let thumbnails = playlist.thumbnails || [];

      // Si thumbnails no es un array, intentar convertirlo
      if (!Array.isArray(thumbnails)) {
        if (typeof thumbnails === 'string') {
          // Si es una cadena, convertirla en un objeto
          thumbnails = [{ url: thumbnails }];
        } else if (thumbnails && typeof thumbnails === 'object') {
          // Si es un objeto, convertirlo en array
          thumbnails = [{ url: thumbnails.url || '' }];
        } else {
          // Si no es ni string ni objeto, iniciar array vacío
          thumbnails = [];
        }
      }

      // Procesar cada URL de thumbnail para asegurarse de que son válidas
      const processedThumbnails = thumbnails.map((thumb: any) => {
        if (!thumb) return { url: '/placeholder-playlist.jpg' };

        let imgUrl = '';
        if (typeof thumb === 'string') {
          imgUrl = thumb;
        } else if (thumb.url && typeof thumb.url === 'string') {
          imgUrl = thumb.url;
        }

        // Si la URL parece ser un ID de YouTube o URL malformada, corregirla
        if (imgUrl && (imgUrl.includes('youtube.com/vi/') || imgUrl.includes('ytimg.com/vi/'))) {
          const cleanId = extractYouTubeId(imgUrl);
          // Crear una URL limpia que apunte directamente a la imagen, sin duplicación
          if (cleanId !== 'default_img') {
            imgUrl = `https://img.youtube.com/vi/${cleanId}/hqdefault.jpg`;
            console.log(`[YTMusic API] URL de imagen procesada para playlist: ${imgUrl}`);
          } else {
            imgUrl = '/placeholder-playlist.jpg';
          }
        }

        return { url: imgUrl || '/placeholder-playlist.jpg' };
      }).filter((thumb: any) => thumb.url && thumb.url.length > 0);

      // Si no hay thumbnails válidos después del procesamiento, usar placeholder
      if (processedThumbnails.length === 0) {
        processedThumbnails.push({ url: '/placeholder-playlist.jpg' });
      }

      // Crear objeto normalizado
      return {
        title: playlist.title || 'Playlist sin título',
        playlistId: playlist.playlistId || `unknown-${index}`,
        author: playlist.author || 'Autor desconocido',
        description: playlist.description || '',
        trackCount: playlist.trackCount || 0,
        thumbnails: processedThumbnails,
        region: playlist.region
      };
    })
    .filter(playlist => !!playlist.playlistId); // Solo mantener playlists con ID válido
}

/**
 * Función para normalizar álbumes recibidos del backend
 * Asegura que los URLs de imágenes sean válidos
 */
function normalizeAlbums(albums: any[]): YouTubeMusicAlbum[] {
  if (!Array.isArray(albums)) {
    console.error('[YTMusic API] Se esperaba un array de álbumes, recibido:', typeof albums);
    return [];
  }

  return albums
    .map((album, index) => {
      // Validar y procesar las imágenes
      let images = album.images || [];

      // Si images no es un array, intentar convertirlo
      if (!Array.isArray(images)) {
        if (typeof images === 'string') {
          // Si es una cadena, convertirla en un objeto
          images = [{ url: images }];
        } else if (images && typeof images === 'object') {
          // Si es un objeto, convertirlo en array
          images = [{ url: images.url || '' }];
        } else {
          // Si no es ni string ni objeto, iniciar array vacío
          images = [];
        }
      }

      // Procesar cada URL de imagen para asegurarse de que son válidas
      const processedImages = images.map((img: any) => {
        if (!img) return { url: '/placeholder-album.jpg' };

        let imgUrl = '';
        if (typeof img === 'string') {
          imgUrl = img;
        } else if (img.url && typeof img.url === 'string') {
          imgUrl = img.url;
        }

        // Si la URL parece ser un ID de YouTube o URL malformada, corregirla
        if (imgUrl && (imgUrl.includes('youtube.com/vi/') || imgUrl.includes('ytimg.com/vi/'))) {
          const cleanId = extractYouTubeId(imgUrl);
          // Crear URL limpia
          if (cleanId !== 'default_img') {
            imgUrl = `https://img.youtube.com/vi/${cleanId}/hqdefault.jpg`;
            console.log(`[YTMusic API] URL de imagen procesada para álbum: ${imgUrl}`);
          } else {
            imgUrl = '/placeholder-album.jpg';
          }
        }

        return { url: imgUrl || '/placeholder-album.jpg' };
      }).filter((img: any) => img.url && img.url.length > 0);

      // Si no hay imágenes válidas después del procesamiento, usar placeholder
      if (processedImages.length === 0) {
        processedImages.push({ url: '/placeholder-album.jpg' });
      }

      // Asegurar que artists es un array válido
      let artists = album.artists || [];
      if (!Array.isArray(artists)) {
        if (typeof artists === 'string') {
          artists = [{ name: artists }];
        } else if (artists && typeof artists === 'object' && artists.name) {
          artists = [{ name: artists.name }];
        } else {
          artists = [{ name: 'Artista desconocido' }];
        }
      }

      // Crear objeto normalizado
      return {
        id: album.id || `unknown-album-${index}`,
        name: album.name || 'Álbum desconocido',
        artists: artists,
        images: processedImages,
        release_date: album.release_date || '',
        type: album.type || 'album',
        region: album.region
      };
    })
    .filter(album => !!album.id); // Solo mantener álbumes con ID válido
}

/**
 * Función para normalizar artistas recibidos del backend
 * Asegura que los URLs de imágenes sean válidos
 */
function normalizeArtists(artists: any[]): YouTubeMusicArtist[] {
  if (!Array.isArray(artists)) {
    console.error('[YTMusic API] Se esperaba un array de artistas, recibido:', typeof artists);
    return [];
  }

  return artists
    .map((artist, index) => {
      // Validar y procesar las imágenes
      let images = artist.thumbnails || artist.images || [];

      // Si images no es un array, intentar convertirlo
      if (!Array.isArray(images)) {
        if (typeof images === 'string') {
          // Si es una cadena, convertirla en un objeto
          images = [{ url: images }];
        } else if (images && typeof images === 'object') {
          // Si es un objeto, convertirlo en array
          images = [{ url: images.url || '' }];
        } else {
          // Si no es ni string ni objeto, iniciar array vacío
          images = [];
        }
      }

      // Procesar cada URL de imagen para asegurarse de que son válidas
      const processedImages = images.map((img: any) => {
        if (!img) return { url: '/placeholder-artist.jpg' };

        let imgUrl = '';
        if (typeof img === 'string') {
          imgUrl = img;
        } else if (img.url && typeof img.url === 'string') {
          imgUrl = img.url;
        }

        // Si la URL parece ser un ID de YouTube o URL malformada, corregirla
        if (imgUrl && (imgUrl.includes('youtube.com/vi/') || imgUrl.includes('ytimg.com/vi/'))) {
          const cleanId = extractYouTubeId(imgUrl);
          // Crear URL limpia
          if (cleanId !== 'default_img') {
            imgUrl = `https://img.youtube.com/vi/${cleanId}/hqdefault.jpg`;
            console.log(`[YTMusic API] URL de imagen procesada para artista: ${imgUrl}`);
          } else {
            imgUrl = '/placeholder-artist.jpg';
          }
        }

        return { url: imgUrl || '/placeholder-artist.jpg' };
      }).filter((img: any) => img.url && img.url.length > 0);

      // Si no hay imágenes válidas después del procesamiento, usar placeholder
      if (processedImages.length === 0) {
        processedImages.push({ url: '/placeholder-artist.jpg' });
      }

      // Asegurar que genres es un array válido
      let genres = artist.genres || [];
      if (!Array.isArray(genres)) {
        if (typeof genres === 'string') {
          genres = [genres];
        } else if (artist.genre) {
          // Si no hay genres pero hay genre, usarlo
          genres = [artist.genre];
        } else {
          genres = [];
        }
      }

      // Normalizar el objeto de artista
      return {
        id: artist.id || artist.artistId || `unknown-artist-${index}`,
        name: artist.name || 'Artista desconocido',
        images: processedImages,
        genres: genres,
        popularity: typeof artist.popularity === 'number' ? artist.popularity : 0,
        source: artist.source || 'youtube',
        region: artist.region || '',
        thumbnails: processedImages // Mantener compatibilidad con ambos formatos
      };
    })
    .filter(artist => !!artist.id); // Solo mantener artistas con ID válido
}

/**
 * Servicio para interactuar con la API de YouTube Music
 */
export class YouTubeMusicAPI {
  private baseUrl: string;
  private available: boolean = false;
  private pingAttempted: boolean = false;
  private lastAvailabilityCheck: number = 0;

  constructor() {
    this.baseUrl = YTMUSIC_API_URL;

    // Verificar disponibilidad al inicializar sólo si no está deshabilitado
    if (!DISABLE_YT_MUSIC_PING) {
      this.checkAvailabilityAsync();
    } else {
      console.log('[Config] YouTube Music API deshabilitada por configuración');
      this.available = false;
    }
  }

  /**
   * Verifica si el servicio está disponible
   * Permite forzar una nueva verificación si se pasa force=true
   */
  isAvailable(force: boolean = false): boolean {
    // Si ya se verificó y no se fuerza una nueva verificación, usar el valor en caché
    if (!force && this.pingAttempted && (Date.now() - this.lastAvailabilityCheck < 60000)) {
      return this.available;
    }

    // Si se fuerza la verificación o no se ha intentado aún, iniciar una verificación asíncrona
    if (force || !this.pingAttempted) {
      // Programar una verificación asíncrona
      setTimeout(() => this.checkAvailabilityAsync(), 0);
    }

    // Devolver el estado actual mientras se verifica de nuevo
    return this.available;
  }

  /**
   * Método privado para verificar activamente la disponibilidad del servicio
   * Devuelve una promesa que se resuelve con el estado de disponibilidad
   */
  private async checkAvailabilityAsync(): Promise<boolean> {
    const now = Date.now();

    // Actualizar timestamp de verificación
    this.pingAttempted = true;
    this.lastAvailabilityCheck = now;

    try {
      // En lugar de usar endpoints especiales, intentar una búsqueda simple
      // Esto verificará toda la cadena de comunicación: Frontend -> Node.js -> Python
      const testSearchResponse = await axios.get(`${this.baseUrl}/search`, {
        params: {
          query: 'test',
          filter: 'songs',
          limit: 1
        },
        timeout: 8000 // Timeout mayor para dar tiempo a que responda
      });

      // Si llegamos aquí, la búsqueda funcionó - el servicio está disponible
      this.available = true;
      globalAvailabilityStatus = {
        checked: true,
        available: true,
        lastCheck: now
      };

      console.log(`[YouTubeMusicAPI] Servicio disponible (verificado con búsqueda de prueba)`);
      return true;
    } catch (error) {
      // Si fallamos con la búsqueda, intentar con el endpoint de estado
      try {
        const statusResponse = await axios.get<StatusResponse>(`${this.baseUrl.replace('/youtube', '/status')}`, {
          timeout: 5000
        });

        // Verificar que la respuesta incluya el estado de YouTube Music
        this.available = statusResponse.status === 200 &&
                        statusResponse.data.services?.youtube_music === true;
      } catch (statusError) {
        // Si ambos intentos fallan, el servicio no está disponible
        this.available = false;
      }

      // Actualizar estado global
      globalAvailabilityStatus = {
        checked: true,
        available: this.available,
        lastCheck: now
      };

      if (this.available) {
        console.log(`[YouTubeMusicAPI] Servicio disponible (verificado con /status)`);
      } else {
        if (SHOW_YT_MUSIC_ERRORS) {
          console.error('[YouTubeMusicAPI] Error al verificar disponibilidad:',
            error instanceof Error ? error.message : 'Error desconocido');
        } else {
          console.log('[YouTubeMusicAPI] Servicio no disponible');
        }
      }

      return this.available;
    }
  }

  /**
   * Método principal de búsqueda - será utilizado por searchSongs
   */
  async search(query: string, limit: number = 10): Promise<any[]> {
    if (!this.available) {
      return [];
    }

    try {
      return await withRetry(async () => {
        const response = await axios.get(`${this.baseUrl}/search`, {
          params: { query, filter: 'songs', limit },
          timeout: API_CONFIG.getSearchTimeout()
      });

      return Array.isArray(response.data) ? response.data : [];
      });
    } catch (error) {
      if (SHOW_YT_MUSIC_ERRORS) {
        console.error('[YouTubeMusicAPI] Error buscando canciones:',
          error instanceof Error ? error.message : 'Error desconocido');
      }
      return [];
    }
  }

  /**
   * Alias para search - para compatibilidad con el código existente
   */
  searchSongs(query: string, limit: number = 10): Promise<any[]> {
    return this.search(query, limit);
  }

  /**
   * Busca tracks en YouTube Music
   */
  async searchTracks(query: string, limit: number = 20): Promise<{ tracks: Track[], artists: any[], albums: any[] }> {
    // Verificar que el servicio esté disponible
    if (!this.isAvailable() || !query) {
      console.warn('[YTMusic API] Servicio no disponible o query vacía');
      return EMPTY_RESPONSE;
    }

    try {
      const countryCode = getCountryCode();
      const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&limit=${limit}&country=${countryCode}`;

      console.log(`[YTMusic API] Buscando tracks: "${query}" (límite: ${limit}, país: ${countryCode})`);

      const response = await withRetry(() => api.get(url, { timeout: API_CONFIG.getSearchTimeout() }));

      if (response.status === 200 && response.data) {
        const { tracks = [], artists = [], albums = [] } = response.data;

        console.log(`[YTMusic API] Resultados encontrados: ${tracks.length} tracks, ${artists.length} artistas, ${albums.length} álbumes`);

        // Utilizar la función normalizeYTMusicTracks para procesar los resultados
        const normalizedTracks = normalizeYTMusicTracks(tracks);

        return {
          tracks: normalizedTracks,
          artists,
          albums
        };
      }
      return EMPTY_RESPONSE;
    } catch (error) {
      console.error('[YTMusic API] Error buscando tracks:', error instanceof Error ? error.message : 'Error desconocido');
      return EMPTY_RESPONSE;
    }
  }

  /**
   * Convierte resultados a formato Track
   */
  toTracks(items: any[]): TrackInterface[] {
    if (!items || !Array.isArray(items)) return [];

    return items.map(item => ({
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

  /**
   * Encuentra un video de YouTube Music basado en información de Spotify
   * @param spotifyId ID de Spotify (opcional)
   * @param title Título de la canción
   * @param artist Artista
   */
  async spotifyToYoutube(
    spotifyId: string | undefined,
    title: string,
    artist: string
  ): Promise<any> {
    try {
      const params: Record<string, string> = {};

      if (spotifyId) {
        params.id = spotifyId;
      }

      params.title = title;
      params.artist = artist;

      const response = await axios.get(`${this.baseUrl}/spotify-to-youtube`, {
        params,
        timeout: API_CONFIG.getSearchTimeout()
      });

      return response.data;
    } catch (error) {
      console.error('[YouTubeMusicAPI] Error en spotifyToYoutube:', error);
      return null;
    }
  }

  /**
   * Encuentra un track específico en YouTube Music
   * @param title Título de la canción
   * @param artist Artista
   */
  async findTrack(title: string, artist: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/find-track`, {
        params: {
          title,
          artist
        },
        timeout: API_CONFIG.getSearchTimeout()
      });

      const data = response.data;

      // Normalizar el resultado para asegurar que thumbnail se mapea a cover
      if (data && data.thumbnail) {
        console.log(`[YTMusic API] FindTrack - Mapeando thumbnail a cover: ${data.thumbnail}`);
        data.cover = data.thumbnail;
      }

      return data;
    } catch (error) {
      console.error('[YouTubeMusicAPI] Error en findTrack:', error);
      return null;
    }
  }

  /**
   * Obtiene recomendaciones variadas de YouTube Music
   * @param limit Límite de resultados
   */
  async getRecommendations(limit: number = 50): Promise<any[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/recommendations`, {
        params: { limit },
        timeout: API_CONFIG.getRecommendationsTimeout()
      });

      const results = Array.isArray(response.data) ? response.data : [];

      // Aplicar normalización para asegurar que las miniaturas se manejan correctamente
      return normalizeYTMusicTracks(results);
    } catch (error) {
      console.error('[YouTubeMusicAPI] Error en getRecommendations:', error);
      return [];
    }
  }

  /**
   * Obtiene artistas populares de YouTube Music
   * @param limit Número máximo de artistas a retornar
   * @returns Lista de artistas populares
   */
  async getTopArtists(limit: number = 16): Promise<Artist[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/top-artists`, {
        params: { limit },
        timeout: API_CONFIG.getRecommendationsTimeout()
      });

      // Definimos un tipo para la respuesta esperada
      interface ArtistsResponse {
        items: Artist[];
      }

      const data = response.data as ArtistsResponse;
      if (data && data.items && Array.isArray(data.items)) {
        return data.items;
      }

      return [];
    } catch (error) {
      console.error('[YouTubeMusicAPI] Error al obtener artistas populares:', error);
      return [];
    }
  }

  /**
   * Obtiene recomendaciones por géneros
   */
  async getRecommendationsByGenres(genres: string[], limit: number = 20): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/recommendations-by-genres`, {
        params: {
          genres: genres,
          limit,
          artistsPerGenre: 20,
          playlistsPerGenre: 10,
          tracksPerGenre: 30
        },
        timeout: API_CONFIG.getRecommendationsTimeout(),
        paramsSerializer: (params: Record<string, any>) => {
          // Asegurar que los géneros se serializan correctamente como array
          let result = '';
          Object.keys(params).forEach(key => {
            if (key === 'genres' && Array.isArray(params[key])) {
              params[key].forEach((genre: string) => {
                result += `${key}[]=${encodeURIComponent(genre)}&`;
              });
            } else {
              result += `${key}=${encodeURIComponent(params[key])}&`;
            }
          });
          return result.slice(0, -1); // Eliminar el último '&'
        }
      });

      // Normalizar los tracks en la respuesta
      const data = response.data || {};

      if (data.tracks && Array.isArray(data.tracks)) {
        data.tracks = normalizeYTMusicTracks(data.tracks);
      }

      return data;
    } catch (error) {
      console.error('[YouTubeMusicAPI] Error obteniendo recomendaciones por géneros:', error);
      return {};
    }
  }

  async convertSpotifyTrackToYTMusic(
    spotifyId: string | undefined,
    title: string,
    artist: string
  ): Promise<any> {
    try {
      const params: Record<string, string> = {};

      if (spotifyId) {
        params.id = spotifyId;
      }

      params.title = title;
      params.artist = artist;

      const response = await axios.get(`${this.baseUrl}/spotify-to-youtube`, {
        params,
        timeout: API_CONFIG.getSearchTimeout()
      });

      const data = response.data;

      // Normalizar el resultado para asegurar que thumbnail se mapea a cover
      if (data && data.thumbnail) {
        data.cover = data.thumbnail;
      }

      return data;
    } catch (error) {
      console.error('[YouTubeMusicAPI] Error en spotifyToYoutube:', error);
      return null;
    }
  }

  /**
   * Obtiene playlists destacadas de YouTube Music
   * @param limit Número máximo de playlists a obtener
   * @returns Lista de playlists destacadas
   */
  async getFeaturedPlaylists(limit: number = 20): Promise<YouTubeMusicPlaylist[]> {
    try {
      // Obtener código de país del usuario
      const region = getCountryCode();
      console.log(`[YTMusic API] Obteniendo playlists destacadas con región: ${region}`);

      const response = await api.get('/featured-playlists', {
        params: { limit, region }
      });

      // Asegurar que el valor devuelto es un array y normalizarlo
      const playlists = Array.isArray(response.data) ? response.data : [];
      return normalizeFeaturedPlaylists(playlists);
    } catch (error) {
      console.error('Error al obtener playlists destacadas de YouTube Music:', error);
      return [];
    }
  }

  /**
   * Obtiene nuevos lanzamientos de YouTube Music
   * @param limit Número máximo de lanzamientos a obtener
   * @returns Lista de nuevos lanzamientos
   */
  async getNewReleases(limit: number = 20): Promise<YouTubeMusicAlbum[]> {
    try {
      // Obtener código de país del usuario
      const region = getCountryCode();
      console.log(`[YTMusic API] Obteniendo nuevos lanzamientos con región: ${region}`);

      const response = await api.get('/new-releases', {
        params: { limit, region }
      });

      // Asegurar que el valor devuelto es un array y normalizarlo
      const albums = Array.isArray(response.data) ? response.data : [];
      return normalizeAlbums(albums);
    } catch (error) {
      console.error('Error al obtener nuevos lanzamientos de YouTube Music:', error);
      return [];
    }
  }

  /**
   * Obtiene las canciones más populares o en tendencia de YouTube Music
   * @param limit Número máximo de canciones a obtener
   * @returns Lista de canciones populares
   */
  async getTopCharts(limit: number = 20): Promise<any[]> {
    try {
      // Obtener código de país del usuario
      const region = getCountryCode();
      console.log(`[YTMusic API] Obteniendo top charts con región: ${region}`);

      // Primero intentamos con el endpoint charts que tiene singles (canciones)
      const response = await api.get('/charts', {
        params: { limit, region }
      });

      if (response.data && response.data.singles && Array.isArray(response.data.singles)) {
        const tracks = response.data.singles.slice(0, limit);
        console.log(`[YTMusic API] Obtenidos ${tracks.length} singles de charts`);
        return tracks;
      }

      // Si no hay singles, intentamos con getRecommendations
      console.log(`[YTMusic API] No se encontraron singles en charts, probando con recomendaciones`);
      const recommendations = await this.getRecommendations(limit);

      if (recommendations && recommendations.length > 0) {
        return recommendations;
      }

      // Si todo falla, devolver array vacío
      console.warn(`[YTMusic API] No se pudieron obtener top charts`);
      return [];
    } catch (error) {
      console.error('Error al obtener top charts de YouTube Music:', error);
      return [];
    }
  }

  /**
   * Busca artistas relacionados con un género musical específico
   * @param genre Género musical
   * @param limit Número máximo de artistas a obtener
   * @returns Lista de artistas del género especificado
   */
  async getArtistsByGenre(genre: string, limit: number = 10): Promise<Artist[]> {
    try {
      // Obtener código de país del usuario
      const region = getCountryCode();
      // Obtener idioma del navegador para la búsqueda
      const language = navigator?.language?.split('-')[0] || 'en';

      console.log(`[YTMusic API] Obteniendo artistas por género ${genre} con región: ${region} y idioma: ${language}`);

      const response = await api.get('/artists-by-genre', {
        params: { genre, limit, region, language }
      });

      // Asegurar que el valor devuelto es un array y normalizarlo
      const artists = Array.isArray(response.data) ? response.data : [];
      return normalizeArtists(artists);
    } catch (error) {
      console.error(`Error al obtener artistas por género ${genre} de YouTube Music:`, error);
      return [];
    }
  }

  /**
   * Obtiene categorías de estado de ánimo (moods) de YouTube Music
   * @returns Categorías de estado de ánimo disponibles
   */
  async getMoodCategories(): Promise<any> {
    try {
      const apiBaseUrl = API_CONFIG.getNodeApiUrl();
      const response = await fetch(`${apiBaseUrl}/api/youtube/get-mood-categories`);

      if (!response.ok) {
        throw new Error(`Error obteniendo categorías de moods: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[YouTubeMusicAPI] Error obteniendo categorías de moods:', error);
      throw error;
    }
  }

  /**
   * Obtiene playlists para una categoría de estado de ánimo
   * @param params Identificador de la categoría de estado de ánimo
   * @returns Lista de playlists para la categoría
   */
  async getMoodPlaylists(params: string): Promise<any> {
    try {
      const apiBaseUrl = API_CONFIG.getNodeApiUrl();
      const response = await fetch(`${apiBaseUrl}/api/youtube/get-mood-playlists?params=${encodeURIComponent(params)}`);

      if (!response.ok) {
        throw new Error(`Error obteniendo playlists de mood: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[YouTubeMusicAPI] Error obteniendo playlists de mood:', error);
      throw error;
    }
  }

  /**
   * Obtiene charts de YouTube Music (top canciones, videos, artistas)
   * @param country Código de país ISO (ZZ por defecto para global)
   * @returns Datos de charts
   */
  async getCharts(country: string = 'ZZ'): Promise<any> {
    try {
      const apiBaseUrl = API_CONFIG.getNodeApiUrl();
      const response = await fetch(`${apiBaseUrl}/api/youtube/get-charts?country=${encodeURIComponent(country)}`);

      if (!response.ok) {
        throw new Error(`Error obteniendo charts: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[YouTubeMusicAPI] Error obteniendo charts:', error);
      throw error;
    }
  }
}

// Crear una instancia única de la API base
const baseAPI = new YouTubeMusicAPI();

// Crear la API con throttling
const youtubeMusicAPI = {
  // Funciones de búsqueda básicas
  search: withThrottle(baseAPI.search.bind(baseAPI), 'youtube'),
  searchTracks: withThrottle(baseAPI.searchTracks.bind(baseAPI), 'youtube'),
  searchSongs: withThrottle(baseAPI.searchSongs.bind(baseAPI), 'youtube'),
  findTrack: withThrottle(baseAPI.findTrack.bind(baseAPI), 'youtube'),
  findExactTrack: withThrottle(baseAPI.findTrack.bind(baseAPI), 'youtube'),

  // Funciones para artistas y géneros
  searchByGenre: withThrottle(baseAPI.getArtistsByGenre.bind(baseAPI), 'youtube'),
  searchArtist: withThrottle(baseAPI.findTrack.bind(baseAPI), 'youtube'),
  getPredefinedArtistsByGenre: withThrottle(baseAPI.getArtistsByGenre.bind(baseAPI), 'youtube'),

  // Funciones de recomendaciones
  getRecommendations: withThrottle(baseAPI.getRecommendations.bind(baseAPI), 'youtube'),

  // Funciones de exploración
  getFeaturedPlaylists: withThrottle(baseAPI.getFeaturedPlaylists.bind(baseAPI), 'youtube'),
  getNewReleases: withThrottle(baseAPI.getNewReleases.bind(baseAPI), 'youtube'),

  // Funciones de utilidad
  toTracks: baseAPI.toTracks.bind(baseAPI),
  isAvailable: () => baseAPI.isAvailable(),
  getTopCharts: baseAPI.getTopCharts.bind(baseAPI),
  getMoodCategories: baseAPI.getMoodCategories.bind(baseAPI),
  getMoodPlaylists: baseAPI.getMoodPlaylists.bind(baseAPI),
  getCharts: baseAPI.getCharts.bind(baseAPI)
};

// Exportar la función normalizeYTMusicTracks para uso en otros módulos
export { normalizeYTMusicTracks, youtubeMusicAPI };
export default youtubeMusicAPI;
