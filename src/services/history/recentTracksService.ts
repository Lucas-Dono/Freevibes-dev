import { IRecentTrack } from '@/models/RecentTrack';
import { getMultiSourceTrackDetails, batchProcessQueries } from '@/services/recommendations/multi-source-recommender';
import { Track } from '@/types/types';
import { connectToDatabase } from '@/lib/db/mongodb';

// Interfaz para las pistas enriquecidas con información de APIs externas
export interface EnrichedTrack extends Track {
  playedAt: number | Date;
}

// Tipo para analizar la estructura del álbum que puede venir de diferentes APIs
interface AlbumWithImages {
  name: string;
  images: Array<{url: string}>;
}

/**
 * Servicio para gestionar el historial de canciones escuchadas
 */
export class RecentTracksService {
  // Caché en memoria para reducir búsquedas repetidas
  private static trackDetailsCache: Map<string, EnrichedTrack> = new Map();
  
  /**
   * Obtiene información del usuario desde cookies
   */
  private static getUserFromCookies(): string | undefined {
    try {
      if (typeof window === 'undefined') return undefined;
      
      // Intentar obtener desde cookies
      const cookies = document.cookie.split(';');
      const userCookie = cookies.find(c => c.trim().startsWith('spotify_user='));
      
      if (userCookie) {
        const userJson = decodeURIComponent(userCookie.split('=')[1]);
        try {
          const userData = JSON.parse(userJson);
          return userData.id || userData.email;
        } catch (error) {
          console.warn('Error al parsear cookie de usuario:', error);
        }
      }
      
      // Intentar obtener del localStorage como fallback
      const userData = localStorage.getItem('userData');
      if (userData) {
        try {
          const user = JSON.parse(userData);
          return user.id || user.email;
        } catch (error) {
          console.warn('Error al parsear userData del localStorage:', error);
        }
      }
      
      return undefined;
    } catch (error) {
      console.error('Error obteniendo usuario de cookies:', error);
      return undefined;
    }
  }
  
  /**
   * Elimina tracks duplicados del historial basándose en título y artista
   * @param tracks Lista de tracks con posibles duplicados
   * @returns Lista de tracks sin duplicados
   */
  static removeDuplicateTracks<T extends {
    title?: string;
    trackName?: string;
    artist?: string;
    artistName?: string;
  }>(tracks: T[]): T[] {
    const seen = new Map<string, boolean>();
    
    return tracks.filter((track) => {
      // Obtener título normalizado (compatible con ambos formatos)
      const title = ((track.title || track.trackName) || '').toLowerCase().trim();
      
      // Obtener artista normalizado (compatible con ambos formatos)
      const artist = ((track.artist || track.artistName) || '').toLowerCase().trim();
      
      // Crear clave única basada en título y artista
      const key = `${title}:${artist}`;
      
      // Si ya hemos visto esta combinación, filtrar el elemento
      if (seen.has(key)) {
        return false;
      }
      
      // Caso contrario, marcar como visto y mantener el elemento
      seen.set(key, true);
      return true;
    });
  }
  
  /**
   * Enriquece las pistas del historial con información detallada de múltiples fuentes
   */
  static async enrichHistoryTracks(historyTracks: IRecentTrack[]): Promise<EnrichedTrack[]> {
    try {
      
      // Primero eliminar duplicados para evitar procesamiento innecesario
      const uniqueHistoryTracks = this.removeDuplicateTracks(historyTracks);
      
      
      // Preparar mapa de tracks por ID para mantener orden original
      const trackById: Record<string, IRecentTrack> = {};
      const uniqueQueries: string[] = [];
      const queryToTrackIdMap: Record<string, string[]> = {};
      
      // Extraer consultas únicas para procesar en lote
      uniqueHistoryTracks.forEach(track => {
        trackById[track.trackId] = track;
        
        // Crear consulta para este track
        const searchQuery = `${track.trackName} ${track.artistName}`.trim();
        
        // Registrar relación entre consulta y track ID
        if (!queryToTrackIdMap[searchQuery]) {
          queryToTrackIdMap[searchQuery] = [];
          uniqueQueries.push(searchQuery);
        }
        queryToTrackIdMap[searchQuery].push(track.trackId);
      });
      
      
      // Procesar todas las consultas en lote
      const batchResults = await batchProcessQueries(uniqueQueries, { 
        limit: 1,
        timeout: 12000 // Tiempo límite más largo para procesar historial
      });
      
      // Reconstruir resultados originales manteniendo el orden
      const results: EnrichedTrack[] = [];
      
      // Iterar sobre tracks originales para mantener orden
      for (const track of uniqueHistoryTracks) {
        const searchQuery = `${track.trackName} ${track.artistName}`.trim();
        const foundTracks = batchResults[searchQuery] || [];
        
        if (foundTracks.length > 0) {
          // Enriquecer con detalles extendidos
          results.push({
            id: track.trackId,
            title: foundTracks[0].title || track.trackName,
            artist: foundTracks[0].artist || track.artistName,
            album: track.albumName || 'Unknown Album',
            cover: foundTracks[0].cover || track.albumCover || '',
            duration: foundTracks[0].duration || track.sourceData?.duration_ms || 0,
            source: foundTracks[0].source || track.source,
            youtubeId: foundTracks[0].youtubeId,
            playedAt: track.playedAt
          });
        } else {
          // Usar información básica si no hay detalles extendidos
          results.push({
            id: track.trackId,
            title: track.trackName,
            artist: track.artistName,
            album: track.albumName || 'Unknown Album',
            cover: track.albumCover || '',
            duration: track.sourceData?.duration_ms || 0,
            source: track.source || 'local',
            playedAt: track.playedAt
          });
        }
      }
      
      return results;
    } catch (error) {
      console.error('[HistoryService] Error enriqueciendo tracks:', error);
      
      // En caso de error, devolver tracks básicos (sin duplicados)
      const uniqueHistoryTracks = this.removeDuplicateTracks(historyTracks);
      return uniqueHistoryTracks.map(track => ({
        id: track.trackId,
        title: track.trackName,
        artist: track.artistName,
        album: track.albumName || 'Unknown Album',
        cover: track.albumCover || '',
        duration: track.sourceData?.duration_ms || 0,
        source: track.source || 'local',
        playedAt: track.playedAt
      }));
    }
  }
  
  /**
   * Registra una canción en el historial
   */
  static async addTrackToHistory(trackData: {
    userId?: string;
    trackId: string;
    trackName: string;
    artistName: string;
    albumName: string;
    albumCover: string;
    source: 'spotify' | 'deezer' | 'lastfm' | 'youtube' | 'local';
    sourceData: any;
  }): Promise<void> {
    try {
      // Intentar obtener el ID del usuario si no se proporciona
      if (!trackData.userId) {
        trackData.userId = this.getUserFromCookies() || 'guest-user';
      }
      
      // Añadir timestamp para el seguimiento local
      const trackWithTimestamp = {
        ...trackData,
        playedAt: new Date().toISOString()
      };
      
      // Almacenar también en localStorage como respaldo
      this.addToLocalStorage(trackWithTimestamp);
      
      // Hacer solicitud a la API para guardar en el historial
      const response = await fetch('/api/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(trackData),
        credentials: 'include' // Importante: incluye cookies en la petición
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.warn('Error en respuesta al guardar historial:', error);
        // No lanzamos excepción para evitar interrumpir la reproducción
      }
    } catch (error) {
      console.error('Error al agregar track al historial:', error);
      // No lanzamos excepción para evitar interrumpir la reproducción
    }
  }
  
  /**
   * Almacena una canción en el historial local (localStorage)
   */
  private static addToLocalStorage(trackData: any): void {
    try {
      // Obtener historial existente
      const existingHistory = localStorage.getItem('recentTracks');
      let tracks = [];
      
      if (existingHistory) {
        tracks = JSON.parse(existingHistory);
        if (!Array.isArray(tracks)) tracks = [];
      }
      
      // Convertir a formato consistente para almacenamiento local
      const trackToStore = {
        id: trackData.trackId,
        title: trackData.trackName,
        artist: trackData.artistName,
        album: trackData.albumName,
        cover: trackData.albumCover,
        source: trackData.source,
        playedAt: new Date().getTime()
      };
      
      // Eliminar duplicados existentes (misma canción y artista)
      const filteredTracks = tracks.filter((t: any) => {
        if (!t.title || !t.artist) return true;
        const existingTitle = t.title.toLowerCase().trim();
        const existingArtist = t.artist.toLowerCase().trim();
        const newTitle = trackToStore.title.toLowerCase().trim();
        const newArtist = trackToStore.artist.toLowerCase().trim();
        return !(existingTitle === newTitle && existingArtist === newArtist);
      });
      
      // Añadir al inicio del array
      filteredTracks.unshift(trackToStore);
      
      // Limitar a 50 canciones
      const limitedTracks = filteredTracks.slice(0, 50);
      
      // Guardar en localStorage
      localStorage.setItem('recentTracks', JSON.stringify(limitedTracks));
      
    } catch (error) {
      console.error('Error al guardar en localStorage:', error);
    }
  }
  
  /**
   * Obtiene el historial de canciones escuchadas recientemente
   */
  static async getHistory(limit: number = 10, retryCount = 0): Promise<EnrichedTrack[]> {
    const MAX_RETRIES = 2; // Número máximo de reintentos
    
    try {
      const fetchPromise = fetch(`/api/history?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        credentials: 'include' // Importante: incluye cookies en la petición
      });
      
      // Crear una promesa de timeout
      const timeoutPromise = new Promise<Response>((_, reject) => {
        setTimeout(() => {
          reject(new Error('La petición ha excedido el tiempo límite'));
        }, 15000); // Aumentar a 15 segundos de timeout
      });
      
      // Competir entre la petición y el timeout
      let response: Response;
      try {
        response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
      } catch (timeoutError) {
        console.warn(`Timeout al obtener historial del servidor (intento ${retryCount + 1}/${MAX_RETRIES + 1}):`, timeoutError);
        
        // Si no hemos excedido el número máximo de reintentos, intentar de nuevo
        if (retryCount < MAX_RETRIES) {
          // Esperar un tiempo antes de reintentar (backoff exponencial)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
          return this.getHistory(limit, retryCount + 1);
        }
        
        return this.getLocalHistory(limit);
      }
      
      // Verificar si la respuesta es OK
      if (!response.ok) {
        console.warn(`Respuesta API no OK: ${response.status} ${response.statusText}`);
        
        // Si el error es 401 (no autorizado), intentar con un reintento como invitado
        if (response.status === 401) {
          try {
            const guestResponse = await fetch(`/api/history?limit=${limit}&guest=true`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
              }
            });
            
            if (guestResponse.ok) {
              return this.processApiResponse(await guestResponse.json(), limit);
            }
          } catch (guestError) {
            console.warn('Error en reintento como invitado:', guestError);
          }
        }
        
        // Si aún hay problemas, usar el historial local
        return this.getLocalHistory(limit);
      }
      
      // Procesar respuesta exitosa
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Error al procesar JSON de respuesta:', jsonError);
        return this.getLocalHistory(limit);
      }
      
      return this.processApiResponse(data, limit);
    } catch (error) {
      console.error('Error al obtener historial:', error);
      return this.getLocalHistory(limit);
    }
  }
  
  /**
   * Procesa la respuesta de la API de historial
   */
  private static processApiResponse(data: any, limit: number): EnrichedTrack[] {
    if (!data.tracks || !Array.isArray(data.tracks)) {
      return this.getLocalHistory(limit);
    }
    
    if (data.tracks.length === 0) {
      return this.getLocalHistory(limit);
    }
    
    // Convertir a formato EnrichedTrack
    const enrichedTracks: EnrichedTrack[] = data.tracks.map((track: any) => ({
      id: track.trackId || track.id || `track-${Math.random().toString(36).substr(2, 9)}`,
      title: track.trackName || track.title || 'Canción desconocida',
      artist: track.artistName || track.artist || 'Artista desconocido',
      album: track.albumName || track.album || 'Álbum desconocido',
      cover: track.albumCover || track.cover || '/image/default-cover.jpg',
      duration: track.sourceData?.duration_ms || track.duration || 0,
      playedAt: new Date(track.playedAt).getTime(),
      source: track.source || 'local'
    }));
    
    // Eliminar duplicados
    const uniqueTracks = this.removeDuplicateTracks(enrichedTracks);
    
    // Guardar en localStorage como respaldo
    this.saveTracksToLocalStorage(uniqueTracks);
    
    return uniqueTracks;
  }
  
  /**
   * Obtiene el historial desde localStorage como fallback
   */
  private static getLocalHistory(limit: number = 10): EnrichedTrack[] {
    try {
      const localHistory = localStorage.getItem('recentTracks');
      if (localHistory) {
        const parsedHistory = JSON.parse(localHistory);
        if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
          
          // Convertir a EnrichedTrack y limitar al número solicitado
          const localTracks = parsedHistory
            .slice(0, limit)
            .map((track: any) => ({
              ...track,
              playedAt: track.playedAt || Date.now()
            }));
          
          return this.removeDuplicateTracks(localTracks);
        }
      }
    } catch (localError) {
      console.error('Error al recuperar historial local:', localError);
    }
    
    return [];
  }
  
  /**
   * Guarda las pistas en localStorage como respaldo
   */
  private static saveTracksToLocalStorage(tracks: EnrichedTrack[]): void {
    try {
      if (!tracks || !Array.isArray(tracks) || tracks.length === 0) return;
      
      // Simplificar tracks para almacenamiento local
      const simpleTracks = tracks.map(track => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        cover: track.cover,
        source: track.source,
        playedAt: track.playedAt
      }));
      
      // Limitar a 50 canciones
      const limitedTracks = simpleTracks.slice(0, 50);
      
      // Guardar en localStorage
      localStorage.setItem('recentTracks', JSON.stringify(limitedTracks));
    } catch (error) {
      console.error('Error al guardar tracks en localStorage:', error);
    }
  }
} 