/**
 * Servicio centralizado de reproducción usando el sistema de Home
 * Este servicio implementa la lógica que sabemos que funciona bien en la página Home
 */

import { Track } from '@/types/types';
import { RecentTracksService } from '@/services/history/recentTracksService';

/**
 * Reproduce una canción usando el mismo sistema que funciona en Home
 * @param track - Información de la canción a reproducir
 * @param event - Evento del ratón (opcional)
 */
export async function homePlayTrack(track: any, event?: React.MouseEvent): Promise<void> {
  try {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Extraer la información relevante de la pista con mayor robustez
    const uri = track.id || track.uri || track.spotifyId || '';

    if (!uri) {
      console.error('[HomePlayService] URI/ID de canción no disponible', track);
      return;
    }

    console.log('[HomePlayService] Procesando reproducción para:', uri);

    // Definir los datos de la pista para enviar a la API con fallbacks para cada propiedad
    const trackName = track.title || track.name || '';
    const artistName = track.artist ||
                     (Array.isArray(track.artists) ? track.artists.map((a: any) => a.name).join(', ') : '') ||
                     '';

    // Asegurarse de que tenemos el mínimo de información necesaria
    if (!trackName || !artistName) {
      console.warn('[HomePlayService] Información insuficiente para la búsqueda en YouTube', { trackName, artistName });
      // Aún así continuamos, pero registramos la advertencia
    }

    // Estructura estandarizada para enviar a la API
    const trackData = {
      trackId: uri,
      name: trackName,
      artist: artistName
    };

    console.log(`[HomePlayService] Intentando reproducir: "${trackData.name}" de "${trackData.artist}"`);

    // Llamar a la API para obtener el ID de YouTube (igual que en Home)
    try {
      const response = await fetch('/api/spotify/play', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(trackData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Error HTTP: ${response.status}` }));
        throw new Error(errorData.message || `Error al reproducir: ${response.status}`);
      }

      // Obtener la respuesta con el ID de YouTube
      const youtubeData = await response.json();

      if (!youtubeData.videoId) {
        throw new Error('No se recibió ID de YouTube válido en la respuesta');
      }

      // Crear un objeto Track con la información necesaria para el reproductor
      // con múltiples fallbacks para cada propiedad
      const trackToPlay = {
        id: uri,
        title: youtubeData.title || trackName,
        artist: youtubeData.artist || artistName,
        album: typeof track.album === 'string'
              ? track.album
              : (track.album?.name || youtubeData.album || ''),
        cover: youtubeData.thumbnail ||
              track.cover ||
              track.albumCover ||
              (track.album?.images?.[0]?.url) ||
              (youtubeData.videoId ? `https://img.youtube.com/vi/${youtubeData.videoId}/hqdefault.jpg` : ''),
        duration: youtubeData.duration || track.duration || 0,
        spotifyId: uri,
        youtubeId: youtubeData.videoId
      };

      console.log('[HomePlayService] Enviando evento de reproducción con track:', trackToPlay);

      try {
        // Usar el evento personalizado para comunicar con el reproductor
        const customEvent = new CustomEvent('playTrack', { detail: trackToPlay });
        window.dispatchEvent(customEvent);
        console.log('[HomePlayService] Evento playTrack disparado correctamente');

        // También registrar la reproducción en el historial si está disponible
        try {
          // Usar el servicio importado directamente
          RecentTracksService.addTrackToHistory({
            trackId: uri,
            trackName: trackName,
            artistName: artistName,
            albumName: typeof track.album === 'string' ? track.album : (track.album?.name || ''),
            albumCover: track.cover || (track.album?.images?.[0]?.url) || '',
            source: (track.source || 'spotify') as 'spotify' | 'deezer' | 'lastfm' | 'youtube' | 'local',
            sourceData: {
              uri: uri,
              duration_ms: track.duration_ms || (track.duration ? track.duration * 1000 : 0) || 0,
              videoId: youtubeData.videoId
            }
          });
        } catch (historyError) {
          // Si falla el registro en historial, no afecta a la reproducción
          console.warn('[HomePlayService] No se pudo registrar en historial:', historyError);
        }

        return;
      } catch (eventError) {
        console.error('[HomePlayService] Error al disparar evento playTrack:', eventError);
        throw eventError;
      }
    } catch (apiError) {
      console.error('[HomePlayService] Error en la llamada a la API:', apiError);
      throw apiError;
    }
  } catch (error) {
    console.error('[HomePlayService] Error al reproducir:', error);

    // Notificar del error
    if (typeof error === 'object' && error !== null && 'message' in error) {
      console.error('[HomePlayService] Detalles del error:', (error as Error).message);
    }

    // Crear y disparar un evento de error para que la UI pueda mostrar algo al usuario
    try {
      const errorEvent = new CustomEvent('playbackError', {
        detail: {
          message: error instanceof Error ? error.message : 'Error al reproducir la canción',
          track: track
        }
      });
      window.dispatchEvent(errorEvent);
    } catch (eventError) {
      console.error('[HomePlayService] No se pudo notificar el error a la UI:', eventError);
    }

    throw error;
  }
}

// Mantener la compatibilidad con el nombre original para código existente
export const playTrack = homePlayTrack;

export default {
  homePlayTrack,
  playTrack: homePlayTrack
};
