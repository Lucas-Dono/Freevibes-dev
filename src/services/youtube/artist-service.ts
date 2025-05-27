/**
 * Servicio para obtener información de artistas de YouTube Music
 */

import axios from 'axios';
import { API_TIMEOUTS } from '@/lib/constants';
import { searchYouTubeChannels } from './youtube-api';

// Interfaz para las canciones de un artista
export interface YTArtistSong {
  videoId: string;
  title: string;
  thumbnails: Array<{ url: string; width: number; height: number }>;
  artists?: Array<{ name: string; id: string }>;
  album?: string;
}

// Interfaz para los álbumes de un artista
export interface YTArtistAlbum {
  title: string;
  thumbnails: Array<{ url: string; width: number; height: number }>;
  year: string;
  browseId: string;
}

// Interfaz para los artistas relacionados
export interface YTRelatedArtist {
  browseId: string;
  subscribers: string;
  title: string;
}

// Interfaz para los videos de un artista
export interface YTArtistVideo {
  title: string;
  thumbnails: Array<{ url: string; width: number; height: number }>;
  views: string;
  videoId: string;
  playlistId: string;
}

// Interfaz principal para la información de un artista de YouTube Music
export interface YTArtistInfo {
  id: string;
  name: string;
  description: string;
  thumbnails: Array<{ url: string; width: number; height: number }>;
  subscribers: string;
  views: string;
  songs?: {
    browseId?: string;
    results: YTArtistSong[];
  };
  albums?: {
    browseId?: string;
    params?: string;
    results: YTArtistAlbum[];
  };
  singles?: {
    browseId?: string;
    params?: string;
    results: YTArtistAlbum[];
  };
  videos?: {
    browseId?: string;
    results: YTArtistVideo[];
  };
  related?: {
    results: YTRelatedArtist[];
  };
  source: string;
  error?: string;
}

/**
 * Busca un artista de YouTube por su nombre utilizando la API oficial de YouTube
 * @param artistName Nombre del artista a buscar
 * @returns ID del canal de YouTube del artista, o null si no se encuentra
 */
export async function findYouTubeArtistByName(artistName: string): Promise<string | null> {
  try {
    console.log(`[YouTube Artist Service] Buscando artista por nombre: "${artistName}"`);

    // Buscar canales que coincidan con el nombre del artista
    const channels = await searchYouTubeChannels(artistName);

    if (channels && channels.length > 0) {
      // Tomamos el primer resultado como el más relevante
      const channelId = channels[0].id.channelId;
      console.log(`[YouTube Artist Service] Artista encontrado con ID: ${channelId}`);
      return channelId;
    }

    console.log(`[YouTube Artist Service] No se encontraron canales para: "${artistName}"`);
    return null;
  } catch (error) {
    console.error(`[YouTube Artist Service] Error al buscar artista por nombre "${artistName}":`, error);
    return null;
  }
}

/**
 * Obtiene información detallada de un artista en YouTube Music
 * @param artistId ID del artista en YouTube Music
 * @returns Información detallada del artista
 */
export async function getYouTubeArtistInfo(artistId: string): Promise<YTArtistInfo> {
  try {
    console.log(`[YouTube Artist Service] Obteniendo información del artista: ${artistId}`);

    // Obtener idioma del navegador para obtener resultados relevantes
    const language = navigator.language.split('-')[0] || 'es';

    // Realizar la petición a la API
    const response = await axios.get('/api/youtube-music/artist/' + artistId, {
      params: {
        language
      },
      timeout: API_TIMEOUTS.DETAILS
    });

    console.log(`[YouTube Artist Service] Información obtenida para artista: ${artistId}`);
    return response.data;
  } catch (error) {
    console.error(`[YouTube Artist Service] Error al obtener información del artista ${artistId}:`, error);

    // Devolver un objeto de error con información básica
    return {
      id: artistId,
      name: 'Artista no encontrado',
      description: '',
      thumbnails: [],
      subscribers: '0',
      views: '0',
      source: 'youtube_music',
      error: 'No se pudo obtener información del artista'
    };
  }
}
