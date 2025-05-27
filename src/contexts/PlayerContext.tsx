'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getLyrics, parseSyncedLyrics } from '@/services/lyricsService';
import { getAPIConfig } from '@/lib/api-config';
// Importar el tipo Track de types.ts
import { Track as AppTrack, LyricLine as AppLyricLine } from '@/types/types';
import YouTubePlayer from '@/components/YouTubePlayer';
import { useBackgroundPlayback } from '@/hooks/useBackgroundPlayback';
import { useMediaSession } from '@/hooks/useMediaSession';

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
  player: any;
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
  player: null,
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
export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};

interface PlayerProviderProps {
  children: React.ReactNode;
  youtubeReady?: boolean;
}

// Proveedor del contexto
export const PlayerProvider: React.FC<PlayerProviderProps> = ({ children, youtubeReady = false }) => {
  // Referencias y estados para el reproductor de YouTube
  const youtubePlayerRef = useRef<any>(null);

  // Referencia para controlar el temporizador de siguiente canción
  const nextTrackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Estados principales del reproductor
  const [player, setPlayer] = useState<any>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [originalPlaylist, setOriginalPlaylist] = useState<Track[]>([]); // Almacena la lista original sin mezclar
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.7);
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
  }, [playlist, lastPlaylistLength]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Referencia al reproductor de YouTube
  const [youtubePlayer, setYoutubePlayer] = useState<any>(null);
  const [isYoutubeReady, setIsYoutubeReady] = useState<boolean>(false);

  // Referencia para isPlaying para evitar "stale closure"
  const isPlayingRef = useRef<boolean>(isPlaying);

  // Actualizar la referencia cuando cambie isPlaying
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Referencia para el intervalo de tiempo
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Función para iniciar actualizaciones periódicas del tiempo
  const startTimeUpdates = () => {
    if (youtubePlayerRef.current && typeof youtubePlayerRef.current.getCurrentTime === 'function') {
      try {
        setCurrentTime(youtubePlayerRef.current.getCurrentTime());
      } catch {};
    }

    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current);
      timeUpdateIntervalRef.current = null;
    }

    if (!youtubePlayerRef.current) {
      setTimeout(() => {
      if (youtubePlayerRef.current) {
          startTimeUpdates();
          }
      }, 1000);
      return;
    }

    timeUpdateIntervalRef.current = setInterval(() => {
      if (!youtubePlayerRef.current) return;

      try {
        if (typeof youtubePlayerRef.current.getCurrentTime !== 'function') return;

          const currentSeconds = youtubePlayerRef.current.getCurrentTime();
          setCurrentTime(currentSeconds);

          // Verificar duración si no la tenemos
          if (duration <= 0 && typeof youtubePlayerRef.current.getDuration === 'function') {
            try {
              const videoDuration = youtubePlayerRef.current.getDuration();
              if (videoDuration && videoDuration > 0) {
                setDuration(videoDuration);
              }
          } catch {};
      }

      // Detectar final de la canción y avanzar automáticamente
      if (duration > 0 && currentSeconds > 0) {
        const progressRatio = currentSeconds / duration;
        const timeRemaining = Math.max(0, duration - currentSeconds);

        // Si estamos muy cerca del final (98% o menos de 1 segundo restante)
        if (progressRatio >= 0.98 || timeRemaining < 1) {
          // Verificar el estado del player para confirmar
          if (typeof youtubePlayerRef.current.getPlayerState === 'function') {
            const playerState = youtubePlayerRef.current.getPlayerState();
            
            // Estado 0 = terminado, o si estamos muy cerca del final y no está reproduciendo
            if (playerState === 0 || (progressRatio >= 0.995 && playerState !== 1)) {
              console.log('[PlayerContext] Canción terminada, avanzando a la siguiente');
              // Limpiar el timer antes de cambiar de canción para evitar conflictos
              if (timeUpdateIntervalRef.current) {
                clearInterval(timeUpdateIntervalRef.current);
                timeUpdateIntervalRef.current = null;
              }
              // Avanzar a la siguiente canción
              setTimeout(() => nextTrack(), 100);
              return;
            }
          }
        }
      }
      } catch {};
    }, 50);
  };

  // Agregar un efecto dedicado para verificar la duración periódicamente
  useEffect(() => {
    if (!isPlaying || !currentTrack || !youtubePlayerRef.current) return;

    const updateDuration = () => {
      try {
        if (youtubePlayerRef.current && typeof youtubePlayerRef.current.getDuration === 'function') {
          const newDuration = youtubePlayerRef.current.getDuration();

          if (newDuration && newDuration > 0) {
            if (duration !== newDuration) {
            setDuration(newDuration);
              return true;
            }
            return true;
          }
      }
      } catch {};
      return false;
    };

    const durationValid = updateDuration();

    if (!durationValid) {
      const durationCheckInterval = setInterval(() => {
        if (updateDuration() || !isPlaying) {
          clearInterval(durationCheckInterval);
        }
      }, 1000);

      return () => {
        clearInterval(durationCheckInterval);
      };
    }
  }, [isPlaying, currentTrack, duration]);

  // Manejar intervalo de tiempo cuando cambia el estado de reproducción
  useEffect(() => {
    if (isPlaying && currentTrack && youtubePlayerRef.current) {
      // Si está reproduciendo, asegurar que el timer esté activo
      startTimeUpdates();
    } else if (!isPlaying && timeUpdateIntervalRef.current) {
      // Si no está reproduciendo, limpiar el timer
      clearInterval(timeUpdateIntervalRef.current);
      timeUpdateIntervalRef.current = null;
    }

    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
    };
  }, [isPlaying, currentTrack]); // Agregado currentTrack para reiniciar en canciones nuevas

  // Cargar la API de YouTube
  useEffect(() => {
    let isMounted = true;

    const initYouTubeAPI = () => {
      if (!window.YT) {
        if (document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
          window.onYouTubeIframeAPIReady = () => {
            if (isMounted) {
              setIsYoutubeReady(true);
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

          window.onYouTubeIframeAPIReady = () => {
            if (isMounted) {
            setIsYoutubeReady(true);
            setTimeout(() => {
              createYouTubePlayer();
            }, 500);
          }
        };

        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      } else {
        setIsYoutubeReady(true);
        setTimeout(() => {
          createYouTubePlayer();
        }, 500);
      }
    };

    initYouTubeAPI();

    return () => {
      isMounted = false;
      window.onYouTubeIframeAPIReady = null;
    };
  }, []);

  // Crear y configurar el reproductor una vez que la API está lista
  useEffect(() => {
    if (!isYoutubeReady) return;

    if (!window.YT || !window.YT.Player) {
      const checkInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkInterval);
          createYouTubePlayer();
        }
      }, 100);

      return () => {
        clearInterval(checkInterval);
      };
    } else {
      createYouTubePlayer();
    }
  }, [isYoutubeReady]);

  // createYouTubePlayer desactivado: usamos react-youtube para instanciar el player
  const createYouTubePlayer = () => {};

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
      setLyrics({
        plain: null,
        synced: [],
        isLoading: false
      });
        return;
      }

    setLyrics(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await getLyrics(track);

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
    } catch {
      setLyrics({
        plain: null,
        synced: [],
        isLoading: false
      });
    }
  };

  // Función para convertir un objeto de track de Spotify a nuestro formato Track
  const convertSpotifyTrackToTrack = (spotifyTrack: any): Track => {
    try {
      let albumCoverUrl = '/placeholder-album.jpg';
      if (spotifyTrack.album && spotifyTrack.album.images && spotifyTrack.album.images.length > 0) {
        albumCoverUrl = spotifyTrack.album.images[0].url;
      }

      albumCoverUrl = getValidImageUrl(albumCoverUrl);

    return {
      id: spotifyTrack.id,
      title: spotifyTrack.name,
        artist: spotifyTrack.artists.map((artist: any) => artist.name).join(', '),
        duration: spotifyTrack.duration_ms / 1000,
        album: spotifyTrack.album?.name || 'Desconocido',
        cover: albumCoverUrl,
        albumCover: albumCoverUrl,
        source: 'spotify',
        youtubeId: undefined
      };
    } catch {
      return {
        id: `error_${Date.now()}`,
        title: spotifyTrack?.name || 'Canción desconocida',
        artist: spotifyTrack?.artists ? spotifyTrack.artists.map((artist: any) => artist.name).join(', ') : 'Artista desconocido',
        duration: spotifyTrack?.duration_ms ? spotifyTrack.duration_ms / 1000 : 0,
        album: spotifyTrack?.album?.name || 'Desconocido',
        cover: PLACEHOLDER_ALBUM,
        albumCover: PLACEHOLDER_ALBUM,
        source: 'spotify',
        youtubeId: undefined
      };
    }
  };

  // Mejorar la función playTrack para manejar mejor los errores y siempre generar listas de reproducción
  const playTrack = async (track: Track): Promise<boolean> => {
    if (!track.youtubeId) {
      setError('No se encontró ID de YouTube para esta canción');
      return false;
    }
    
    // Establecer la canción actual inmediatamente
    setCurrentTrack(track);
    setCurrentIndex(0);
    
    // Reproducir la canción
    const player = youtubePlayerRef.current;
    if (player && typeof player.loadVideoById === 'function') {
      try {
        player.loadVideoById({ videoId: track.youtubeId, startSeconds: 0 });
        player.playVideo();
      } catch {}
    }
    
    // Generar automáticamente una playlist con recomendaciones
    // Solo si no hay una playlist existente o si es una canción diferente
    const shouldCreateAutoPlaylist = 
      playlist.length <= 1 || 
      !playlist.some(t => t.id === track.id) ||
      (currentTrack && currentTrack.id !== track.id);
    
    if (shouldCreateAutoPlaylist) {
      // Crear la playlist automática en segundo plano
      setTimeout(async () => {
        try {
          await createAutoPlaylist(track);
        } catch (error) {
          console.warn('Error al generar playlist automática:', error);
          // Si falla, al menos mantener la canción actual en la playlist
          setPlaylist([track]);
        }
      }, 500); // Pequeño delay para que la reproducción comience inmediatamente
    } else {
      // Si ya hay una playlist válida, solo actualizar la posición
      setPlaylist(prev => prev.length > 0 ? prev : [track]);
    }
    
    return true;
  };

  // Reproducir una pista cargando y lanzando el play en la instancia única de YouTube Player
  const playTrackWithPlayer = async (track: Track): Promise<boolean> => {
    if (!track.youtubeId) {
      setError('No se encontró ID de YouTube para esta canción');
      return false;
    }
    
    // Establecer la canción actual inmediatamente
    setCurrentTrack(track);
    setCurrentIndex(0);
    
    const player = youtubePlayerRef.current;
    
    if (!player) {
      setError('Reproductor no inicializado');
      return false;
    }
    
    try {
      await loadVideo(player, track.youtubeId);
      
      setIsPlaying(true);
      startTimeUpdates();
      
      // Generar automáticamente una playlist con recomendaciones
      // Solo si no hay una playlist existente o si es una canción diferente
      const shouldCreateAutoPlaylist = 
        playlist.length <= 1 || 
        !playlist.some(t => t.id === track.id) ||
        (currentTrack && currentTrack.id !== track.id);
      
      if (shouldCreateAutoPlaylist) {
        // Crear la playlist automática en segundo plano
        setTimeout(async () => {
          try {
            await createAutoPlaylist(track);
          } catch (error) {
            console.warn('Error al generar playlist automática:', error);
            // Si falla, al menos mantener la canción actual en la playlist
            setPlaylist([track]);
          }
        }, 500); // Pequeño delay para que la reproducción comience inmediatamente
      } else {
        // Si ya hay una playlist válida, solo actualizar la posición
        setPlaylist(prev => prev.length > 0 ? prev : [track]);
      }
      
      return true;
    } catch (error) {
      setError(`Error al reproducir: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  };

  // Reproducir una playlist
  const playPlaylist = async (tracks: Track[], startIndex: number = 0) => {
    if (tracks.length === 0) return;

    setPlaylist(tracks);
    setCurrentIndex(startIndex);

    const track = tracks[startIndex];
    await playTrack(track);
  };

  // Alternar reproducción/pausa de forma directa
  const togglePlay = () => {
    const player = youtubePlayerRef.current;
    if (!player || typeof player.getPlayerState !== 'function') return;
    if (player.getPlayerState() === window.YT.PlayerState.PLAYING) {
      player.pauseVideo();
          setIsPlaying(false);
          isPlayingRef.current = false;
        } else {
      player.playVideo();
          setIsPlaying(true);
          isPlayingRef.current = true;
          startTimeUpdates();
    }
  };

  // Modificar la implementación del control de tiempo entre llamadas
  // Evitar llamadas múltiples rápidas con una referencia mejor
  const nextTrackTimeRef = useRef<number>(0);

  // Simplificar nextTrack
  const nextTrack = async () => {
    const now = Date.now();
    const timeSinceLastCall = now - nextTrackTimeRef.current;

    if (timeSinceLastCall < 800) return;

    nextTrackTimeRef.current = now;

    try {
      if (nextTrackTimeoutRef.current) {
        clearTimeout(nextTrackTimeoutRef.current);
        nextTrackTimeoutRef.current = null;
      }

      if (!playlist || playlist.length === 0 || !currentTrack) {
        setError('No hay más canciones en cola. Genera una lista automática.');
        return;
      }

      const nextIndex = currentIndex + 1;

      if (nextIndex < playlist.length) {
        const nextTrackToPlay = playlist[nextIndex];
              setCurrentIndex(nextIndex);

        setTimeout(async () => {
          await playTrack(nextTrackToPlay);
        }, 100);
              } else {
        setError('Generando recomendaciones automáticas...');

        try {
          if (currentTrack) {
            await createAutoPlaylist(currentTrack);

            setTimeout(() => {
              try {
                if (playlist.length > 0) {
                setCurrentIndex(0);
                playTrack(playlist[0]);
                  setError('');
              } else {
                  setError('No se pudieron generar recomendaciones. Intenta con otra canción.');
                }
              } catch {
                setError('Error al reproducir canciones recomendadas.');
              }
            }, 1000);
          } else {
            setError('No hay canción actual para generar recomendaciones.');
          }
        } catch {
          setError('Error al generar lista automática. Inténtalo de nuevo.');
        }
      }
    } catch (error) {
      setError(`Error al reproducir siguiente canción: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Canción anterior
  const previousTrack = async () => {
    if (playlist.length <= 1 || currentIndex < 0) return;

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
    const handleCustomPlayTrack = (event: CustomEvent) => {
      if (event.detail) {
        const track = event.detail;
        
        // Verificar si el reproductor está disponible
        const playerAvailable = !!youtubePlayerRef.current;
        
        if (track.youtubeId && playerAvailable) {
          playTrackWithPlayer(track);
        } else {
          playTrack(track);
        }
      }
    };

    const handleCreatePlaylist = (event: CustomEvent) => {
      if (event.detail) {
        if (event.detail.title) {
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

          setTimeout(() => {
            createAutoPlaylist(track).catch(() => {});
          }, 500);
        }
      }
    };

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
      try {
        const currentTimeFromPlayer = youtubePlayerRef.current.getCurrentTime();
        setCurrentTime(currentTimeFromPlayer);
      } catch {};
    }
  }, [isPlaying]);

  // Actualizar duración cuando el video comienza a reproducirse
  useEffect(() => {
    if (isPlaying && youtubePlayerRef.current && youtubePlayerRef.current.getDuration) {
      const updateDuration = () => {
        try {
          const videoDuration = youtubePlayerRef.current.getDuration();
          if (videoDuration && videoDuration > 0) {
            setDuration(videoDuration);
            return true;
          }
        } catch {};
        return false;
      };

      if (!updateDuration()) {
        let attempts = 0;
        const maxAttempts = 5;
        const durationCheckInterval = setInterval(() => {
          attempts++;
          if (updateDuration() || attempts >= maxAttempts) {
            clearInterval(durationCheckInterval);
          }
        }, 500);

        return () => clearInterval(durationCheckInterval);
      }
    }
  }, [isPlaying, currentTrack]);

  // Función para generar automáticamente la playlist
  const createAutoPlaylist = async (track: Track): Promise<void> => {
    try {
      if (!track || !track.title) {
        setError('No se pudo generar lista automática: información de canción incompleta.');
        return;
      }

      track.cover = getValidImageUrl(track.cover);
      track.albumCover = getValidImageUrl(track.albumCover);

      let recommendedTracks: Track[] = [];
      let errors: string[] = [];

      try {
        let params = new URLSearchParams();
        const seed_artist = track.artist || 'unknown';
        const seed_track = track.title;
        const limit = 25;

        if (seed_artist !== 'unknown') {
          params.append('seed_artist', seed_artist);
        }
        if (seed_track) {
          params.append('seed_track', seed_track);
        }
        params.append('limit', String(limit));

        const { pythonApiUrl } = getAPIConfig();
        
        let apiUrl = '';
        
        if (pythonApiUrl) {
          const recommendationsEndpoint = `${pythonApiUrl}/api/recommendations`;
          apiUrl = `${recommendationsEndpoint}?${params.toString()}`;
        } else {
          apiUrl = `/api/user/recommendations?${params.toString()}`;
        }

        let response: Response | null = null;
        let retryCount = 0;
        const maxRetries = 3;

        const controller = new AbortController();
        let timeoutId: NodeJS.Timeout | null = setTimeout(() => controller.abort(), 15000);

        try {
          while (retryCount < maxRetries && !response) {
            try {
              if (retryCount > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
              }

              response = await fetch(apiUrl, {
                signal: controller.signal,
                method: 'GET',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                  'Cache-Control': 'no-cache',
                  'x-demo-mode': getAPIConfig().demoMode ? 'true' : 'false'
                }
              });
            } catch {
              retryCount++;
              if (retryCount >= maxRetries) {
                throw new Error('Max retries reached');
              }
            }
          }

          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }

          if (response && response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const data = await response.json();

              if (data && Array.isArray(data) && data.length > 0) {
                console.log('[API-DATA] Datos completos de la API de recomendaciones:', JSON.stringify(data, null, 2));
                
                // Procesar las recomendaciones directamente (ya vienen con videoId válido)
                const processedTracks = data.slice(0, 20).map((item: any, index: number): AppTrack | null => {
                  try {
                    const artist = item.artist || 'Artista Desconocido';
                    const title = item.title || 'Sin título';
                    
                    // El campo 'id' de la API de Python ya contiene el videoId válido
                    const youtubeId = item.id || item.youtubeId;
                    
                    // Solo incluir canciones que tengan youtubeId válido
                    if (!youtubeId || youtubeId === 'undefined' || youtubeId === '') {
                      return null;
                    }

                    // Procesar duración - priorizar duration_text (formato MM:SS) que es más confiable
                    let duration = 180; // Duración por defecto: 3 minutos
                    
                    // Función auxiliar para convertir formato MM:SS a segundos
                    const parseTimeString = (timeStr: string): number => {
                      if (!timeStr || typeof timeStr !== 'string') return 0;
                      
                      const parts = timeStr.split(':');
                      if (parts.length === 2) {
                        // Formato MM:SS
                        const minutes = parseInt(parts[0], 10);
                        const seconds = parseInt(parts[1], 10);
                        if (!isNaN(minutes) && !isNaN(seconds)) {
                          return minutes * 60 + seconds;
                        }
                      } else if (parts.length === 3) {
                        // Formato HH:MM:SS
                        const hours = parseInt(parts[0], 10);
                        const minutes = parseInt(parts[1], 10);
                        const seconds = parseInt(parts[2], 10);
                        if (!isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
                          return hours * 3600 + minutes * 60 + seconds;
                        }
                      }
                      return 0;
                    };
                    
                    // PRIORIDAD 1: duration_text (formato MM:SS de la API de Python)
                    if (item.duration_text && typeof item.duration_text === 'string' && item.duration_text.includes(':')) {
                      const parsedDuration = parseTimeString(item.duration_text);
                      if (parsedDuration > 0) {
                        duration = parsedDuration;
                      }
                    }
                    // PRIORIDAD 2: duration como string con formato MM:SS
                    else if (item.duration && typeof item.duration === 'string' && item.duration.includes(':')) {
                      const parsedDuration = parseTimeString(item.duration);
                      if (parsedDuration > 0) {
                        duration = parsedDuration;
                      }
                    }
                    // PRIORIDAD 3: duration como número (segundos)
                    else if (item.duration && item.duration !== "" && !isNaN(Number(item.duration))) {
                      const numDuration = Number(item.duration);
                      // Si la duración está en milisegundos (mayor a 1000), convertir a segundos
                      duration = numDuration > 1000 ? Math.floor(numDuration / 1000) : numDuration;
                    }
                    // PRIORIDAD 4: duration_ms (Spotify)
                    else if (item.duration_ms && !isNaN(Number(item.duration_ms))) {
                      duration = Math.floor(Number(item.duration_ms) / 1000);
                    }
                    // PRIORIDAD 5: length (otros APIs)
                    else if (item.length && !isNaN(Number(item.length))) {
                      const numLength = Number(item.length);
                      duration = numLength > 1000 ? Math.floor(numLength / 1000) : numLength;
                    }
                    
                    // Asegurar que la duración esté en un rango razonable (30 segundos a 20 minutos)
                    if (duration < 30) duration = 180;
                    if (duration > 1200) duration = 180;
                    
                    // Log de debug mejorado para verificar el procesamiento de duración
                    console.log(`[DURATION-DEBUG] Track: "${title}" | duration_text: "${item.duration_text}" | duration: ${JSON.stringify(item.duration)} | Final: ${duration}s`);



                    return {
                      id: youtubeId,
                      title: title,
                      artist: artist,
                      album: item.album || 'Álbum Desconocido',
                      albumCover: getValidImageUrl(item.albumCover || item.cover || item.thumbnail),
                      cover: getValidImageUrl(item.cover || item.thumbnail),
                      duration: duration,
                      youtubeId: youtubeId,
                      spotifyId: item.spotifyId,
                      source: item.source || 'python-recommendation',
                      artistId: item.artistId,
                      albumId: item.albumId
                    };
                  } catch (error) {
                    return null;
                  }
                });
                
                // Filtrar tracks nulos y tomar solo los que tienen youtubeId válido
                recommendedTracks = processedTracks.filter((track): track is AppTrack => track !== null);
              }
            }
          }
        } finally {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
        }
      } catch {
        errors.push('Error en la API de recomendaciones');
      }

      // Solo usar fallbacks si no hay recomendaciones válidas en absoluto
      if (recommendedTracks.length === 0) {
        
        const fallbackTracks: AppTrack[] = [];
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
            cover: getValidImageUrl(track.cover),
            albumCover: getValidImageUrl(track.albumCover || track.cover),
            duration: 180 + (i * 20),
            spotifyId: undefined,
            youtubeId: undefined,
            source: 'fallback'
          });
        }
        recommendedTracks = [...recommendedTracks, ...fallbackTracks];
      }

      if (recommendedTracks.length > 0) {
        try {
          let newPlaylist: AppTrack[] = [track];

          recommendedTracks.forEach((recTrack: AppTrack) => {
            if (recTrack && recTrack.title) {
              if (!recTrack.id) {
                recTrack.id = `gen_${recTrack.title.substring(0, 10)}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
              }
              if (!newPlaylist.some(t => t.id === recTrack.id)) {
                recTrack.cover = getValidImageUrl(recTrack.cover);
                recTrack.albumCover = getValidImageUrl(recTrack.albumCover || recTrack.cover);

                newPlaylist.push(recTrack);
              }
            }
          });

          setPlaylist(newPlaylist);
          setCurrentIndex(0);
          setLastPlaylistUpdate(Date.now());
          setError('');
          return;
        } catch {
          setError('Error al crear lista automática');
          return;
        }
      } else {
        setError('No se pudieron generar recomendaciones automáticas. Por favor, intenta con otra canción.');
        return;
      }
    } catch {
      setError('Error al generar la lista automática. Por favor, intenta de nuevo más tarde.');
      return;
    }
  };

  // Actualizar getYoutubeVideoId
  const getYoutubeVideoId = async (title: string, artist: string): Promise<string | null> => {
    try {
      const queryParams = new URLSearchParams({
        title,
        artist
      }).toString();

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

      if (data.videoId) {
        return data.videoId;
      }

      if (data.message && !data.error) {
        return null;
      }

      if (data.error) {
        setError(`Error al buscar video: ${data.message || data.error}`);
      }

      return null;
    } catch {
      return null;
    }
  };

  // Actualizar fallbackFindVideo
  const fallbackFindVideo = async (track: Track): Promise<boolean> => {
    try {
      const searchQuery = `${track.title} ${track.artist}`;

      const response = await fetch(`/api/youtube/search?query=${encodeURIComponent(searchQuery)}&filter=songs&limit=1`);

      if (!response.ok) {
        throw new Error(`Error en la búsqueda: ${response.status}`);
      }

      const data = await response.json();

      if (data.results && data.results.length > 0 && data.results[0].videoId) {
        const videoId = data.results[0].videoId;

        track.youtubeId = videoId;
        setCurrentTrack({ ...track });

        if (youtubePlayerRef.current) {
          await playTrackWithPlayer(track);
          return true;
        }
          } else {
        if (data.error) {
          setError(`Error: ${data.message || 'No se pudo encontrar la canción'}`);
        }
      }

      return false;
    } catch {
      return false;
    }
  };

  // Función para cargar un video en el reproductor
  const loadVideo = async (player: any, videoId: string): Promise<void> => {
      if (!player || typeof player.loadVideoById !== 'function') {
      throw new Error('Reproductor no disponible o método loadVideoById no encontrado');
      }

    try {
      player.loadVideoById({
        videoId: videoId,
        startSeconds: 0,
        suggestedQuality: 'default'
      });

      setCurrentTime(0);

      let checkAttempts = 0;
      const maxAttempts = 5;

        const checkState = () => {
        try {
          if (typeof player.getPlayerState === 'function') {
            const state = player.getPlayerState();

            if (state === 1 || state === 3) {
              if (typeof player.getDuration === 'function') {
          const videoDuration = player.getDuration();
          if (videoDuration && videoDuration > 0) {
            setDuration(videoDuration);
                  startTimeUpdates();

                  if (state === 1 && !isPlaying) {
                    setIsPlaying(true);
                    isPlayingRef.current = true;
                  }

                  return;
                }
              }
            }
          }

          checkAttempts++;

          if (checkAttempts < maxAttempts) {
            setTimeout(checkState, 500);
          } else {
            if (typeof player.playVideo === 'function') {
              player.playVideo();
              setIsPlaying(true);
              isPlayingRef.current = true;
            }
          }
        } catch {};
      };

      setTimeout(checkState, 500);
    } catch {
      throw new Error('Error al cargar video');
    }
  };

  // Función helper para encontrar y establecer el ID de YouTube de una canción
  const findAndSetYoutubeId = async (track: Track): Promise<boolean> => {
    try {
      const fallbackSuccess = await fallbackFindVideo(track);
      if (fallbackSuccess) {
        return true;
      }

      try {
        const videoId = await getYoutubeVideoId(track.title, track.artist);
        if (videoId) {
          track.youtubeId = videoId;
          setCurrentTrack({ ...track });
          return true;
        }
      } catch {};

      return false;
    } catch {
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
    if (!url || url === '' || failedCoverCache.has(url)) {
      return PLACEHOLDER_ALBUM;
    }

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
      setOriginalPlaylist([...playlist]);

      if (currentTrack && playlist.length > 1) {
        const currentIdx = playlist.findIndex(track =>
          track.id === currentTrack.id);

        if (currentIdx !== -1) {
          const currentSong = playlist[currentIdx];
          const songsToShuffle = [
            ...playlist.slice(0, currentIdx),
            ...playlist.slice(currentIdx + 1)
          ];

          const shuffled = shuffleArray(songsToShuffle);

          setPlaylist([currentSong, ...shuffled]);
        } else {
          setPlaylist(shuffleArray([...playlist]));
        }
      } else {
        setPlaylist(shuffleArray([...playlist]));
      }
    } else {
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
    player,
    currentTrack,
    playlist,
    isPlaying,
    volume,
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

  // Estado para el reproductor de fallback (HTML5 Audio)
  const [fallbackAudioPlayer, setFallbackAudioPlayer] = useState<HTMLAudioElement | null>(null);
  const fallbackPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [usingFallbackPlayer, setUsingFallbackPlayer] = useState<boolean>(false);

  // Inicializar el reproductor de audio de fallback
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audioElement = new Audio();
      audioElement.preload = 'auto';
      audioElement.volume = volume;

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
        nextTrack();
      });

      audioElement.addEventListener('pause', () => {
        setIsPlaying(false);
      });

      audioElement.addEventListener('play', () => {
        setIsPlaying(true);
      });

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
      return false;
    }

    try {
      setUsingFallbackPlayer(true);

      if (track.audioUrl) {
        fallbackPlayerRef.current.src = track.audioUrl;
        fallbackPlayerRef.current.play();
        setIsPlaying(true);
        return true;
      }

      if (track.youtubeId) {
        try {
          const response = await fetch(`/api/audio-proxy?videoId=${track.youtubeId}`);

          if (response.ok) {
            const data = await response.json();
            if (data.audioUrl) {
              fallbackPlayerRef.current.src = data.audioUrl;
              fallbackPlayerRef.current.play();
              setIsPlaying(true);
              return true;
            }
          }
        } catch {};
        }

      return false;
    } catch {
      return false;
    }
  };

  // Monitor de estado del reproductor (agregando esta nueva verificación)
  useEffect(() => {
    if (!currentTrack) return;

    const stateCheckInterval = setInterval(() => {
      if (!youtubePlayerRef.current) return;

      try {
        if (typeof youtubePlayerRef.current.getPlayerState === 'function') {
          const playerState = youtubePlayerRef.current.getPlayerState();
          const isActuallyPlaying = playerState === 1;

          if (isActuallyPlaying !== isPlaying) {
            setIsPlaying(isActuallyPlaying);
            isPlayingRef.current = isActuallyPlaying;

            if (isActuallyPlaying && !isPlaying) {
              startTimeUpdates();
            }
          }

          // Removido: no actualizar currentTime aquí para evitar conflictos con el timer principal

          if (duration <= 0 && typeof youtubePlayerRef.current.getDuration === 'function') {
            const videoDuration = youtubePlayerRef.current.getDuration();
            if (videoDuration && videoDuration > 0) {
              setDuration(videoDuration);
            }
          }
        }
      } catch {};
    }, 2000);

    return () => {
      clearInterval(stateCheckInterval);
    };
  }, [currentTrack, isPlaying, currentTime, duration]);

  // Hook para reproducción en segundo plano
  const backgroundPlayback = useBackgroundPlayback({
    onVisibilityChange: (isVisible) => {
      console.log(`[PlayerContext] Página ${isVisible ? 'visible' : 'oculta'}`);
      
      // Si la página se vuelve visible y estaba reproduciendo, asegurar que siga reproduciendo
      if (isVisible && isPlaying && youtubePlayerRef.current) {
        setTimeout(() => {
          try {
            if (typeof youtubePlayerRef.current.getPlayerState === 'function') {
              const state = youtubePlayerRef.current.getPlayerState();
              if (state === 2) { // Si está pausado, reanudar
                console.log('[PlayerContext] Reanudando reproducción al volver a la página');
                youtubePlayerRef.current.playVideo();
              }
            }
          } catch (error) {
            console.warn('[PlayerContext] Error al reanudar reproducción:', error);
          }
        }, 300);
      }
    },
    preventPause: true,
    enableWakeLock: true
  });

  // Actualizar el estado de reproducción en el hook de background playback
  useEffect(() => {
    backgroundPlayback.setIsPlaying(isPlaying);
  }, [isPlaying, backgroundPlayback]);

  // Actualizar la referencia del player en el hook de background playback
  useEffect(() => {
    if (youtubePlayerRef.current) {
      backgroundPlayback.setPlayerRef(youtubePlayerRef.current);
    }
  }, [youtubePlayerRef.current, backgroundPlayback]);

  // Hook para Media Session (controles nativos en móviles)
  const mediaSession = useMediaSession(currentTrack, isPlaying, {
    onPlay: () => {
      console.log('[MediaSession] Comando: Play');
      if (youtubePlayerRef.current && typeof youtubePlayerRef.current.playVideo === 'function') {
        youtubePlayerRef.current.playVideo();
        setIsPlaying(true);
      }
    },
    onPause: () => {
      console.log('[MediaSession] Comando: Pause');
      if (youtubePlayerRef.current && typeof youtubePlayerRef.current.pauseVideo === 'function') {
        youtubePlayerRef.current.pauseVideo();
        setIsPlaying(false);
      }
    },
    onPreviousTrack: () => {
      console.log('[MediaSession] Comando: Previous Track');
      previousTrack();
    },
    onNextTrack: () => {
      console.log('[MediaSession] Comando: Next Track');
      nextTrack();
    },
    onSeekTo: (time: number) => {
      console.log('[MediaSession] Comando: Seek To', time);
      if (time < 0) {
        // Seek backward (tiempo relativo)
        const newTime = Math.max(0, currentTime + time);
        seekTo(newTime);
      } else if (time <= duration) {
        // Seek to absolute position
        seekTo(time);
      } else {
        // Seek forward (tiempo relativo)
        const newTime = Math.min(duration, currentTime + time);
        seekTo(newTime);
      }
    }
  });

  // Actualizar posición en Media Session cuando cambie el tiempo
  useEffect(() => {
    if (duration > 0 && currentTime >= 0) {
      mediaSession.updatePositionState(duration, currentTime);
    }
  }, [currentTime, duration, mediaSession]);

  return (
    <PlayerContext.Provider value={value}>
      {/* Componente de YouTube para reproducir el video actual */}
      {currentTrack?.youtubeId && (
        <YouTubePlayer
          videoId={currentTrack.youtubeId}
          onReady={player => {
            youtubePlayerRef.current = player;
            setYoutubePlayer(player);
            setIsPlaying(true);
            startTimeUpdates();
          }}
        />
      )}
      {children}
    </PlayerContext.Provider>
  );
};

export default PlayerContext;
