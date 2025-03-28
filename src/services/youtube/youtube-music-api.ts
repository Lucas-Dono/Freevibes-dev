import axios from 'axios';
import { Artist } from '@/types/types';
import { API_TIMEOUTS } from '@/lib/api-config';
import { getCountryCode } from '../../lib/utils';
import { withThrottle } from '@/lib/request-throttler';
import { Track } from '@/types/types';

// Importar el tipo YTMusicResult desde el índice para evitar referencias circulares
import { YTMusicResult } from './index';

// URL del servidor Node.js que actúa como proxy para el microservicio Python
const YTMUSIC_API_URL = process.env.YTMUSIC_API_URL || 'http://localhost:3001/api/youtube';

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
      this.checkAvailability();
    } else {
      console.log('[Config] YouTube Music API deshabilitada por configuración');
      this.available = false;
    }
  }
  
  /**
   * Verifica si el servicio está disponible
   */
  private async checkAvailability() {
    // Si ya se verificó globalmente y fue reciente (menos de 30 segundos), usar ese resultado
    const now = Date.now();
    if (globalAvailabilityStatus.checked && (now - globalAvailabilityStatus.lastCheck < 30000)) {
      this.available = globalAvailabilityStatus.available;
      return;
    }
    
    // Si ya se intentó localmente, no reintentar
    if (this.pingAttempted && (now - this.lastAvailabilityCheck < 60000)) return; 
    
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
        timeout: 5000 // Timeout mayor para primera verificación
      });
      
      // Si llegamos aquí, la búsqueda funcionó - el servicio está disponible
      this.available = true;
      globalAvailabilityStatus = {
        checked: true,
        available: true,
        lastCheck: now
      };
      
      console.log(`[YouTubeMusicAPI] Servicio disponible (verificado con búsqueda de prueba)`);
    } catch (error) {
      // Si fallamos con la búsqueda, intentar con el endpoint de estado
      try {
        const statusResponse = await axios.get<StatusResponse>(`${this.baseUrl.replace('/youtube', '/status')}`, {
          timeout: 3000
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
    }
  }
  
  /**
   * Verifica si el servicio está disponible
   */
  isAvailable(): boolean {
    return this.available;
  }
  
  /**
   * Método principal de búsqueda - será utilizado por searchSongs y searchTracks
   */
  async search(query: string, limit: number = 10): Promise<any[]> {
    if (!this.available) {
      return [];
    }
    
    try {
      return await withRetry(async () => {
        const response = await axios.get(`${this.baseUrl}/search`, {
          params: { query, filter: 'songs', limit },
          timeout: API_TIMEOUTS.SEARCH
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
   * Alias para search - para compatibilidad con otro código existente
   */
  searchTracks(query: string, limit: number = 10): Promise<any[]> {
    return this.search(query, limit);
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
        timeout: API_TIMEOUTS.SEARCH
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
        timeout: API_TIMEOUTS.SEARCH
      });
      
      return response.data;
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
        timeout: API_TIMEOUTS.RECOMMENDATIONS
      });
      
      return Array.isArray(response.data) ? response.data : [];
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
        timeout: API_TIMEOUTS.RECOMMENDATIONS
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
        timeout: API_TIMEOUTS.RECOMMENDATIONS,
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
      
      return response.data || {};
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
        timeout: API_TIMEOUTS.SEARCH
      });
      
      return response.data;
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
      
      // Asegurar que el valor devuelto es un array
      return Array.isArray(response.data) ? response.data : [];
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
      
      // Asegurar que el valor devuelto es un array
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Error al obtener nuevos lanzamientos de YouTube Music:', error);
      return [];
    }
  }

  /**
   * Obtiene artistas por género
   * @param genre Género musical
   * @param limit Número máximo de artistas a obtener
   * @returns Lista de artistas del género especificado
   */
  async getArtistsByGenre(genre: string, limit: number = 10): Promise<Artist[]> {
    try {
      // Obtener código de país del usuario
      const region = getCountryCode();
      console.log(`[YTMusic API] Obteniendo artistas por género ${genre} con región: ${region}`);
      
      const response = await api.get('/artists-by-genre', {
        params: { genre, limit, region }
      });
      
      // Asegurar que el valor devuelto es un array
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error(`Error al obtener artistas por género ${genre} de YouTube Music:`, error);
      return [];
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
  isAvailable: () => baseAPI.isAvailable()
};

export { youtubeMusicAPI };
export default youtubeMusicAPI; 