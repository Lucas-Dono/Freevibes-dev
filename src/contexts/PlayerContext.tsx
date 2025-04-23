'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { getLyrics, parseSyncedLyrics } from '@/services/lyricsService';
import { getAPIConfig } from '@/lib/api-config';
// Importar el tipo Track de types.ts
import { Track as AppTrack, LyricLine as AppLyricLine } from '@/types/types';

// Interfaces para la API de YouTube
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | null;
    _debugYTPlayer?: any;
  }
}

// Re-exportar el tipo Track desde types.ts para asegurar compatibilidad
export type Track = AppTrack;
export type LyricLine = AppLyricLine;

// Extender la interfaz Track para incluir campos adicionales necesarios
export interface ExtendedTrack extends Track {
  audioUrl?: string; // URL directa al archivo de audio para reproductor de fallback
}

interface PlayerContextType {
  currentTrack: Track | null;
  playlist: Track[];
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  lyrics: {
    plain: string | null;
    synced: LyricLine[];
    isLoading: boolean;
  };
  isLoading: boolean;
  error: string;
  isShuffleEnabled: boolean;
  isRepeatEnabled: boolean;
  playTrack: (track: Track) => void;
  playPlaylist: (tracks: Track[], startIndex?: number) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  setVolume: (volume: number) => void;
  seekTo: (time: number) => void;
  addToQueue: (track: Track) => void;
  createAutoPlaylist: (track: Track) => Promise<void>; // Nueva función para generar lista automática
  toggleShuffle: () => void;
  toggleRepeat: () => void;
}

// Valor por defecto del contexto
const defaultContextValue: PlayerContextType = {
  currentTrack: null,
  playlist: [],
  isPlaying: false,
  volume: 0.7,
  currentTime: 0,
  duration: 0,
  lyrics: {
    plain: null,
    synced: [],
    isLoading: true,
  },
  isLoading: false,
  error: "",
  isShuffleEnabled: false,
  isRepeatEnabled: false,
  playTrack: () => {},
  playPlaylist: () => {},
  togglePlay: () => {},
  nextTrack: () => {},
  previousTrack: () => {},
  setVolume: () => {},
  seekTo: () => {},
  addToQueue: () => {},
  createAutoPlaylist: async () => {}, // Función vacía por defecto
  toggleShuffle: () => {},
  toggleRepeat: () => {},
};

// Crear el contexto
const PlayerContext = createContext<PlayerContextType>(defaultContextValue);

// Hook personalizado para usar el contexto
export const usePlayer = () => useContext(PlayerContext);

interface PlayerProviderProps {
  children: React.ReactNode;
  youtubeReady?: boolean;
}

// Proveedor del contexto
export const PlayerProvider = ({ children, youtubeReady = false }: PlayerProviderProps) => {
  // Referencias y estados para el reproductor de YouTube
  const youtubePlayerRef = useRef<any>(null);

  // Referencia para controlar el temporizador de siguiente canción
  const nextTrackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Estados principales del reproductor
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [originalPlaylist, setOriginalPlaylist] = useState<Track[]>([]); // Almacena la lista original sin mezclar
  const [isPlaying, setIsPlaying] = useState(false);
  const [volumeState, setVolumeState] = useState(0.7);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isShuffleEnabled, setIsShuffleEnabled] = useState<boolean>(false);
  const [isRepeatEnabled, setIsRepeatEnabled] = useState<boolean>(false);

  // Agregar estado para lyrics
  const [lyrics, setLyrics] = useState<{
    plain: string | null;
    synced: LyricLine[];
    isLoading: boolean;
  }>({
    plain: null,
    synced: [],
    isLoading: false
  });

  // Estado adicional para rastrear cambios
  const [lastPlaylistUpdate, setLastPlaylistUpdate] = useState<number>(Date.now());
  const [lastPlaylistLength, setLastPlaylistLength] = useState<number>(0);

  // Referencias para evitar "stale closures"
  const playlistRef = useRef<Track[]>([]);
  const currentIndexRef = useRef<number>(-1);

  // Estado para el índice actual
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  // Actualizar referencias cuando cambian los estados
  useEffect(() => {
    playlistRef.current = playlist;
    setLastPlaylistLength(playlist.length);

    // Registrar cambios en la playlist para depuración
    if (playlist.length !== lastPlaylistLength) {
      console.log(`[PlayerContext] Playlist actualizada: ${playlist.length} canciones (anterior: ${lastPlaylistLength})`);
      setLastPlaylistUpdate(Date.now());
    }
  }, [playlist, lastPlaylistLength]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;

    // Registrar cambios en el índice actual para depuración
    console.log(`[PlayerContext] Índice actual actualizado: ${currentIndex}`);
  }, [currentIndex]);

  // Referencia al reproductor de YouTube
  const [youtubePlayer, setYoutubePlayer] = useState<any>(null);
  const [isYoutubeReady, setIsYoutubeReady] = useState<boolean>(false);

  // Referencia para isPlaying para evitar "stale closure"
  const isPlayingRef = useRef<boolean>(isPlaying);

  // Actualizar la referencia cuando cambie isPlaying
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    console.log('[PlayerContext] isPlaying actualizado a:', isPlaying, 'isPlayingRef actualizado a:', isPlayingRef.current);
  }, [isPlaying]);

  // Referencia para el intervalo de tiempo
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Función para iniciar actualizaciones periódicas del tiempo
  const startTimeUpdates = () => {
    console.log('[PlayerContext] Iniciando actualizaciones de tiempo...');

    // Verificamos si hay un intervalo existente y lo limpiamos
    if (timeUpdateIntervalRef.current) {
      console.log('[PlayerContext] Limpiando intervalo existente');
      clearInterval(timeUpdateIntervalRef.current);
      timeUpdateIntervalRef.current = null;
    }

    // Solo establecer el intervalo si el reproductor está disponible
    if (!youtubePlayerRef.current) {
      console.log('[PlayerContext] No se puede iniciar actualizaciones de tiempo: reproductor no disponible');

      // Establecer un temporizador para intentar nuevamente
      setTimeout(() => {
        console.log('[PlayerContext] Reintentando iniciar actualizaciones de tiempo...');
      if (youtubePlayerRef.current) {
          startTimeUpdates();
    } else {
          console.log('[PlayerContext] El reproductor sigue sin estar disponible');
          }
      }, 1000);

      return;
    }

    // Crear un intervalo para actualizar el tiempo actual
    timeUpdateIntervalRef.current = setInterval(() => {
      // Verificar que el reproductor y sus métodos estén disponibles
      if (!youtubePlayerRef.current) {
        console.log('[PlayerContext] Reproductor no disponible durante actualización de tiempo');
        return;
      }

      try {
        // Verificar que getCurrentTime es una función
        if (typeof youtubePlayerRef.current.getCurrentTime !== 'function') {
          console.log('[PlayerContext] getCurrentTime no es una función');
        return;
      }

        // Actualizar el tiempo actual independientemente del estado de reproducción
        // Esto garantiza que siempre tengamos el tiempo correcto
          const currentSeconds = youtubePlayerRef.current.getCurrentTime();
          setCurrentTime(currentSeconds);

          // También verificamos si la duración está correctamente establecida
          if (duration <= 0 && typeof youtubePlayerRef.current.getDuration === 'function') {
            try {
              const videoDuration = youtubePlayerRef.current.getDuration();
              if (videoDuration && videoDuration > 0) {
                console.log('[PlayerContext] Actualizando duración durante reproducción:', videoDuration);
                setDuration(videoDuration);
              }
            } catch (durationError) {
              console.error('[PlayerContext] Error al obtener duración durante reproducción:', durationError);
            }
      }
    } catch (error) {
        console.error('[PlayerContext] Error en la actualización de tiempo:', error);
      }
    }, 200);

    console.log('[PlayerContext] Intervalo de actualización de tiempo establecido');
  };

  // Agregar un efecto dedicado para verificar la duración periódicamente
  useEffect(() => {
    // Si no hay reproducción en curso, no necesitamos verificar
    if (!isPlaying || !currentTrack || !youtubePlayerRef.current) {
          return;
    }

    console.log('[PlayerContext] Configurando verificación periódica de duración');

    // Función para intentar actualizar la duración
    const updateDuration = () => {
      try {
        if (youtubePlayerRef.current && typeof youtubePlayerRef.current.getDuration === 'function') {
          const newDuration = youtubePlayerRef.current.getDuration();

          // Verificar si tenemos una duración válida
          if (newDuration && newDuration > 0) {
            // Si la duración actual es diferente y válida, actualizarla
            if (duration !== newDuration) {
              console.log(`[PlayerContext] Actualizando duración: ${newDuration}s (anterior: ${duration}s)`);
            setDuration(newDuration);
              return true;
            }
            return true; // Ya tenemos una duración correcta
          }
      }
    } catch (error) {
        console.error('[PlayerContext] Error al obtener duración en verificación periódica:', error);
      }
      return false;
    };

    // Verificar inmediatamente
    const durationValid = updateDuration();

    // Si la duración no es válida, configurar un intervalo para verificar periódicamente
    if (!durationValid) {
      const durationCheckInterval = setInterval(() => {
        if (updateDuration() || !isPlaying) {
          clearInterval(durationCheckInterval);
        }
      }, 1000); // Verificar cada segundo

      return () => {
        clearInterval(durationCheckInterval);
      };
    }
  }, [isPlaying, currentTrack, duration]);

  // Limpiar intervalo de tiempo cuando cambia el estado de reproducción
  useEffect(() => {
    // Si la reproducción se detiene, limpiar el intervalo
    if (!isPlaying && timeUpdateIntervalRef.current) {
      console.log('[PlayerContext] Limpiando intervalo de actualización de tiempo al pausar');
      clearInterval(timeUpdateIntervalRef.current);
      timeUpdateIntervalRef.current = null;
    }

    // Limpiar intervalo al desmontar
    return () => {
      if (timeUpdateIntervalRef.current) {
        console.log('[PlayerContext] Limpiando intervalo de actualización de tiempo al desmontar');
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
    };
  }, [isPlaying]);

  // Cargar la API de YouTube
  useEffect(() => {
    // Variable para controlar si el componente está montado
    let isMounted = true;

    const initYouTubeAPI = () => {
      if (!window.YT) {
        console.log('[PlayerContext] Cargando YouTube iframe API...');

        // Verificar si el script ya está en el DOM para evitar duplicados
        if (document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
          console.log('[PlayerContext] Script de YouTube ya está en el DOM, esperando a que se cargue...');

          // Si el script ya está en el DOM pero window.YT no está definido,
          // configuramos el callback onYouTubeIframeAPIReady
          window.onYouTubeIframeAPIReady = () => {
            console.log('[PlayerContext] YouTube iframe API cargada correctamente (callback ejecutado)');
            if (isMounted) {
              setIsYoutubeReady(true);

              // Crear el reproductor inmediatamente después de que la API esté lista
              setTimeout(() => {
                createYouTubePlayer();
              }, 500);
            }
          };

          return;
        }

        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.id = 'youtube-iframe-api-script';

        // Crear una promesa para esperar a que la API esté lista
          window.onYouTubeIframeAPIReady = () => {
          console.log('[PlayerContext] YouTube iframe API cargada correctamente (script nuevo)');
            if (isMounted) {
            setIsYoutubeReady(true);

            // Crear el reproductor inmediatamente después de que la API esté lista
            setTimeout(() => {
              createYouTubePlayer();
            }, 500);
          }
        };

        // Insertar el script en el DOM
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      } else {
        console.log('[PlayerContext] YouTube iframe API ya cargada');
        setIsYoutubeReady(true);

        // Si la API ya está cargada, crear el reproductor directamente
        setTimeout(() => {
          createYouTubePlayer();
        }, 500);
      }
    };

    // Inicializar la API de YouTube
    initYouTubeAPI();

    // Limpiar cuando el componente se desmonte
    return () => {
      isMounted = false;

      // Limpiar el callback global para evitar fugas de memoria
      window.onYouTubeIframeAPIReady = null;
    };
  }, []);

  // Crear y configurar el reproductor una vez que la API está lista
  useEffect(() => {
    // Si la API no está lista, no hacemos nada
    if (!isYoutubeReady) {
      console.log('[PlayerContext] Esperando a que YouTube iframe API esté lista...');
        return;
      }

    console.log('[PlayerContext] Estado de window.YT:', window.YT ? 'disponible' : 'no disponible');
    console.log('[PlayerContext] Estado de window.YT.Player:', window.YT?.Player ? 'disponible' : 'no disponible');

    // Si no está disponible YT.Player, esperar
    if (!window.YT || !window.YT.Player) {
      console.log('[PlayerContext] YT.Player no disponible todavía, esperando...');

      // Esperar con un intervalo a que YT.Player esté disponible
      const checkInterval = setInterval(() => {
        console.log('[PlayerContext] Verificando disponibilidad de YT.Player...');
        console.log('[PlayerContext] Estado actual de window.YT:', window.YT ? 'disponible' : 'no disponible');
        console.log('[PlayerContext] Estado actual de window.YT.Player:', window.YT?.Player ? 'disponible' : 'no disponible');

        if (window.YT && window.YT.Player) {
          clearInterval(checkInterval);
          console.log('[PlayerContext] YT.Player ahora disponible, creando reproductor...');
          createYouTubePlayer();
        }
      }, 100);

      return () => {
        clearInterval(checkInterval);
      };
    } else {
      console.log('[PlayerContext] YT.Player disponible inmediatamente, creando reproductor...');
      createYouTubePlayer();
    }
  }, [isYoutubeReady]);

  // Función para crear el reproductor de YouTube
  const createYouTubePlayer = () => {
    console.log('[PlayerContext] Creando contenedor para el reproductor de YouTube...');

    // Verificar que YT.Player esté disponible
    if (!window.YT || !window.YT.Player) {
      console.error('[PlayerContext] Error: YT.Player no está disponible');
      return;
    }

    // Si ya hay un reproductor y parece estar funcionando, no recrearlo
      if (youtubePlayerRef.current) {
        try {
        // Verificar si el reproductor existente está activo con una llamada a getDuration
        youtubePlayerRef.current.getDuration();
        console.log('[PlayerContext] Reproductor existente parece funcional, manteniéndolo');
        return;
      } catch (error) {
        console.log('[PlayerContext] Reproductor existente no funcional, recreando...');
        try {
            youtubePlayerRef.current.destroy();
        } catch (destroyError) {
          console.error('[PlayerContext] Error al destruir reproductor:', destroyError);
        }
        youtubePlayerRef.current = null;
      }
    }

    // Verificar si ya existe el contenedor
    let playerContainer = document.getElementById('youtube-player-container');
    if (playerContainer) {
      // Limpiar el contenedor en lugar de eliminarlo completamente
      playerContainer.innerHTML = '';
      console.log('[PlayerContext] Contenedor existente limpiado');
    } else {
      // Crear nuevo contenedor si no existe
    playerContainer = document.createElement('div');
    playerContainer.id = 'youtube-player-container';

    // Ubicarlo en una posición que no interfiera con la interfaz
    playerContainer.style.position = 'fixed';
    playerContainer.style.bottom = '-1px';
    playerContainer.style.right = '0';
      playerContainer.style.width = '320px';  // Hacerlo más grande para depuración
      playerContainer.style.height = '180px'; // Hacerlo más grande para depuración
      playerContainer.style.opacity = '0';  // Hacerlo ligeramente visible
    playerContainer.style.pointerEvents = 'none';
    playerContainer.style.zIndex = '1000';

      document.body.appendChild(playerContainer);
      console.log('[PlayerContext] Nuevo contenedor creado');
    }

    // Crear el elemento para el iframe con ID específico
      const playerElement = document.createElement('div');
      playerElement.id = 'youtube-player';
    playerElement.style.width = '100%';
    playerElement.style.height = '100%';

    // Agregar el elemento al contenedor
    playerContainer.appendChild(playerElement);

    console.log('[PlayerContext] Contenedor preparado, inicializando Player API...');
    console.log('[PlayerContext] Elemento del player:', document.getElementById('youtube-player'));

    try {
      // Definir handlers para los eventos del reproductor
      const onPlayerReady = (event: any) => {
        console.log('[PlayerContext] Reproductor de YouTube listo y disponible');
        console.log('[PlayerContext] Objeto event en onPlayerReady:', event ? 'disponible' : 'no disponible');
        console.log('[PlayerContext] Objeto event.target en onPlayerReady:', event?.target ? 'disponible' : 'no disponible');

        // Verificar que el objeto event.target tenga los métodos necesarios
        if (event && event.target) {
          console.log('[PlayerContext] Métodos disponibles en event.target:');
          console.log('  - getCurrentTime:', typeof event.target.getCurrentTime === 'function' ? 'disponible' : 'no disponible');
          console.log('  - getDuration:', typeof event.target.getDuration === 'function' ? 'disponible' : 'no disponible');
          console.log('  - loadVideoById:', typeof event.target.loadVideoById === 'function' ? 'disponible' : 'no disponible');
          console.log('  - pauseVideo:', typeof event.target.pauseVideo === 'function' ? 'disponible' : 'no disponible');
          console.log('  - playVideo:', typeof event.target.playVideo === 'function' ? 'disponible' : 'no disponible');
          console.log('  - setVolume:', typeof event.target.setVolume === 'function' ? 'disponible' : 'no disponible');

          // Guardar referencia al reproductor
          youtubePlayerRef.current = event.target;
          setYoutubePlayer(event.target);

          // Configurar volumen inicial
          try {
            event.target.setVolume(volumeState * 100);
          } catch (error) {
            console.error('[PlayerContext] Error al establecer volumen inicial:', error);
          }

          // Si hay una canción actual, cargarla
          if (currentTrack && currentTrack.youtubeId) {
            console.log('[PlayerContext] Cargando canción actual en onPlayerReady:', currentTrack.title);
            try {
              event.target.loadVideoById({
                videoId: currentTrack.youtubeId,
                startSeconds: 0,
                suggestedQuality: 'default'
              });

              // Intentar reproducir inmediatamente
              if (isPlaying) {
        setTimeout(() => {
                try {
                    event.target.playVideo();
                  } catch (playError) {
                    console.error('[PlayerContext] Error al iniciar reproducción:', playError);
                  }
                }, 100);
              } else {
                event.target.pauseVideo();
              }

              // Verificar duración después de cargar
              setTimeout(() => {
                try {
                  if (typeof event.target.getDuration === 'function') {
                    const videoDuration = event.target.getDuration();
                    console.log('[PlayerContext] Duración obtenida después de 1s:', videoDuration);
                    if (videoDuration && videoDuration > 0) {
                      setDuration(videoDuration);
                    }
                  }
                } catch (e) {
                  console.error('[PlayerContext] Error al obtener duración después de espera:', e);
                }
              }, 1000);
    } catch (error) {
              console.error('[PlayerContext] Error al cargar video en onPlayerReady:', error);
            }
          }
        }
      };

      const onPlayerStateChange = (event: any) => {
        try {
          console.log('[PlayerContext] Evento de cambio de estado del reproductor:', event?.data);

          if (!event || !event.target) {
            console.error('[PlayerContext] Evento recibido sin target en onPlayerStateChange');
            return;
          }

          // Constantes para estados del reproductor de YouTube
          const YT_PLAYER_STATE = {
            UNSTARTED: -1,  // El video no ha iniciado reproducción
            ENDED: 0,       // El video ha terminado
            PLAYING: 1,     // El video está reproduciéndose
            PAUSED: 2,      // El video está pausado
            BUFFERING: 3,   // El video está cargando
            CUED: 5         // El video está en cola
          };

          // Obtener tiempo y duración actuales, independientemente del estado
          try {
            // Actualizar tiempo actual
            if (typeof event.target.getCurrentTime === 'function') {
              const currentSeconds = event.target.getCurrentTime();
              setCurrentTime(currentSeconds);
            }

            // Actualizar duración si aún no está establecida
            if (duration <= 0 && typeof event.target.getDuration === 'function') {
              const videoDuration = event.target.getDuration();
              if (videoDuration && videoDuration > 0) {
                console.log('[PlayerContext] Duración detectada en cambio de estado:', videoDuration);
                setDuration(videoDuration);
              }
            }
          } catch (timeError) {
            console.error('[PlayerContext] Error al actualizar tiempo en evento:', timeError);
          }

          // Actualizar isPlaying basado en el estado
          if (event.data === YT_PLAYER_STATE.PLAYING) {
            if (!isPlaying) {
              console.log('[PlayerContext] Cambiando estado a reproduciendo');
              setIsPlaying(true);
              isPlayingRef.current = true;
            }

            // Si tenemos un TimeUpdate en proceso, limpiarlo y crear uno nuevo
            startTimeUpdates();

            // Limpiar cualquier temporizador pendiente de reproducción automática
            if (nextTrackTimeoutRef.current) {
              console.log('[PlayerContext] Limpiando temporizador de siguiente canción porque el video comenzó a reproducirse');
              clearTimeout(nextTrackTimeoutRef.current);
              nextTrackTimeoutRef.current = null;
            }
          } else if (event.data === YT_PLAYER_STATE.PAUSED) {
            if (isPlaying) {
              console.log('[PlayerContext] Cambiando estado a pausado');
              setIsPlaying(false);
              isPlayingRef.current = false;
            }
          } else if (event.data === YT_PLAYER_STATE.ENDED) {
            console.log('[PlayerContext] Video terminado, verificando modo de repetición');

            if (isRepeatEnabled) {
              console.log('[PlayerContext] Modo repetición activado, reiniciando canción actual');
              // Reiniciar la misma canción cuando está activado el modo de repetición
              try {
                // Primero pausa para asegurar que no hay conflictos
                setIsPlaying(false);

                // Luego retrocede al inicio de la canción
                event.target.seekTo(0, true);

                // Pequeño retraso para asegurar que el estado se restablezca correctamente
                setTimeout(() => {
                  // Reproducir el video y actualizar el estado
                  event.target.playVideo();
                  setIsPlaying(true);
                  setCurrentTime(0);
                }, 50);

                return; // Importante: evitar ejecutar nextTrack
              } catch (error) {
                console.error('[PlayerContext] Error al reiniciar canción en modo repetición:', error);
                // Si hay un error, intenta continuar con la siguiente canción
              }
            }

            console.log('[PlayerContext] Reproduciendo siguiente canción');

            // Cambiar estado a pausado
            if (isPlaying) {
              setIsPlaying(false);
              isPlayingRef.current = false;
            }

            // Limpiar actualizaciones de tiempo
            if (timeUpdateIntervalRef.current) {
              clearInterval(timeUpdateIntervalRef.current);
              timeUpdateIntervalRef.current = null;
            }

            // Ejecutar nextTrack directamente
                nextTrack();
          } else if (event.data === YT_PLAYER_STATE.BUFFERING) {
            console.log('[PlayerContext] Video en buffer...');
          } else if (event.data === YT_PLAYER_STATE.UNSTARTED || event.data === YT_PLAYER_STATE.CUED) {
            // Estos estados son normales al inicio, no requieren acción especial
            console.log(`[PlayerContext] Video en estado preparativo: ${event.data === YT_PLAYER_STATE.UNSTARTED ? 'UNSTARTED' : 'CUED'}`);
          } else if (event.data === -1) {
            // El valor -1 también puede indicar un error en algunos casos
            console.warn('[PlayerContext] Video en estado -1 (posible error)');
          } else {
            // Estado no reconocido o error
            console.warn(`[PlayerContext] Estado no reconocido del reproductor: ${event.data}`);
          }
        } catch (error) {
          console.error('[PlayerContext] Error en onPlayerStateChange:', error);
        }
      };

      const onPlayerError = (event: any) => {
        console.error('[PlayerContext] Error del reproductor:', event.data);
        console.log('[PlayerContext] Código de error:', event.data);

        // Códigos de error comunes:
        const errorCodes: Record<number, string> = {
          2: 'Parámetro inválido',
          5: 'Error de HTML5',
          100: 'Video no encontrado',
          101: 'Video no permite ser embebido (propietario)',
          150: 'Video no permite ser embebido (propietario)'
        };

        console.log(`[PlayerContext] Descripción del error: ${errorCodes[event.data] || 'Error desconocido'}`);

        // Códigos: 2=parámetro inválido, 5=HTML5 error, 100=video no encontrado, 101/150=video no embedable
        if (event.data === 150 || event.data === 101 || event.data === 100) {
          console.log('[PlayerContext] Intentando reproducir siguiente canción debido a error');

          // Utilizar el mismo mecanismo de protección que en ENDED
          if (!nextTrackTimeoutRef.current) {
            nextTrackTimeoutRef.current = setTimeout(() => {
              console.log('[PlayerContext] Ejecutando nextTrack después del error', event.data);
              nextTrack();
              nextTrackTimeoutRef.current = null;
            }, 800);
          } else {
            console.log('[PlayerContext] nextTrack ya programado después de error, evitando llamada duplicada');
          }
        }
      };

      // Crear el reproductor con enfoque en asegurar que se crea correctamente
      console.log('[PlayerContext] Creando instancia del reproductor...');
      try {
        // Verificar que YT.Player esté realmente disponible
        if (!window.YT || !window.YT.Player) {
          console.error('[PlayerContext] YT.Player no está disponible. window.YT:', window.YT);
        return;
      }

        // Verificar si el contenedor existe
        const playerContainer = document.getElementById('youtube-player-container');
        if (!playerContainer) {
          console.error('[PlayerContext] Error: No se encontró el contenedor #youtube-player-container');
          return;
        }

        const playerElement = document.getElementById('youtube-player');
        if (!playerElement) {
          console.error('[PlayerContext] Error: No se encontró el elemento #youtube-player');
        return;
      }

        // Usar un enfoque más directo para crear el player
      const playerOptions = {
          height: '100%',
          width: '100%',
          videoId: '', // No cargar video de prueba
      playerVars: {
          autoplay: 0,
            controls: 0, // Ocultar controles
            disablekb: 1, // Deshabilitar controles de teclado
        enablejsapi: 1,
        fs: 0,
        modestbranding: 1,
          rel: 0,
            iv_load_policy: 3,
            origin: window.location.origin
      },
      events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
            onError: onPlayerError
          }
        };

        console.log('[PlayerContext] Creando instancia de YT.Player con opciones:', JSON.stringify(playerOptions));

        // Crear el player
        const player = new window.YT.Player('youtube-player', playerOptions);

        // Guardar una referencia al player para verificación
        window._debugYTPlayer = player;

        console.log('[PlayerContext] Player creado:', player ? 'exitoso' : 'fallido');

        // Verificar que el player se creó correctamente después de un tiempo
              setTimeout(() => {
          const iframe = document.querySelector('#youtube-player-container iframe');
          console.log('[PlayerContext] Verificación de iframe creado:', iframe ? 'disponible' : 'no disponible');

          console.log('[PlayerContext] Estado de youtubePlayerRef.current:', youtubePlayerRef.current ? 'disponible' : 'no disponible');

          if (!youtubePlayerRef.current) {
            console.log('[PlayerContext] El player no se inicializó correctamente. Intentando reconectar...');

            // Si el iframe existe pero no tenemos referencia al player, intentar reconectar
            if (iframe) {
              console.log('[PlayerContext] Iframe encontrado, intentando reconectar con él');
              // Intentar de nuevo estableciendo manualmente el player
              try {
                // @ts-ignore
                youtubePlayerRef.current = player || iframe;
                setYoutubePlayer(player || iframe);
                console.log('[PlayerContext] Reconexión manual realizada');

                // Verificar si el player tiene los métodos esperados
                if (youtubePlayerRef.current) {
                  console.log('  - getCurrentTime:', typeof youtubePlayerRef.current.getCurrentTime === 'function' ? 'disponible' : 'no disponible');
                  console.log('  - getDuration:', typeof youtubePlayerRef.current.getDuration === 'function' ? 'disponible' : 'no disponible');
                  console.log('  - playVideo:', typeof youtubePlayerRef.current.playVideo === 'function' ? 'disponible' : 'no disponible');
                }
              } catch (reconnectError) {
                console.error('[PlayerContext] Error al reconectar con el iframe:', reconnectError);
                  }
                } else {
              console.log('[PlayerContext] No se encontró iframe para reconectar');
            }
          }
        }, 3000);

    } catch (error) {
        console.error('[PlayerContext] Error al crear el reproductor de YouTube:', error);
          }
        } catch (error) {
      console.error('[PlayerContext] Error al configurar el reproductor de YouTube:', error);
    }
  };

  // Cargar letras cuando cambia la canción actual
  useEffect(() => {
    if (!currentTrack) return;

    const loadLyrics = async () => {
      setLyrics(prev => ({ ...prev, isLoading: true }));

      const result = await getLyrics(currentTrack);

      if (result.syncedLyrics) {
        const parsedLyrics = parseSyncedLyrics(result.syncedLyrics);
        setLyrics({
          plain: result.plainLyrics,
          synced: parsedLyrics,
          isLoading: false
        });

      } else if (result.plainLyrics) {
        setLyrics({
          plain: result.plainLyrics,
          synced: [],
          isLoading: false
        });

          } else {
        setLyrics({
          plain: null,
          synced: [],
          isLoading: false
        });

      }
    };

    loadLyrics();
  }, [currentTrack]);

  // Función para cargar letras
  const loadLyrics = async (track: Track): Promise<void> => {
    if (!track || !track.title || !track.artist) {
      console.log('[PlayerContext] Datos insuficientes para cargar letras');
      setLyrics({
        plain: null,
        synced: [],
        isLoading: false
      });
        return;
      }

    console.log(`[PlayerContext] Buscando letras para: ${track.title} - ${track.artist}`);
    setLyrics(prev => ({ ...prev, isLoading: true }));

    try {
      // Obtener letras
      const result = await getLyrics(track);

      if (result.syncedLyrics) {
        // Si hay letras sincronizadas, parsearlas
        const parsedLyrics = parseSyncedLyrics(result.syncedLyrics);
        setLyrics({
          plain: result.plainLyrics,
          synced: parsedLyrics,
          isLoading: false
        });
        console.log('[PlayerContext] Letras sincronizadas cargadas correctamente');
      } else if (result.plainLyrics) {
        // Si solo hay letras planas
        setLyrics({
          plain: result.plainLyrics,
          synced: [],
          isLoading: false
        });
        console.log('[PlayerContext] Letras planas cargadas correctamente');
      } else {
        // Si no hay letras
        setLyrics({
          plain: null,
          synced: [],
          isLoading: false
        });
        console.log('[PlayerContext] No se encontraron letras');
      }
    } catch (error) {
      console.error('[PlayerContext] Error al cargar letras:', error);
      // No mostrar un error al usuario por falta de letras
      // simplemente establecer letras como no disponibles
      setLyrics({
        plain: null,
        synced: [],
        isLoading: false
      });

      // No propagar el error más allá ya que las letras son una característica adicional
      // y no queremos que interrumpa la reproducción principal
    }
  };

  // Función para convertir un objeto de track de Spotify a nuestro formato Track
  const convertSpotifyTrackToTrack = (spotifyTrack: any): Track => {
    try {
      // Extraer la URL del álbum si existe
      let albumCoverUrl = '/placeholder-album.jpg';
      if (spotifyTrack.album && spotifyTrack.album.images && spotifyTrack.album.images.length > 0) {
        albumCoverUrl = spotifyTrack.album.images[0].url;
      }

      // Validar la URL de la imagen
      albumCoverUrl = getValidImageUrl(albumCoverUrl);

    return {
      id: spotifyTrack.id,
      title: spotifyTrack.name,
        artist: spotifyTrack.artists.map((artist: any) => artist.name).join(', '),
        duration: spotifyTrack.duration_ms / 1000, // Convertir de ms a segundos
        album: spotifyTrack.album?.name || 'Desconocido',
        cover: albumCoverUrl,
        albumCover: albumCoverUrl,
        source: 'spotify',
        youtubeId: undefined // Cambiado de null a undefined
      };
    } catch (error) {
      console.error('Error al convertir track de Spotify:', error);
      return {
        id: `error_${Date.now()}`,
        title: spotifyTrack?.name || 'Canción desconocida',
        artist: spotifyTrack?.artists ? spotifyTrack.artists.map((artist: any) => artist.name).join(', ') : 'Artista desconocido',
        duration: spotifyTrack?.duration_ms ? spotifyTrack.duration_ms / 1000 : 0,
        album: spotifyTrack?.album?.name || 'Desconocido',
        cover: PLACEHOLDER_ALBUM,
        albumCover: PLACEHOLDER_ALBUM,
        source: 'spotify',
        youtubeId: undefined // Cambiado de null a undefined
      };
    }
  };

  // Mejorar la función playTrack para manejar mejor los errores y siempre generar listas de reproducción
  const playTrack = async (track: Track): Promise<boolean> => {
    console.log('[PlayerContext] Iniciando reproducción de:', track.title, 'por', track.artist);

    try {
      if (!track) {
        console.error('[PlayerContext] Error: Intentando reproducir una pista nula');
        return false;
      }

      // Asegurarse de que track.id existe
      if (!track.id && track.youtubeId) {
        console.log('[PlayerContext] Usando youtubeId como id principal:', track.youtubeId);
        track = {
          ...track,
          id: track.youtubeId
        };
      }

      // Actualizar estado
      setCurrentTrack(track);
      setIsLoading(true);

      // Verificar si la pista ya está en la playlist
      const trackInPlaylist = playlist.some(t =>
        t.id === track.id || (t.youtubeId && t.youtubeId === track.youtubeId)
      );

      // Si no está en la playlist, añadirla como única pista
      if (!trackInPlaylist) {
        console.log('[PlayerContext] Pista no encontrada en playlist, creando nueva playlist');
        setPlaylist([track]);
        setCurrentIndex(0);
        // --- LLAMADA A createAutoPlaylist ---
        // Llamar a createAutoPlaylist DESPUÉS de establecer la pista inicial
        // y SOLO si es una pista nueva (no parte de la playlist existente)
        console.log('[PlayerContext] Disparando createAutoPlaylist para pista nueva:', track.title);
        // Usar un pequeño timeout para asegurar que el estado inicial se procese
        setTimeout(() => {
          createAutoPlaylist(track).catch(error => {
             console.error('[PlayerContext] Error al generar auto-playlist desde playTrack:', error);
             // Opcionalmente, mostrar un error al usuario si falla la generación
             // setError('No se pudieron generar recomendaciones automáticas.');
          });
        }, 100); // Un pequeño retraso puede ayudar
        // --- FIN LLAMADA ---
      } else {
        // Establecer el índice actual si la pista ya está en la lista
        const currentTrackIndex = playlist.findIndex(t =>
          t.id === track.id || (t.youtubeId && t.youtubeId === track.youtubeId)
        );
        if (currentTrackIndex !== -1) {
          setCurrentIndex(currentTrackIndex);
        }
      }

      // Cargar letras si es posible
      setLyrics({
        plain: null,
        synced: [],
        isLoading: true
      });

      // Intentar cargar letras asíncronamente
      getLyrics(track)
      .then((lyricsResult) => {
        if (lyricsResult.syncedLyrics || lyricsResult.plainLyrics) {
          console.log('[PlayerContext] Letras cargadas para:', track.title);

          // Analizar letras sincronizadas si están disponibles
          let syncedLines: LyricLine[] = [];
          if (lyricsResult.syncedLyrics) {
            syncedLines = parseSyncedLyrics(lyricsResult.syncedLyrics);
            console.log('[PlayerContext] Procesadas letras sincronizadas:', syncedLines.length, 'líneas');
          }

          setLyrics({
            plain: lyricsResult.plainLyrics,
            synced: syncedLines,
            isLoading: false
          });
        } else {
          console.log('[PlayerContext] No se encontraron letras para:', track.title);
          setLyrics({
            plain: null,
            synced: [],
            isLoading: false
          });
        }
      })
      .catch((error) => {
        console.error('[PlayerContext] Error al cargar letras:', error);
        setLyrics({
          plain: null,
          synced: [],
          isLoading: false
        });
      });

      // Verificar si el reproductor de YouTube está disponible
      const maxRetries = 3;
      let attempts = 0;

      while (attempts < maxRetries) {
        attempts++;

        if (youtubePlayerRef.current) {
          console.log(`[PlayerContext] Intento ${attempts}: Reproductor disponible, cargando video...`);

          // Intentar cargar el video con el ID de YouTube
          if (!track.youtubeId) {
            console.error('[PlayerContext] No se encontró ID de YouTube para la pista');
            setError('No se encontró ID de YouTube para esta canción');
            setIsLoading(false);
            return false;
          }

          await loadVideo(youtubePlayerRef.current, track.youtubeId);

          // Activar la reproducción
          setIsPlaying(true);
          isPlayingRef.current = true;

          // Iniciar actualizaciones de tiempo
          startTimeUpdates();

          console.log('[PlayerContext] Reproducción iniciada correctamente');
          return true;
        }

        console.log(`[PlayerContext] Intento ${attempts}: Player no disponible, iniciando...`);

        // Crear el reproductor si no existe
        createYouTubePlayer();

        // Esperar un momento antes de reintentar
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Si llegamos aquí, no se pudo inicializar el reproductor
      console.error('[PlayerContext] No se pudo inicializar el reproductor');
      return false;

    } catch (error) {
      console.error('[PlayerContext] Error al reproducir track:', error);
      setError(`Error al reproducir: ${error instanceof Error ? error.message : String(error)}`);
      setIsLoading(false);
      return false;
    }
  };

  // Reproducir una pista con el reproductor actual (si ya tiene YouTube ID)
  const playTrackWithPlayer = async (track: Track): Promise<boolean> => {
    console.log('[PlayerContext-DEBUG] ===== INICIO reproducción track =====');
      console.log(`[PlayerContext-DEBUG] Título: "${track.title}" | Artista: "${track.artist}"`);
    console.log(`[PlayerContext-DEBUG] ID: ${track.id}`);
    console.log(`[PlayerContext-DEBUG] youtubeId: ${track.youtubeId}`);
    console.log(`[PlayerContext-DEBUG] Cover inicial: ${track.cover}`);
      console.log(`[PlayerContext-DEBUG] Thumbnail: ${track.thumbnail || 'no disponible'}`);
    console.log('[PlayerContext-DEBUG] =====================================');

    // Si no tiene ID de YouTube, no se puede reproducir con el reproductor
    if (!track.youtubeId) {
      console.error('[PlayerContext] No se puede reproducir, no hay ID de YouTube');
      setError('No se puede reproducir este tema (falta ID de YouTube)');
      return false;
    }

    // Sincronizar el thumbnail y el cover para mantener consistencia
    if (!track.thumbnail && track.youtubeId) {
      console.log('[PlayerContext-DEBUG] Sincronizando thumbnail con cover:', track.cover);
      track.thumbnail = `https://i.ytimg.com/vi/${track.youtubeId}/hqdefault.jpg`;
    }

    // Validar y procesar la URL de la portada
    let coverUrl = track.cover;
    if (!coverUrl) {
      if (track.thumbnail) {
        coverUrl = track.thumbnail;
      } else if (track.youtubeId) {
        coverUrl = `https://i.ytimg.com/vi/${track.youtubeId}/hqdefault.jpg`;
      }
      track.cover = coverUrl; // Actualizar la URL en el objeto track
    }
    console.log('[PlayerContext-DEBUG] Cover después de procesar:', track.cover);

    try {
      // Establecer la canción actual en el contexto
      setCurrentTrack(track);

      // --- NUEVO: Verificar si es pista nueva y llamar a createAutoPlaylist ---
      const trackInPlaylist = playlist.some(t =>
        t.id === track.id || (t.youtubeId && t.youtubeId === track.youtubeId)
      );

      if (!trackInPlaylist) {
        console.log('[PlayerContext] Pista (con YT ID) no en playlist, estableciendo y disparando auto-playlist.');
        // Establecer la playlist con solo esta canción temporalmente
        setPlaylist([track]);
        setCurrentIndex(0);
        // Disparar createAutoPlaylist
        setTimeout(() => {
          createAutoPlaylist(track).catch(error => {
            console.error('[PlayerContext] Error al generar auto-playlist desde playTrackWithPlayer:', error);
          });
        }, 100);
      } else {
         // Si ya está en la playlist, solo actualiza el índice
         const currentTrackIndex = playlist.findIndex(t =>
            t.id === track.id || (t.youtubeId && t.youtubeId === track.youtubeId)
         );
         if (currentTrackIndex !== -1 && currentTrackIndex !== currentIndex) {
             console.log('[PlayerContext] Pista (con YT ID) encontrada en playlist, actualizando índice a:', currentTrackIndex);
             setCurrentIndex(currentTrackIndex);
         }
      }
      // --- FIN NUEVO ---

      // Intentar cargar las letras en paralelo
      loadLyrics(track).catch(error => {
        console.error('[PlayerContext] Error al cargar letras:', error);
      });

      // Verificar si el reproductor de YouTube está disponible
      const maxRetries = 3;
      let attempts = 0;

      while (attempts < maxRetries) {
        attempts++;

        if (youtubePlayerRef.current) {
          console.log(`[PlayerContext] Intento ${attempts}: Reproductor disponible, cargando video...`);

          // Intentar cargar el video con el ID de YouTube
          if (!track.youtubeId) {
            console.error('[PlayerContext] No se encontró ID de YouTube para la pista');
            setError('No se encontró ID de YouTube para esta canción');
            setIsLoading(false);
            return false;
          }

          await loadVideo(youtubePlayerRef.current, track.youtubeId);

          // Activar la reproducción
          setIsPlaying(true);
          isPlayingRef.current = true;

          // Iniciar actualizaciones de tiempo
          startTimeUpdates();

          console.log('[PlayerContext] Reproducción iniciada correctamente');
          return true;
        }

        console.log(`[PlayerContext] Intento ${attempts}: Player no disponible, iniciando...`);

        // Crear el reproductor si no existe
        createYouTubePlayer();

        // Esperar un momento antes de reintentar
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Si llegamos aquí, no se pudo inicializar el reproductor
          console.error('[PlayerContext] No se pudo inicializar el reproductor');
      console.error('[PlayerContext] Estado de window.YT:', window.YT ? 'disponible' : 'no disponible');

      if (window.YT) {
        console.error('[PlayerContext] Estado de window.YT.Player:', typeof window.YT.Player === 'function' ? 'disponible' : 'no disponible');
      }

      const playerElement = document.getElementById('youtube-player');
      console.error('[PlayerContext] Elemento #youtube-player existe:', playerElement ? 'sí' : 'no');

      // Intentar como último recurso reproducir el video directamente
      console.log('[PlayerContext] Intentando cargar video con ID:', track.youtubeId);

      // Crear un nuevo elemento iframe manualmente como último recurso
      const container = document.getElementById('youtube-player-container');
      if (container) {
        container.innerHTML = `
          <iframe
            id="direct-youtube-iframe"
            width="100%"
            height="100%"
            src="https://www.youtube.com/embed/${track.youtubeId}?autoplay=1&enablejsapi=1"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
          ></iframe>
        `;

        // Considerar como reproducido aunque no tengamos control completo
        setIsPlaying(true);
        isPlayingRef.current = true;
        startTimeUpdates();

        return true;
        }

      return false;
      } catch (error) {
      console.error('[PlayerContext] Error al reproducir track:', error);
      setError(`Error al reproducir: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  };

  // Reproducir una playlist
  const playPlaylist = async (tracks: Track[], startIndex: number = 0) => {
    if (tracks.length === 0) return;

    // Actualizar playlist
    setPlaylist(tracks);
    setCurrentIndex(startIndex);

    // Reproducir la primera canción
    const track = tracks[startIndex];
    await playTrack(track);
  };

  // Alternar reproducción/pausa
  const togglePlay = () => {
    console.log('[PlayerContext] Alternando reproducción, estado actual:', isPlaying ? 'reproduciendo' : 'pausado');
    console.log('[PlayerContext] Estado actual de isPlayingRef:', isPlayingRef.current ? 'reproduciendo' : 'pausado');
    console.log('[PlayerContext] Reproductor disponible:', youtubePlayerRef.current ? 'sí' : 'no');

    // Verificar si el reproductor está disponible
    if (!youtubePlayerRef.current) {
      console.error('[PlayerContext] El reproductor de YouTube no está disponible para alternar reproducción');

      // Si estamos intentando reproducir y tenemos una pista, intentar reinicializar el reproductor
      if (!isPlayingRef.current && currentTrack) {
        console.log('[PlayerContext] Intentando reinicializar el reproductor y reproducir la pista:', currentTrack.title);

        // Crear un temporizador para comprobar si el reproductor se ha inicializado y reproducir
      setTimeout(() => {
          if (youtubePlayerRef.current) {
            if (typeof youtubePlayerRef.current.playVideo === 'function') {
              console.log('[PlayerContext] Reproductor disponible después del retardo, reproduciendo...');
              youtubePlayerRef.current.playVideo();
              setIsPlaying(true);
              isPlayingRef.current = true;

              // También iniciar las actualizaciones de tiempo
              startTimeUpdates();
            } else {
              console.error('[PlayerContext] playVideo no es una función');
            }
          } else {
            console.error('[PlayerContext] El reproductor sigue sin estar disponible después del retardo');

            // Intentar reinicializar el reproductor desde cero
            console.log('[PlayerContext] Intentando reinicializar el reproductor de YouTube');
            createYouTubePlayer();
          }
        }, 1000);
      }

      return;
          }

          try {
      // Verificar que los métodos necesarios existen
      if (isPlayingRef.current) {
        if (typeof youtubePlayerRef.current.pauseVideo === 'function') {
          console.log('[PlayerContext] Pausando video');
          youtubePlayerRef.current.pauseVideo();
          setIsPlaying(false);
          isPlayingRef.current = false;
        } else {
          console.error('[PlayerContext] El método pauseVideo no está disponible');
        }
      } else {
        if (typeof youtubePlayerRef.current.playVideo === 'function') {
          console.log('[PlayerContext] Reproduciendo video');
          youtubePlayerRef.current.playVideo();
          setIsPlaying(true);
          isPlayingRef.current = true;

          // Asegurarse que las actualizaciones de tiempo estén funcionando
          startTimeUpdates();
        } else {
          console.error('[PlayerContext] El método playVideo no está disponible');
        }
      }
    } catch (error) {
      console.error('[PlayerContext] Error al alternar reproducción:', error);
    }
  };

  // Modificar la implementación del control de tiempo entre llamadas
  // Evitar llamadas múltiples rápidas con una referencia mejor
  const nextTrackTimeRef = useRef<number>(0);

  // Simplificar nextTrack
  const nextTrack = async () => {
    console.log('[PlayerContext] Ejecutando nextTrack');

    // Evitar llamadas múltiples rápidas
    const now = Date.now();
    const timeSinceLastCall = now - nextTrackTimeRef.current;

    if (timeSinceLastCall < 800) {
      console.log(`[PlayerContext] Ignorando llamada duplicada a nextTrack (${timeSinceLastCall}ms)`);
      return;
    }

    // Actualizar tiempo de última llamada
    nextTrackTimeRef.current = now;

    try {
      // Limpiar temporizador por seguridad
      if (nextTrackTimeoutRef.current) {
        clearTimeout(nextTrackTimeoutRef.current);
        nextTrackTimeoutRef.current = null;
      }

      if (!playlist || playlist.length === 0 || !currentTrack) {
        console.warn('[RASTREO-PLAYLIST] No hay playlist o canción actual para avanzar');
        setError('No hay más canciones en cola. Genera una lista automática.');
        return;
      }

      // Calcular el siguiente índice
      const nextIndex = currentIndex + 1;

      // Verificar si hay una siguiente canción en la playlist
      if (nextIndex < playlist.length) {
        console.log(`[RASTREO-PLAYLIST] Avanzando a canción ${nextIndex}/${playlist.length - 1}`);

        const nextTrackToPlay = playlist[nextIndex];
              setCurrentIndex(nextIndex);

        // Asegurarse de que la interfaz de usuario se actualice antes de reproducir
        setTimeout(async () => {
        // Reproducir la siguiente canción
          console.log('[RASTREO-PLAYLIST] Reproduciendo siguiente canción:', nextTrackToPlay.title);
          await playTrack(nextTrackToPlay);
        }, 100);

              } else {
        // No hay más canciones en la playlist, generar una nueva automáticamente
        console.log('[RASTREO-PLAYLIST] Fin de la playlist. Generando recomendaciones automáticamente');

        setError('Generando recomendaciones automáticas...');

        try {
          // Generar nueva playlist basada en la última canción
          if (currentTrack) {
            console.log('[RASTREO-PLAYLIST] Generando playlist basada en:', currentTrack.title);

            // Intentar recrear la playlist basada en la canción actual
            await createAutoPlaylist(currentTrack);

            // Una vez generada, intentar reproducir la primera canción después de un breve retraso
            // para asegurar que la UI se ha actualizado
            setTimeout(() => {
              try {
                // Verificar que se generó correctamente y tiene al menos una canción
                if (playlist.length > 0) {
                console.log('[RASTREO-PLAYLIST] Nueva playlist generada, reproduciendo primera canción');
                setCurrentIndex(0);
                playTrack(playlist[0]);
                  setError(''); // Limpiar mensaje de error
              } else {
                  console.warn('[RASTREO-PLAYLIST] La playlist generada está vacía');
                  setError('No se pudieron generar recomendaciones. Intenta con otra canción.');
                }
              } catch (playError) {
                console.error('[RASTREO-PLAYLIST] Error al reproducir primera canción de playlist generada:', playError);
                setError('Error al reproducir canciones recomendadas.');
              }
            }, 1000); // Aumentar el tiempo para asegurar que la playlist se ha creado correctamente
          } else {
            console.warn('[RASTREO-PLAYLIST] No hay canción actual para generar recomendaciones');
            setError('No hay canción actual para generar recomendaciones.');
          }
        } catch (error) {
          console.error('[RASTREO-PLAYLIST] Error al generar playlist en nextTrack:', error);
          setError('Error al generar lista automática. Inténtalo de nuevo.');
        }
      }
    } catch (error) {
      console.error('[RASTREO-PLAYLIST] Error en nextTrack:', error);
      setError(`Error al reproducir siguiente canción: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('[RASTREO-PLAYLIST] FIN de nextTrack');
  };

  // Canción anterior
  const previousTrack = async () => {
    if (playlist.length <= 1 || currentIndex < 0) {
            return;
          }

    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    setCurrentIndex(prevIndex);
    await playTrack(playlist[prevIndex]);
  };

  // Ajustar volumen
  const setVolume = (newVolume: number) => {
    setVolumeState(newVolume);
    if (youtubePlayerRef.current) {
      youtubePlayerRef.current.setVolume(newVolume * 100);
    }
  };

  // Saltar a un tiempo específico
  const seekTo = (time: number) => {
    if (youtubePlayerRef.current) {
      youtubePlayerRef.current.seekTo(time, true);
      setCurrentTime(time);
    }
  };

  // Añadir a la cola
  const addToQueue = (track: Track) => {
    setPlaylist(prev => [...prev, track]);
  };

  // Controlar el volumen
  const handleVolumeChange = (newVolume: number) => {
    setVolumeState(newVolume);
    if (youtubePlayerRef.current) {
      youtubePlayerRef.current.setVolume(newVolume * 100);
    }
  };

  // Evento para escuchar eventos de reproducción desde fuera del contexto
  useEffect(() => {
    // Crear un manejador para el evento personalizado 'playTrack'
    const handleCustomPlayTrack = (event: CustomEvent) => {
      if (event.detail) {
        const track = event.detail;
        console.log('[PlayerContext] Recibido evento playTrack con track:', track);
        if (track.youtubeId) {
          // Si ya tenemos el ID de YouTube, reproducir directamente
          console.log('[PlayerContext] Reproduciendo track con ID de YouTube:', track.youtubeId);
          playTrackWithPlayer(track);
        } else {
          // Si no tenemos el ID de YouTube, buscar y reproducir
          console.log('[PlayerContext] Buscando ID de YouTube para:', track.title);
          playTrack(track);
        }
      }
    };

    // Crear un manejador para el evento personalizado 'createPlaylist'
    const handleCreatePlaylist = (event: CustomEvent) => {
      if (event.detail) {
        console.log('[PlayerContext] Recibido evento createPlaylist:', event.detail);

        // Verificar que tenemos información mínima para crear una playlist
        if (event.detail.title) {
          // Normalizar el track para asegurar que tiene toda la información necesaria
          const track: Track = {
            id: event.detail.id || `autogen_${Date.now()}`,
            title: event.detail.title,
            artist: event.detail.subtitle || 'Artista desconocido',
            album: event.detail.album || '',
            cover: event.detail.coverUrl || '/placeholder-album.jpg',
            duration: event.detail.duration || 180000,
            youtubeId: event.detail.youtubeId,
            source: event.detail.source || 'automatic'
          };

          console.log('[PlayerContext] Generando playlist automática para:', track.title);

          // Generar playlist después de un breve retraso
          setTimeout(() => {
            createAutoPlaylist(track).catch(error => {
              console.error('[PlayerContext] Error al crear playlist automática:', error);
            });
          }, 500);
        } else {
          console.error('[PlayerContext] Evento createPlaylist sin información suficiente');
        }
      }
    };

    // Añadir y eliminar los event listeners
    window.addEventListener('playTrack', handleCustomPlayTrack as EventListener);
    window.addEventListener('createPlaylist', handleCreatePlaylist as EventListener);

    return () => {
      window.removeEventListener('playTrack', handleCustomPlayTrack as EventListener);
      window.removeEventListener('createPlaylist', handleCreatePlaylist as EventListener);
    };
  }, []);

  // Sincronizar el tiempo cuando isPlaying cambia a true
  useEffect(() => {
    if (isPlaying && youtubePlayerRef.current && youtubePlayerRef.current.getCurrentTime) {
      // Actualizar inmediatamente el tiempo actual cuando se inicia la reproducción
      try {
        const currentTimeFromPlayer = youtubePlayerRef.current.getCurrentTime();
        setCurrentTime(currentTimeFromPlayer);
      } catch (error) {
        console.error('Error al sincronizar tiempo:', error);
      }
    }
  }, [isPlaying]);

  // Actualizar duración cuando el video comienza a reproducirse
  useEffect(() => {
    if (isPlaying && youtubePlayerRef.current && youtubePlayerRef.current.getDuration) {
      // Intentar obtener la duración varias veces, ya que a veces no está disponible de inmediato
      const updateDuration = () => {
        try {
          const videoDuration = youtubePlayerRef.current.getDuration();
          if (videoDuration && videoDuration > 0) {
            console.log(`[PlayerContext] Duración del video obtenida: ${videoDuration}s`);
            setDuration(videoDuration);
            return true;
          }
        } catch (error) {
          console.error('[PlayerContext] Error al obtener duración:', error);
        }
        return false;
      };

      // Intentar obtener la duración de inmediato
      if (!updateDuration()) {
        // Si no funciona, intentar varias veces con intervalo
        let attempts = 0;
        const maxAttempts = 5;
        const durationCheckInterval = setInterval(() => {
          attempts++;
          if (updateDuration() || attempts >= maxAttempts) {
            clearInterval(durationCheckInterval);
          }
        }, 500); // Intentar cada medio segundo

        return () => clearInterval(durationCheckInterval);
      }
    }
  }, [isPlaying, currentTrack]);

  // Función para generar automáticamente la playlist
  const createAutoPlaylist = async (track: Track): Promise<void> => {
    console.log('[RASTREO-PLAYLIST] INICIO de createAutoPlaylist con track:', track.title);

    try {
      if (!track || !track.title) {
        console.error('[RASTREO-PLAYLIST] Error: No se puede crear lista automática sin información de canción');
        setError('No se pudo generar lista automática: información de canción incompleta.');
        return;
      }

      // Asegurarse de que el track tenga una imagen válida antes de empezar
      track.cover = getValidImageUrl(track.cover);
      track.albumCover = getValidImageUrl(track.albumCover);

      let recommendedTracks: Track[] = [];
      let errors: string[] = [];

      // 1. MÉTODO DIRECTO DE YOUTUBE MUSIC: Usar Youtube Music API directamente para recomendaciones
      // --- CAMBIO PASO 1: Apuntar a Python API y ajustar logs/params ---
      try {
        console.log('[RASTREO-PLAYLIST] MÉTODO PYTHON: Obteniendo recomendaciones de Python API'); // <-- Log actualizado

        // Preparar parámetros para la API Python
        let params = new URLSearchParams();
        const seed_artist = track.artist || 'unknown'; // <-- Definir seed_artist
        const seed_track = track.title; // <-- Definir seed_track
        const limit = 25; // <-- Definir limit

        // Elegir entre seed_artist o seed_track (o ambos, dependiendo de la API Python)
        if (seed_artist !== 'unknown') { // <-- Usar seed_artist definido
          params.append('seed_artist', seed_artist);
        }
        if (seed_track) { // <-- Usar seed_track definido
          params.append('seed_track', seed_track);
        }
        params.append('limit', String(limit)); // <-- Usar limit definido

        // Obtener URL base de la API Python desde configuración
        const { pythonApiUrl } = getAPIConfig(); // Importar desde la configuración de API
        
        // Construir endpoint completo usando la URL de la API
        const recommendationsEndpoint = `${pythonApiUrl}/api/recommendations`;
        const apiUrl = `${recommendationsEndpoint}?${params.toString()}`;

        console.log('[RASTREO-PLAYLIST] Solicitud a Python API:', apiUrl); // <-- Log actualizado

        // Implementar lógica de reintentos para la solicitud
        let response: Response | null = null;
        let retryCount = 0;
        const maxRetries = 3;

        // Definir controlador y timeout fuera del bucle de reintentos
        const controller = new AbortController();
        let timeoutId: NodeJS.Timeout | null = setTimeout(() => controller.abort(), 15000);

        try {
          while (retryCount < maxRetries && !response) {
            try {
              if (retryCount > 0) {
                console.log(`[RASTREO-PLAYLIST] Reintentando solicitud (${retryCount}/${maxRetries})...`);
                // Esperar un tiempo antes de reintentar (backoff exponencial)
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
              }

              // Realizar la petición a la API configurada dinámicamente
              response = await fetch(apiUrl, {
                signal: controller.signal,
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Cache-Control': 'no-cache'
                }
              });
            } catch (fetchRetryError) {
              console.error(`[RASTREO-PLAYLIST] Error en intento ${retryCount + 1}:`, fetchRetryError);
              retryCount++;

              // Si es el último intento, propagar el error
              if (retryCount >= maxRetries) {
                throw fetchRetryError;
              }
            }
          }

          // Limpiar el timeout una vez que tenemos respuesta
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }

          if (response && response.ok) {
            // Verificar que la respuesta sea JSON antes de procesarla
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const data = await response.json();
              console.log('[RASTREO-PLAYLIST] Datos obtenidos:', data ? `${data.length} tracks` : 'null o undefined');

              // --- CAMBIO PASO 2: Mapeo de respuesta Python a AppTrack ---
              if (data && Array.isArray(data) && data.length > 0) { // <-- Asegurar que data es array
                recommendedTracks = data.map((item: any, index: number): AppTrack => { // <-- Tipo AppTrack y item: any
                  // Asegurarnos de que el artista se mantenga si ya existe
                  const artist = item.artist || 'Artista Desconocido'; // <-- Usar item.artist

                  return {
                    id: item.id || item.youtubeId || `rec-py-${index}-${Date.now()}`, // <-- ID de Python o YT
                    title: item.title || 'Sin título',
                    artist: artist, // <-- artista procesado
                    album: item.album || 'Álbum Desconocido', // <-- item.album
                    albumCover: getValidImageUrl(item.albumCover || item.cover || item.thumbnail), // <-- Múltiples fallbacks para cover
                    cover: getValidImageUrl(item.cover || item.thumbnail), // <-- cover o thumbnail
                    duration: item.duration || 0, // <-- Asumiendo duración en segundos
                    youtubeId: item.youtubeId || item.id, // <-- item.youtubeId
                    spotifyId: item.spotifyId, // <-- item.spotifyId
                    source: item.source || 'python-recommendation', // <-- Marcar fuente
                    artistId: item.artistId, // <-- Campos opcionales
                    albumId: item.albumId   // <-- Campos opcionales
                  };
                });
                console.log('[RASTREO-PLAYLIST] Recomendaciones Python convertidas a AppTrack:', recommendedTracks.length);
              } else {
                   console.log('[RASTREO-PLAYLIST] La API Python no devolvió un array de recomendaciones válido.');
              }
              // --- FIN CAMBIO PASO 2 ---
            }
          }
        } finally {
          // Asegurarnos de limpiar el timeout independientemente de si hay éxito o error
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
        }
      } catch (fetchError) {
        console.error('[RASTREO-PLAYLIST] Error fetch API Python:', fetchError); // <-- Log actualizado
        errors.push(`Python API fetch: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`); // <-- Log actualizado
      }

      // Si no se obtuvieron recomendaciones, intentar con los siguientes métodos...
      // (Aquí pueden ir los otros métodos que ya tienes implementados)

      // 5. FALLBACK si no hay recomendaciones (Mantenemos el fallback existente)
      if (recommendedTracks.length === 0) {
        console.log('[RASTREO-PLAYLIST] Usando tracks fallback ya que no se obtuvieron recomendaciones.');
        errors.forEach(err => console.error(`[RASTREO-PLAYLIST] Error registrado: ${err}`));

        // --- CAMBIO PASO 3: Usar AppTrack en Fallback ---
        const fallbackTracks: AppTrack[] = []; // <-- Tipo AppTrack
        const similarArtists = [
          'Artista Similar', 'Popular Artist', 'Nueva Música', 'Top Hits', 'El mejor', 'Clásicos'
        ];

        for (let i = 0; i < 10; i++) {
          const artistIndex = i % similarArtists.length;
          fallbackTracks.push({
            id: `fallback_track_${i}_${Date.now()}`,
            title: `Canción similar #${i + 1}`,
            artist: `${similarArtists[artistIndex]} (basado en ${track.artist || 'desconocido'})`,
            album: 'Álbum recomendado',
            cover: getValidImageUrl(track.cover), // Usar cover validado
            albumCover: getValidImageUrl(track.albumCover || track.cover), // Usar cover validado
            duration: 180 + (i * 20), // Duración en segundos
            spotifyId: undefined,
            youtubeId: undefined,
            source: 'fallback' // Indicar que es fallback
            // Asegurarse que todos los campos requeridos por AppTrack estén aquí o sean opcionales
          });
        }
        recommendedTracks = fallbackTracks;
        console.log('[RASTREO-PLAYLIST] Creados tracks fallback (AppTrack):', recommendedTracks.length);
        // --- FIN CAMBIO PASO 3 ---
      }

      // Actualizar la playlist si tenemos recomendaciones
      if (recommendedTracks.length > 0) {
        try {
          // --- CAMBIO PASO 3: Usar AppTrack en Playlist final ---
          // Añadir la canción actual al principio
          let newPlaylist: AppTrack[] = [track]; // <-- Tipo AppTrack

          console.log(`[RASTREO-PLAYLIST] Creando playlist con ${recommendedTracks.length} canciones recomendadas (AppTrack).`);

          // Añadir las recomendaciones, evitando duplicados
          recommendedTracks.forEach((recTrack: AppTrack) => { // <-- Tipar recTrack
            if (recTrack && recTrack.title) {
              if (!recTrack.id) {
                recTrack.id = `gen_${recTrack.title.substring(0, 10)}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
              }
              if (!newPlaylist.some(t => t.id === recTrack.id)) {
                // Validar las imágenes para evitar solicitudes innecesarias
                recTrack.cover = getValidImageUrl(recTrack.cover);
                recTrack.albumCover = getValidImageUrl(recTrack.albumCover || recTrack.cover);

                newPlaylist.push(recTrack); // <-- Añadir AppTrack
              }
            }
          });

          console.log(`[RASTREO-PLAYLIST] Playlist final (AppTrack) con ${newPlaylist.length} canciones`);
          // --- FIN CAMBIO PASO 3 ---

          setPlaylist(newPlaylist); // Actualizar la playlist en el estado
          setCurrentIndex(0); // Empezar desde la canción original

          // Forzar actualización de la UI
          setLastPlaylistUpdate(Date.now());

          console.log('[RASTREO-PLAYLIST] Playlist actualizada correctamente');
          setError(''); // Limpiar cualquier error previo
          return;
        } catch (playlistError) {
          console.error('[RASTREO-PLAYLIST] ERROR al actualizar la playlist:', playlistError);
          setError(`Error al crear lista automática: ${playlistError instanceof Error ? playlistError.message : String(playlistError)}`);
          return;
        }
      } else {
        console.error('[RASTREO-PLAYLIST] No se obtuvieron recomendaciones de ningún método');
        setError('No se pudieron generar recomendaciones automáticas. Por favor, intenta con otra canción.');
        return;
      }
    } catch (error) {
      console.error('[RASTREO-PLAYLIST] ERROR CRÍTICO en createAutoPlaylist:', error);
      setError('Error al generar la lista automática. Por favor, intenta de nuevo más tarde.');
      return;
    } finally {
    console.log('[RASTREO-PLAYLIST] FIN de createAutoPlaylist');
    }
  };

  // Actualizar getYoutubeVideoId
  const getYoutubeVideoId = async (title: string, artist: string): Promise<string | null> => {
    try {
      // Construir parámetros de búsqueda
      const queryParams = new URLSearchParams({
        title,
        artist
      }).toString();

      console.log(`[PlayerContext] Buscando video para: ${title} - ${artist}`);

      // Llamar a nuestra API
      const response = await fetch(`/api/youtube/find-track?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Error en la respuesta: ${response.status}`);
      }

      const data = await response.json();

      // Verificar si tenemos un videoId en la respuesta
      if (data.videoId) {
        console.log(`[PlayerContext] Video encontrado: ${data.videoId} (${data.title})`);
        return data.videoId;
      }

      // Verificar si hay un mensaje de error pero no es un error fatal
      if (data.message && !data.error) {
        console.log(`[PlayerContext] Mensaje de la API: ${data.message}`);
      }

      // Si hay un error específico, mostrarlo
      if (data.error) {
        console.error(`[PlayerContext] Error de la API: ${data.error}`);
        setError(`Error al buscar video: ${data.message || data.error}`);
      }

      console.log('[PlayerContext] No se encontró video en la respuesta');
      return null;
      } catch (error) {
      console.error('[PlayerContext] Error buscando ID de YouTube:', error);
      return null;
    }
  };

  // Actualizar fallbackFindVideo
  const fallbackFindVideo = async (track: Track): Promise<boolean> => {
    try {
      // Usar el endpoint /api/youtube/search como alternativa
      const searchQuery = `${track.title} ${track.artist}`;
      console.log(`[PlayerContext] Búsqueda alternativa: "${searchQuery}"`);

      const response = await fetch(`/api/youtube/search?query=${encodeURIComponent(searchQuery)}&filter=songs&limit=1`);

      if (!response.ok) {
        throw new Error(`Error en la búsqueda: ${response.status}`);
      }

      const data = await response.json();

      // Verificar si tenemos resultados (nuevo formato)
      if (data.results && data.results.length > 0 && data.results[0].videoId) {
        const videoId = data.results[0].videoId;
        console.log(`[PlayerContext] Video encontrado por búsqueda alternativa: ${videoId} (${data.results[0].title})`);

        // Guardar el ID en la pista
        track.youtubeId = videoId;
        setCurrentTrack({ ...track });

        // Intentar reproducir con el reproductor
        if (youtubePlayerRef.current) {
          await playTrackWithPlayer(track);
          return true;
        }
          } else {
        console.log('[PlayerContext] No se encontraron resultados en la búsqueda alternativa');

        // Si hay un mensaje de error, mostrarlo
        if (data.error) {
          setError(`Error: ${data.message || 'No se pudo encontrar la canción'}`);
        }
      }

      // Si llegamos aquí, no se encontró video
      console.error('[PlayerContext] No hay ID de YouTube para reproducir');
      return false;
    } catch (error) {
      console.error('[PlayerContext] Error en el método alternativo:', error);
      return false;
    }
  };

  // Función para cargar un video en el reproductor
  const loadVideo = async (player: any, videoId: string): Promise<void> => {
      console.log('[PlayerContext] Cargando video:', videoId);

      if (!player || typeof player.loadVideoById !== 'function') {
      throw new Error('Reproductor no disponible o método loadVideoById no encontrado');
      }

    try {
      // Cargar el video
      player.loadVideoById({
        videoId: videoId,
        startSeconds: 0,
        suggestedQuality: 'default'
      });

      // Inicializar valores
      setCurrentTime(0);

      // Configurar un temporizador para verificar periódicamente el estado del video
      let checkAttempts = 0;
      const maxAttempts = 5;

      // Definir función para verificar el estado y duración
        const checkState = () => {
        try {
          // Verificar estado del reproductor
          if (typeof player.getPlayerState === 'function') {
            const state = player.getPlayerState();

            // 1 = reproduciendo, 3 = buffering
            if (state === 1 || state === 3) {
              console.log(`[PlayerContext] Video cargado correctamente, estado: ${state}`);

              // Obtener duración si está disponible
              if (typeof player.getDuration === 'function') {
          const videoDuration = player.getDuration();
          if (videoDuration && videoDuration > 0) {
                  console.log('[PlayerContext] Duración del video obtenida:', videoDuration + 's');
            setDuration(videoDuration);

                  // Iniciar actualizaciones de tiempo
                  startTimeUpdates();

                  // Si estamos en estado de reproducción, asegurar que el estado UI está sincronizado
                  if (state === 1 && !isPlaying) {
                    setIsPlaying(true);
                    isPlayingRef.current = true;
                  }

                  return; // Salir de la función de verificación
                }
              }
            }
          }

          // Si no se cumplieron las condiciones para salir, incrementar intentos
          checkAttempts++;

          if (checkAttempts < maxAttempts) {
            // Programar otro intento
            setTimeout(checkState, 500);
          } else {
            console.warn('[PlayerContext] Máximos intentos de verificación alcanzados');
            // Intentar reproducir de todos modos
            if (typeof player.playVideo === 'function') {
              player.playVideo();
              setIsPlaying(true);
              isPlayingRef.current = true;
            }
          }
        } catch (error) {
          console.error('[PlayerContext] Error en checkState:', error);
        }
      };

      // Iniciar verificación
      setTimeout(checkState, 500);

      } catch (error) {
      console.error('[PlayerContext] Error al cargar video:', error);
      throw error;
    }
  };

  // Función helper para encontrar y establecer el ID de YouTube de una canción
  const findAndSetYoutubeId = async (track: Track): Promise<boolean> => {
    console.log('[RASTREO-PLAYLIST] Buscando youtubeId para:', track.title, 'por', track.artist);

    try {
      // Método 1: Primero intentamos con la búsqueda general (fallbackFindVideo)
      console.log('[RASTREO-PLAYLIST] Método 1: Intentando búsqueda general');
      const fallbackSuccess = await fallbackFindVideo(track);
      if (fallbackSuccess) {
        console.log('[RASTREO-PLAYLIST] Búsqueda general exitosa, youtubeId:', track.youtubeId);
        return true;
      }

      // Método 2: Si falló, intentamos con la API específica
      console.log('[RASTREO-PLAYLIST] Método 2: Intentando con API específica');
      try {
        const videoId = await getYoutubeVideoId(track.title, track.artist);
        if (videoId) {
          console.log('[RASTREO-PLAYLIST] API específica encontró youtubeId:', videoId);

          // Almacenar el ID en la pista
          track.youtubeId = videoId;
          setCurrentTrack({ ...track });

          return true;
        } else {
          console.warn('[RASTREO-PLAYLIST] API específica no encontró youtubeId');
        }
      } catch (apiError) {
        console.error('[RASTREO-PLAYLIST] Error en API específica:', apiError);
      }

      // Si llegamos aquí, no se pudo encontrar un ID
      console.error('[RASTREO-PLAYLIST] No se pudo encontrar youtubeId por ningún método');
      return false;
    } catch (error) {
      console.error('[RASTREO-PLAYLIST] Error en findAndSetYoutubeId:', error);
      return false;
    }
  };

  // Constantes para imágenes de fallback para reducir solicitudes repetitivas
  const PLACEHOLDER_ALBUM = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzMzMyIvPjwvc3ZnPg==';

  // Caché para imágenes fallidas para evitar múltiples solicitudes a imágenes que fallan
  const failedCoverCache = new Set<string>();

  // Ya no necesitamos precargar la imagen porque es un Data URL
  // if (typeof window !== 'undefined') {
  //   const img = new window.Image();
  //   img.src = PLACEHOLDER_ALBUM;
  // }

  // Función helper para obtener una URL de imagen válida
  const getValidImageUrl = (url?: string): string => {
    // Si no hay URL o es vacía, usar placeholder
    if (!url || url === '' || failedCoverCache.has(url)) {
      return PLACEHOLDER_ALBUM;
    }

    // Si la URL contiene términos que indican que es una URL de fallback o inválida, usar placeholder
    if (url.includes('undefined') ||
        url.includes('/default/') ||
        url === 'default' ||
        url.includes('no-cover')) {
      return PLACEHOLDER_ALBUM;
    }

    return url;
  };

  // Función para cambiar entre reproducción aleatoria y normal
  const toggleShuffle = () => {
    if (!isShuffleEnabled) {
      // Guardar la lista original
      setOriginalPlaylist([...playlist]);

      // Mezclar la lista (excepto la canción actual si hay una reproduciéndose)
      if (currentTrack && playlist.length > 1) {
        const currentIdx = playlist.findIndex(track =>
          track.id === currentTrack.id);

        if (currentIdx !== -1) {
          // Retirar la canción actual
          const currentSong = playlist[currentIdx];
          const songsToShuffle = [
            ...playlist.slice(0, currentIdx),
            ...playlist.slice(currentIdx + 1)
          ];

          // Mezclar el resto
          const shuffled = shuffleArray(songsToShuffle);

          // Poner la canción actual al principio
          setPlaylist([currentSong, ...shuffled]);
        } else {
          // Si no hay canción actual, mezclar todo
          setPlaylist(shuffleArray([...playlist]));
        }
      } else {
        // Si no hay canción o solo hay una, simplemente mezclar
        setPlaylist(shuffleArray([...playlist]));
      }
    } else {
      // Restaurar la lista original
      setPlaylist([...originalPlaylist]);
    }

    setIsShuffleEnabled(!isShuffleEnabled);
  };

  // Función para cambiar el modo de repetición
  const toggleRepeat = () => {
    setIsRepeatEnabled(!isRepeatEnabled);
  };

  // Función para mezclar un array (algoritmo Fisher-Yates)
  const shuffleArray = (array: any[]) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // Modificar el valor del contexto para incluir las nuevas funciones
  const value: PlayerContextType = {
    currentTrack,
    playlist,
    isPlaying,
    volume: volumeState,
    currentTime,
    duration,
    lyrics,
    isLoading,
    error,
    isShuffleEnabled,
    isRepeatEnabled,
    playTrack,
    playPlaylist,
    togglePlay,
    nextTrack,
    previousTrack,
    setVolume,
    seekTo,
    addToQueue,
    createAutoPlaylist,
    toggleShuffle,
    toggleRepeat
  };

  // Añadir este useEffect al final, justo antes del return de PlayerProvider
  // Monitor global de finalización de canciones
  useEffect(() => {
    // Solo activar si hay reproducción en curso
    if (!isPlaying || !currentTrack) return;

    // Si no tenemos duración válida, no podemos calcular progreso
    if (duration <= 0) return;

    console.log('[PlayerContext] Monitor global activado');

    // Función para verificar el progreso
    const checkProgress = () => {
      // Obtener tiempo actual directamente del player para mayor precisión
      try {
        if (!youtubePlayerRef.current) return;

        let playerCurrentTime = currentTime;
        let playerDuration = duration;

        // Intentar obtener tiempo y duración directamente del player
        if (typeof youtubePlayerRef.current.getCurrentTime === 'function') {
          playerCurrentTime = youtubePlayerRef.current.getCurrentTime();
        }

        if (typeof youtubePlayerRef.current.getDuration === 'function') {
          playerDuration = youtubePlayerRef.current.getDuration();
        }

        // Verificar si estamos cerca del final o ya pasamos
        const progressRatio = playerCurrentTime / playerDuration;
        const timeRemaining = Math.max(0, playerDuration - playerCurrentTime);

        // Registro periódico
        if (progressRatio > 0.9 && Math.floor(playerCurrentTime) % 3 === 0) {
          console.log(`[PlayerMonitor] Estado: ${(progressRatio * 100).toFixed(1)}% - Tiempo restante: ${timeRemaining.toFixed(1)}s`);
        }

        // Detección 1: Progreso muy cercano al final (99.5%)
        if (progressRatio >= 0.995) {
          console.log(`[PlayerMonitor] DETECCIÓN POR PROGRESO: ${(progressRatio * 100).toFixed(2)}%`);
          nextTrack();
          return true;
        }

        // Detección 2: Tiempo restante muy pequeño (menos de 0.3 segundos)
        if (timeRemaining < 0.3 && playerDuration > 0) {
          console.log(`[PlayerMonitor] DETECCIÓN POR TIEMPO RESTANTE: ${timeRemaining.toFixed(2)}s`);
          nextTrack();
          return true;
        }

        // Detección 3: Estado del reproductor directamente
        try {
          if (typeof youtubePlayerRef.current.getPlayerState === 'function') {
            const playerState = youtubePlayerRef.current.getPlayerState();
            // 0 = ENDED en la API de YouTube
            if (playerState === 0) {
              console.log('[PlayerMonitor] DETECCIÓN POR ESTADO: ENDED');
              nextTrack();
              return true;
            }
          }
        } catch (e) {
          console.error('[PlayerMonitor] Error al verificar estado:', e);
        }

        return false;
      } catch (error) {
        console.error('[PlayerMonitor] Error en verificación de progreso:', error);
        return false;
      }
    };

    // Crear intervalo para verificación frecuente
    const progressInterval = setInterval(checkProgress, 300);

    // También configurar temporizador para el final esperado
    let endTimer: NodeJS.Timeout | null = null;

    // Si tenemos tiempo y duración válidos, programar verificación para el final esperado
    if (duration > 0 && currentTime >= 0) {
      const timeToEnd = Math.max(0, (duration - currentTime) * 1000);

      // Si el tiempo restante es razonable, configurar un temporizador
      if (timeToEnd > 0 && timeToEnd < 30000) { // Máximo 30 segundos
        console.log(`[PlayerMonitor] Programando verificación para final en ${(timeToEnd/1000).toFixed(1)}s`);

        endTimer = setTimeout(() => {
          console.log('[PlayerMonitor] Verificación de fin de canción por temporizador');
          // Verificar si realmente terminó
          if (isPlaying && checkProgress()) {
            console.log('[PlayerMonitor] DETECCIÓN POR TEMPORIZADOR PROGRAMADO');
          }
        }, timeToEnd + 200); // Agregar 200ms para asegurar que estamos después del final
      }
    }

    // Limpiar temporizadores al desmontar
    return () => {
      clearInterval(progressInterval);
      if (endTimer) clearTimeout(endTimer);
      console.log('[PlayerMonitor] Monitor global desactivado');
    };
  }, [isPlaying, currentTrack, duration, currentTime]);

  // Estado para el reproductor de fallback (HTML5 Audio)
  const [fallbackAudioPlayer, setFallbackAudioPlayer] = useState<HTMLAudioElement | null>(null);
  const fallbackPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [usingFallbackPlayer, setUsingFallbackPlayer] = useState<boolean>(false);

  // Inicializar el reproductor de audio de fallback
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audioElement = new Audio();
      audioElement.preload = 'auto';
      audioElement.volume = volumeState;

      // Configurar eventos
      audioElement.addEventListener('timeupdate', () => {
        setCurrentTime(audioElement.currentTime);
      });

      audioElement.addEventListener('durationchange', () => {
        if (audioElement.duration && audioElement.duration > 0) {
          setDuration(audioElement.duration);
        }
      });

      audioElement.addEventListener('ended', () => {
        setIsPlaying(false);
        // Reproducir siguiente canción si hay más en la lista
        nextTrack();
      });

      audioElement.addEventListener('pause', () => {
        setIsPlaying(false);
      });

      audioElement.addEventListener('play', () => {
        setIsPlaying(true);
      });

      // Guardar referencia
      fallbackPlayerRef.current = audioElement;
      setFallbackAudioPlayer(audioElement);
    }

    return () => {
      if (fallbackPlayerRef.current) {
        fallbackPlayerRef.current.pause();
        fallbackPlayerRef.current.src = '';
        fallbackPlayerRef.current = null;
      }
    };
  }, []);

  // Función para reproducir usando el fallback player
  const playWithFallbackPlayer = async (track: ExtendedTrack): Promise<boolean> => {
    if (!fallbackPlayerRef.current) {
      console.error('[PlayerContext] Reproductor de fallback no disponible');
      return false;
    }

    try {
      // Activar el modo de fallback
      setUsingFallbackPlayer(true);

      // Intentar utilizar la URL de audio directa si está disponible (para fuentes locales)
      if (track.audioUrl) {
        console.log('[PlayerContext] Usando URL de audio directa con reproductor de fallback:', track.audioUrl);
        fallbackPlayerRef.current.src = track.audioUrl;
        fallbackPlayerRef.current.play();
        setIsPlaying(true);
        return true;
      }

      // Si no hay URL directa, intentar obtener el audio de otras fuentes
      if (track.youtubeId) {
        // Intentar obtener el audio desde el servidor con el ID de YouTube
        try {
          const response = await fetch(`/api/audio-proxy?videoId=${track.youtubeId}`);

          if (response.ok) {
            const data = await response.json();
            if (data.audioUrl) {
              console.log('[PlayerContext] Obtenido audio desde proxy con reproductor de fallback:', data.audioUrl);
              fallbackPlayerRef.current.src = data.audioUrl;
              fallbackPlayerRef.current.play();
              setIsPlaying(true);
              return true;
            }
          }

          console.error('[PlayerContext] No se pudo obtener URL de audio desde el proxy');
        } catch (error) {
          console.error('[PlayerContext] Error al obtener audio desde proxy:', error);
        }
      }

      console.error('[PlayerContext] No se pudo reproducir con reproductor de fallback');
      return false;
    } catch (error) {
      console.error('[PlayerContext] Error al reproducir con reproductor de fallback:', error);
      return false;
    }
  };

  // Efecto para detectar cuando la API está disponible
  useEffect(() => {
    if (youtubeReady && window.YT && window.YT.Player) {
      console.log('[PlayerContext] youtubeReady=true, API disponible, inicializando...');
      setIsYoutubeReady(true);

      // Inicializar el reproductor inmediatamente si la API está disponible
      if (!youtubePlayerRef.current) {
        createYouTubePlayer();
      }
    }
  }, [youtubeReady]);

  // Escuchar el evento personalizado youtube-api-ready
  useEffect(() => {
    const handleYouTubeApiReady = () => {
      console.log('[PlayerContext] Evento youtube-api-ready recibido');
      setIsYoutubeReady(true);

      // Inicializar el reproductor si no existe
      if (!youtubePlayerRef.current && window.YT && window.YT.Player) {
        createYouTubePlayer();
      }
    };

    // Registrar el listener
    window.addEventListener('youtube-api-ready', handleYouTubeApiReady);

    // Limpiar
    return () => {
      window.removeEventListener('youtube-api-ready', handleYouTubeApiReady);
    };
  }, []);

  // Monitor de estado del reproductor (agregando esta nueva verificación)
  useEffect(() => {
    // Solo activar si hay una canción actual
    if (!currentTrack) return;

    console.log('[PlayerStateMonitor] Iniciando monitoreo periódico del estado del reproductor');

    // Verificar periódicamente si el estado visual coincide con el estado real del reproductor
    const stateCheckInterval = setInterval(() => {
      if (!youtubePlayerRef.current) return;

      try {
        if (typeof youtubePlayerRef.current.getPlayerState === 'function') {
          const playerState = youtubePlayerRef.current.getPlayerState();
          // YT.PlayerState.PLAYING = 1
          const isActuallyPlaying = playerState === 1;

          // Si hay discrepancia, forzar sincronización de estado
          if (isActuallyPlaying !== isPlaying) {
            console.log(`[PlayerStateMonitor] Corrigiendo discrepancia: reproductor=${isActuallyPlaying ? 'reproduciendo' : 'pausado'}, estado UI=${isPlaying ? 'reproduciendo' : 'pausado'}`);
            setIsPlaying(isActuallyPlaying);
            isPlayingRef.current = isActuallyPlaying;

            // Si el reproductor está reproduciendo pero el estado dice lo contrario, reiniciar actualizaciones
            if (isActuallyPlaying && !isPlaying) {
              startTimeUpdates();
            }
          }

          // Siempre actualizar el tiempo actual para mantener sincronización
          if (typeof youtubePlayerRef.current.getCurrentTime === 'function') {
            const currentSeconds = youtubePlayerRef.current.getCurrentTime();
            if (Math.abs(currentSeconds - currentTime) > 0.5) {
              console.log(`[PlayerStateMonitor] Corrigiendo tiempo: API=${currentSeconds.toFixed(1)}s, Estado=${currentTime.toFixed(1)}s`);
              setCurrentTime(currentSeconds);
            }
          }

          // Verificar duración si no está establecida
          if (duration <= 0 && typeof youtubePlayerRef.current.getDuration === 'function') {
            const videoDuration = youtubePlayerRef.current.getDuration();
            if (videoDuration && videoDuration > 0) {
              console.log('[PlayerStateMonitor] Estableciendo duración faltante:', videoDuration);
              setDuration(videoDuration);
            }
          }
        }
      } catch (error) {
        console.error('[PlayerStateMonitor] Error en verificación de estado:', error);
      }
    }, 2000); // Verificar cada 2 segundos

    return () => {
      clearInterval(stateCheckInterval);
      console.log('[PlayerStateMonitor] Monitoreo detenido');
    };
  }, [currentTrack, isPlaying, currentTime, duration]);

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
};

export default PlayerContext;
