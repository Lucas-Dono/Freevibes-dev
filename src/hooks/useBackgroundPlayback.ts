import { useEffect, useRef, useCallback } from 'react';

interface BackgroundPlaybackOptions {
  onVisibilityChange?: (isVisible: boolean) => void;
  preventPause?: boolean;
  enableWakeLock?: boolean;
}

export const useBackgroundPlayback = (options: BackgroundPlaybackOptions = {}) => {
  const {
    onVisibilityChange,
    preventPause = true,
    enableWakeLock = true
  } = options;

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  const playerRef = useRef<any>(null);

  // Función para solicitar Wake Lock (mantener pantalla activa)
  const requestWakeLock = useCallback(async () => {
    if (!enableWakeLock || !('wakeLock' in navigator)) return;

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      console.log('[BackgroundPlayback] Wake Lock activado');
    } catch (error) {
      console.warn('[BackgroundPlayback] No se pudo activar Wake Lock:', error);
    }
  }, [enableWakeLock]);

  // Función para liberar Wake Lock
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('[BackgroundPlayback] Wake Lock liberado');
      } catch (error) {
        console.warn('[BackgroundPlayback] Error al liberar Wake Lock:', error);
      }
    }
  }, []);

  // Función para manejar cambios de visibilidad
  const handleVisibilityChange = useCallback(() => {
    const isVisible = !document.hidden;
    
    console.log('[BackgroundPlayback] Cambio de visibilidad:', isVisible ? 'visible' : 'oculto');
    
    if (onVisibilityChange) {
      onVisibilityChange(isVisible);
    }

    // Si la página se oculta y estamos reproduciendo, intentar mantener la reproducción
    if (!isVisible && isPlayingRef.current && preventPause && playerRef.current) {
      // Múltiples intentos de reanudar con diferentes delays
      const retryIntervals = [100, 300, 500, 1000, 2000];
      
      retryIntervals.forEach((delay, index) => {
        setTimeout(() => {
          try {
            if (!isPlayingRef.current) return; // Si ya no está reproduciendo, no hacer nada
            
            if (typeof playerRef.current.getPlayerState === 'function') {
              const state = playerRef.current.getPlayerState();
              if (state === 2) { // Estado pausado
                console.log(`[BackgroundPlayback] Intento ${index + 1}: Reanudando reproducción en segundo plano`);
                playerRef.current.playVideo();
              }
            }
          } catch (error) {
            console.warn(`[BackgroundPlayback] Error en intento ${index + 1}:`, error);
          }
        }, delay);
      });
    }

    // Manejar Wake Lock según visibilidad
    if (isVisible && isPlayingRef.current) {
      requestWakeLock();
    } else if (!isVisible) {
      // No liberar Wake Lock inmediatamente para mantener reproducción
      // Solo liberar si realmente se pausa la música
    }
  }, [onVisibilityChange, preventPause, requestWakeLock]);

  // Función para manejar eventos de pausa/foco de la ventana
  const handleWindowBlur = useCallback(() => {
    console.log('[BackgroundPlayback] Ventana perdió el foco');
    
    // Intentar mantener la reproducción activa con múltiples intentos
    if (isPlayingRef.current && preventPause && playerRef.current) {
      const retryIntervals = [200, 500, 1000, 1500, 3000];
      
      retryIntervals.forEach((delay, index) => {
        setTimeout(() => {
          try {
            if (!isPlayingRef.current) return; // Si ya no está reproduciendo, no hacer nada
            
            if (typeof playerRef.current.getPlayerState === 'function') {
              const state = playerRef.current.getPlayerState();
              if (state === 2) { // Estado pausado
                console.log(`[BackgroundPlayback] Blur - Intento ${index + 1}: Reanudando tras pérdida de foco`);
                playerRef.current.playVideo();
              }
            }
          } catch (error) {
            console.warn(`[BackgroundPlayback] Blur - Error en intento ${index + 1}:`, error);
          }
        }, delay);
      });
    }
  }, [preventPause]);

  const handleWindowFocus = useCallback(() => {
    console.log('[BackgroundPlayback] Ventana recuperó el foco');
    
    if (isPlayingRef.current) {
      requestWakeLock();
    }
  }, [requestWakeLock]);

  // Función para actualizar el estado de reproducción
  const setIsPlaying = useCallback((playing: boolean) => {
    isPlayingRef.current = playing;
    
    if (playing) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
  }, [requestWakeLock, releaseWakeLock]);

  // Función para establecer la referencia del player
  const setPlayerRef = useCallback((player: any) => {
    playerRef.current = player;
  }, []);

  // Configurar event listeners
  useEffect(() => {
    // Event listeners para cambios de visibilidad
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    // Event listener para cuando se libera automáticamente el Wake Lock
    const handleWakeLockRelease = () => {
      console.log('[BackgroundPlayback] Wake Lock liberado automáticamente');
      wakeLockRef.current = null;
    };

    if (wakeLockRef.current) {
      wakeLockRef.current.addEventListener('release', handleWakeLockRelease);
    }

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      
      if (wakeLockRef.current) {
        wakeLockRef.current.removeEventListener('release', handleWakeLockRelease);
        releaseWakeLock();
      }
    };
  }, [handleVisibilityChange, handleWindowBlur, handleWindowFocus, releaseWakeLock]);

  // Función para forzar la reproducción (útil para casos específicos)
  const forcePlay = useCallback(() => {
    if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
      try {
        playerRef.current.playVideo();
        console.log('[BackgroundPlayback] Reproducción forzada');
      } catch (error) {
        console.warn('[BackgroundPlayback] Error al forzar reproducción:', error);
      }
    }
  }, []);

  return {
    setIsPlaying,
    setPlayerRef,
    forcePlay,
    requestWakeLock,
    releaseWakeLock,
    isWakeLockSupported: 'wakeLock' in navigator
  };
}; 