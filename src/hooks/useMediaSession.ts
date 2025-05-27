import { useEffect, useCallback } from 'react';
import { Track } from '@/types/types';

interface MediaSessionOptions {
  onPlay?: () => void;
  onPause?: () => void;
  onPreviousTrack?: () => void;
  onNextTrack?: () => void;
  onSeekTo?: (time: number) => void;
}

export const useMediaSession = (
  currentTrack: Track | null,
  isPlaying: boolean,
  options: MediaSessionOptions = {}
) => {
  const {
    onPlay,
    onPause,
    onPreviousTrack,
    onNextTrack,
    onSeekTo
  } = options;

  // Función para actualizar los metadatos de la Media Session
  const updateMediaMetadata = useCallback((track: Track) => {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || 'Álbum desconocido',
        artwork: [
          {
            src: track.cover || '/placeholder-album.jpg',
            sizes: '96x96',
            type: 'image/jpeg'
          },
          {
            src: track.cover || '/placeholder-album.jpg',
            sizes: '128x128',
            type: 'image/jpeg'
          },
          {
            src: track.cover || '/placeholder-album.jpg',
            sizes: '192x192',
            type: 'image/jpeg'
          },
          {
            src: track.cover || '/placeholder-album.jpg',
            sizes: '256x256',
            type: 'image/jpeg'
          },
          {
            src: track.cover || '/placeholder-album.jpg',
            sizes: '384x384',
            type: 'image/jpeg'
          },
          {
            src: track.cover || '/placeholder-album.jpg',
            sizes: '512x512',
            type: 'image/jpeg'
          }
        ]
      });

      console.log('[MediaSession] Metadatos actualizados:', track.title);
    } catch (error) {
      console.warn('[MediaSession] Error al actualizar metadatos:', error);
    }
  }, []);

  // Función para configurar los action handlers
  const setupActionHandlers = useCallback(() => {
    if (!('mediaSession' in navigator)) return;

    try {
      // Play
      navigator.mediaSession.setActionHandler('play', () => {
        console.log('[MediaSession] Acción: Play');
        if (onPlay) onPlay();
      });

      // Pause
      navigator.mediaSession.setActionHandler('pause', () => {
        console.log('[MediaSession] Acción: Pause');
        if (onPause) onPause();
      });

      // Previous Track
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        console.log('[MediaSession] Acción: Previous Track');
        if (onPreviousTrack) onPreviousTrack();
      });

      // Next Track
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        console.log('[MediaSession] Acción: Next Track');
        if (onNextTrack) onNextTrack();
      });

      // Seek Backward
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        console.log('[MediaSession] Acción: Seek Backward');
        if (onSeekTo) {
          const seekTime = (details.seekOffset || 10) * -1;
          onSeekTo(seekTime);
        }
      });

      // Seek Forward
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        console.log('[MediaSession] Acción: Seek Forward');
        if (onSeekTo) {
          const seekTime = details.seekOffset || 10;
          onSeekTo(seekTime);
        }
      });

      // Seek To (para barras de progreso)
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        console.log('[MediaSession] Acción: Seek To');
        if (onSeekTo && details.seekTime !== undefined) {
          onSeekTo(details.seekTime);
        }
      });

      console.log('[MediaSession] Action handlers configurados');
    } catch (error) {
      console.warn('[MediaSession] Error al configurar action handlers:', error);
    }
  }, [onPlay, onPause, onPreviousTrack, onNextTrack, onSeekTo]);

  // Función para actualizar el estado de reproducción
  const updatePlaybackState = useCallback((playing: boolean) => {
    if (!('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
      console.log('[MediaSession] Estado de reproducción:', playing ? 'playing' : 'paused');
    } catch (error) {
      console.warn('[MediaSession] Error al actualizar estado de reproducción:', error);
    }
  }, []);

  // Función para actualizar la posición de reproducción
  const updatePositionState = useCallback((
    duration: number,
    currentTime: number,
    playbackRate: number = 1.0
  ) => {
    if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;

    // Validar que los datos sean válidos antes de enviarlos
    if (!duration || duration <= 0 || !isFinite(duration)) {
      console.warn('[MediaSession] Duración inválida:', duration);
      return;
    }

    if (!isFinite(currentTime) || currentTime < 0) {
      console.warn('[MediaSession] Tiempo actual inválido:', currentTime);
      return;
    }

    // Asegurar que currentTime no sea mayor que duration
    const validCurrentTime = Math.min(currentTime, duration);
    
    // Solo actualizar si hay cambios significativos (evitar spam de actualizaciones)
    const timeDiff = Math.abs(validCurrentTime - (updatePositionState as any).lastTime || 0);
    if (timeDiff < 0.5) return; // Solo actualizar cada 0.5 segundos

    try {
      navigator.mediaSession.setPositionState({
        duration: duration,
        playbackRate: playbackRate,
        position: validCurrentTime
      });
      
      // Guardar el último tiempo para evitar actualizaciones innecesarias
      (updatePositionState as any).lastTime = validCurrentTime;
      
      console.log(`[MediaSession] Posición actualizada: ${Math.floor(validCurrentTime)}s / ${Math.floor(duration)}s`);
    } catch (error) {
      console.warn('[MediaSession] Error al actualizar posición:', error);
    }
  }, []);

  // Configurar Media Session cuando cambia la canción
  useEffect(() => {
    if (currentTrack) {
      updateMediaMetadata(currentTrack);
    }
  }, [currentTrack, updateMediaMetadata]);

  // Configurar action handlers una vez
  useEffect(() => {
    setupActionHandlers();
  }, [setupActionHandlers]);

  // Actualizar estado de reproducción
  useEffect(() => {
    updatePlaybackState(isPlaying);
  }, [isPlaying, updatePlaybackState]);

  return {
    updateMediaMetadata,
    updatePlaybackState,
    updatePositionState,
    isMediaSessionSupported: 'mediaSession' in navigator
  };
}; 