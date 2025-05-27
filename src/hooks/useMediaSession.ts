import { useEffect, useCallback, useRef } from 'react';
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

  // Referencia para evitar configurar los handlers múltiples veces
  const handlersConfiguredRef = useRef(false);
  
  // Referencias para las funciones callback para evitar closures stale
  const onPlayRef = useRef(onPlay);
  const onPauseRef = useRef(onPause);
  const onPreviousTrackRef = useRef(onPreviousTrack);
  const onNextTrackRef = useRef(onNextTrack);
  const onSeekToRef = useRef(onSeekTo);

  // Actualizar las referencias cuando cambien las funciones
  useEffect(() => {
    onPlayRef.current = onPlay;
    onPauseRef.current = onPause;
    onPreviousTrackRef.current = onPreviousTrack;
    onNextTrackRef.current = onNextTrack;
    onSeekToRef.current = onSeekTo;
  }, [onPlay, onPause, onPreviousTrack, onNextTrack, onSeekTo]);

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
    if (timeDiff < 2) return; // Solo actualizar cada 2 segundos

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
    if (!handlersConfiguredRef.current && 'mediaSession' in navigator) {
      try {
        // Play
        navigator.mediaSession.setActionHandler('play', () => {
          console.log('[MediaSession] Acción: Play');
          if (onPlayRef.current) onPlayRef.current();
        });

        // Pause
        navigator.mediaSession.setActionHandler('pause', () => {
          console.log('[MediaSession] Acción: Pause');
          if (onPauseRef.current) onPauseRef.current();
        });

        // Previous Track
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          console.log('[MediaSession] Acción: Previous Track');
          if (onPreviousTrackRef.current) onPreviousTrackRef.current();
        });

        // Next Track
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          console.log('[MediaSession] Acción: Next Track');
          if (onNextTrackRef.current) onNextTrackRef.current();
        });

        // Seek Backward
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          console.log('[MediaSession] Acción: Seek Backward');
          if (onSeekToRef.current) {
            const seekTime = (details.seekOffset || 10) * -1;
            onSeekToRef.current(seekTime);
          }
        });

        // Seek Forward
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          console.log('[MediaSession] Acción: Seek Forward');
          if (onSeekToRef.current) {
            const seekTime = details.seekOffset || 10;
            onSeekToRef.current(seekTime);
          }
        });

        // Seek To (para barras de progreso)
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          console.log('[MediaSession] Acción: Seek To');
          if (onSeekToRef.current && details.seekTime !== undefined) {
            onSeekToRef.current(details.seekTime);
          }
        });

        handlersConfiguredRef.current = true;
        console.log('[MediaSession] Action handlers configurados una sola vez');
      } catch (error) {
        console.warn('[MediaSession] Error al configurar action handlers:', error);
      }
    }
  }, []); // Sin dependencias para que solo se ejecute una vez

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