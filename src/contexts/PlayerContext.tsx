'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { getLyrics, parseSyncedLyrics } from '@/services/lyricsService';
import { getRecommendedTracks, getArtistTopTracks, searchTracks } from '@/services/spotify';
// Importar las nuevas funciones del sistema multi-fuente
import { getSimilarTracks, getArtistTopTracks as getMultiArtistTracks, getGeneralRecommendations } from '@/services/recommendations';
// Importar el tipo Track de types.ts
import { Track as AppTrack, LyricLine as AppLyricLine } from '@/types/types';
// Importar YouTube
import { youtube } from '@/services/youtube';

// Interfaces para la API de YouTube
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | null;
  }
}

// Re-exportar el tipo Track desde types.ts para asegurar compatibilidad
export type Track = AppTrack;
export type LyricLine = AppLyricLine;

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
  playTrack: (track: Track) => void;
  playPlaylist: (tracks: Track[], startIndex?: number) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  setVolume: (volume: number) => void;
  seekTo: (time: number) => void;
  addToQueue: (track: Track) => void;
  createAutoPlaylist: (track: Track) => Promise<Track[]>;
  resetYouTubeQuota: () => void;
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
  playTrack: () => {},
  playPlaylist: () => {},
  togglePlay: () => {},
  nextTrack: () => {},
  previousTrack: () => {},
  setVolume: () => {},
  seekTo: () => {},
  addToQueue: () => {},
  createAutoPlaylist: async () => [],
  resetYouTubeQuota: () => {},
};

// Crear el contexto
const PlayerContext = createContext<PlayerContextType>(defaultContextValue);

// Hook personalizado para usar el contexto
export const usePlayer = () => useContext(PlayerContext);

interface PlayerProviderProps {
  children: ReactNode;
}

// Proveedor del contexto
export const PlayerProvider: React.FC<PlayerProviderProps> = ({ children }) => {
  // Referencias y estados para el reproductor
  const youtubePlayerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [youtubePlayer, setYoutubePlayer] = useState<any>(null);
  const [isYoutubeReady, setIsYoutubeReady] = useState<boolean>(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState<number>(70);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [lastYouTubeId, setLastYouTubeId] = useState<string | null>(null);
  const playerCreationAttempts = useRef(0);
  const playerCreationInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Estado para la lista de reproducción
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [pendingTrack, setPendingTrack] = useState<Track | null>(null);

  // Estado de la letra de la canción
  const [lyrics, setLyrics] = useState<{
    plain: string | null;
    synced: LyricLine[];
    isLoading: boolean;
  }>({
    plain: null,
    synced: [],
    isLoading: false,
  });

  // Referencia al timeout de inicialización del reproductor
  const playerInitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Estado para la letra actual
  const [currentLyricIndex, setCurrentLyricIndex] = useState<number>(-1);

  // Referencia para el tiempo del último intento de inicialización
  const playerInitTimeRef = useRef<number>(0);

  // Mantener un contador de intentos fallidos
  const failedYouTubeAttempts = useRef<Set<string>>(new Set());
  const maxConsecutiveSkips = useRef<number>(0);

  const [isSearchingLyrics, setIsSearchingLyrics] = useState<boolean>(false);

  // Referencias para caché y estado de cuota
  const youtubeIdCacheRef = useRef<Map<string, string>>(new Map());
  const youtubeQuotaExceededRef = useRef<boolean>(false);

  /**
   * Verifica si la API de YouTube está disponible
   */
  const isYouTubeAPILoaded = () => {
    if (typeof window === 'undefined') return false;
    
    try {
      // Verificar si el objeto YT está disponible en window
      return (
        window.YT !== undefined &&
        typeof window.YT === 'object' &&
        typeof window.YT.Player === 'function'
      );
    } catch (error) {
      console.error('Error al verificar YT API:', error);
      return false;
    }
  };

  // Función para reiniciar la cuota de YouTube
  const resetYouTubeQuota = () => {
    try {
      // Verificar si existe el método en la API
      if (typeof youtube.resetYouTubeQuota === 'function') {
        youtube.resetYouTubeQuota();
        console.log('PlayerContext: Cuota de YouTube reiniciada');
        youtubeQuotaExceededRef.current = false;
        console.log('PlayerContext: Estado de cuota local reiniciado');
        return true;
    } else {
        console.warn('PlayerContext: Método resetYouTubeQuota no disponible');
        return false;
      }
    } catch (error) {
      console.error('PlayerContext: Error al reiniciar cuota de YouTube', error);
      return false;
    }
  };

  // Función para crear el reproductor de YouTube
  const createYouTubePlayer = useCallback(() => {
    if (!isYouTubeAPILoaded()) {
      console.warn('[PlayerContext] ⚠️ YouTube API no está cargada, imposible crear el reproductor');
      return false;
    }

    try {
      // Verificar si ya existe un reproductor
      if (youtubePlayerRef.current) {
        console.log('[PlayerContext] ℹ️ Ya existe un reproductor YouTube, no se crea uno nuevo');
        return true;
      }
      
      console.log('[PlayerContext] 🔄 Intentando crear reproductor de YouTube', {
        apiLoaded: !!window.YT,
        ytPlayerFn: typeof window.YT?.Player
      });
      
      // Verificar si existe el elemento container
      const containerId = 'youtube-player';
      let playerElement = document.getElementById(containerId);
      
      if (!playerElement) {
        console.log('[PlayerContext] 📦 Creando elemento contenedor para YouTube');
        // Crear el elemento
      playerElement = document.createElement('div');
        playerElement.id = containerId;
      
        // Añadirlo al DOM
        if (playerContainerRef.current) {
          playerContainerRef.current.appendChild(playerElement);
          console.log('[PlayerContext] ✅ Contenedor añadido con éxito a través de la referencia');
    } else {
          // Si no existe la referencia, crear un div auxiliar
          const auxContainer = document.createElement('div');
          auxContainer.style.position = 'absolute';
          auxContainer.style.width = '1px';
          auxContainer.style.height = '1px';
          auxContainer.style.overflow = 'hidden';
          auxContainer.id = 'youtube-player-container';
          document.body.appendChild(auxContainer);
          auxContainer.appendChild(playerElement);
          console.log('[PlayerContext] ⚠️ No hay contenedor de referencia, creando un contenedor auxiliar');
        }
      } else {
        console.log('[PlayerContext] ℹ️ El elemento contenedor para YouTube ya existe:', playerElement);
      }
      
      // Crear el reproductor
      console.log('[PlayerContext] 🚀 Creando instancia de reproductor de YouTube con:', {
        YT: !!window.YT,
        Player: !!window.YT?.Player,
        containerId
      });
      
      // Crear opciones del player
      const playerOptions = {
        height: '0',
        width: '0',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          enablejsapi: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          origin: window.location.origin,
          host: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            console.log('[PlayerContext] 🔹 Reproductor listo (desde createYouTubePlayer)');
            console.log('[PlayerContext] 🔹 Objeto event:', {
              target: !!event.target,
              hasSetVolume: !!event.target?.setVolume,
              hasPlayVideo: !!event.target?.playVideo,
              hasLoadVideoById: !!event.target?.loadVideoById,
              pendingTrack: !!pendingTrack
            });
            
            setPlayerReady(true);
            if (event.target && event.target.setVolume) {
              event.target.setVolume(volume);
              console.log('[PlayerContext] 🔹 Volumen inicial establecido:', volume);
            }
            
            // Reproducir la pista pendiente si hay alguna
            if (pendingTrack && pendingTrack.youtubeId) {
              console.log('[PlayerContext] 🔄 Reproduciendo pista pendiente desde onReady:', pendingTrack.title);
              setTimeout(() => {
                if (event.target && event.target.loadVideoById) {
        event.target.loadVideoById({
                    videoId: pendingTrack.youtubeId,
                    startSeconds: 0
                  });
                  console.log('[PlayerContext] ▶️ Video cargado:', pendingTrack.youtubeId);
                  
                  // Activar reproducción después de cargar
                  setTimeout(() => {
                    if (event.target && event.target.playVideo) {
                      event.target.playVideo();
                      console.log('[PlayerContext] ▶️ Reproducción iniciada para pista pendiente');
                      setIsPlaying(true);
                    }
                  }, 500);
                }
              }, 500);
            }
          },
          onStateChange: (event: any) => {
            handlePlayerStateChange(event);
          },
          onError: (event: any) => {
            console.error('[PlayerContext] ❌ Error en reproductor YouTube. Código:', event?.data);
            setIsPlaying(false);
          },
        },
      };
      
      // Crear la instancia
      try {
        youtubePlayerRef.current = new window.YT.Player(containerId, playerOptions);
        console.log('[PlayerContext] ✅ Reproductor de YouTube creado correctamente');
        
        // Verificar si se creó correctamente después de un breve retraso
        setTimeout(() => {
          if (!youtubePlayerRef.current || typeof youtubePlayerRef.current.getVideoLoadedFraction !== 'function') {
            console.warn('[PlayerContext] ⚠️ El reproductor no parece haberse creado correctamente, reintentando...');
            youtubePlayerRef.current = null; // Limpiar la referencia fallida
            createYouTubePlayer(); // Intentar nuevamente
          }
        }, 2000);
        
        return true;
      } catch (err) {
        console.error('[PlayerContext] ❌ Error al instanciar el reproductor:', err);
        return false;
      }
    } catch (error) {
      console.error('[PlayerContext] ❌ Error al crear el reproductor de YouTube:', error);
      return false;
    }
  }, [volume, pendingTrack, isYouTubeAPILoaded]);
  
  // Handler for player state changes
  const handlePlayerStateChange = (event: any) => {
    if (!event || !event.target) return;
    
    try {
      const state = event.data;
      const stateMap: {[key: number]: string} = {
        '-1': 'UNSTARTED',
        0: 'ENDED',
        1: 'PLAYING',
        2: 'PAUSED',
        3: 'BUFFERING',
        5: 'CUED'
      };
      
      console.log(`[PlayerContext] 🔄 Estado del reproductor: ${state} (${stateMap[state] || 'DESCONOCIDO'})`);
      
      if (state === window.YT?.PlayerState?.PLAYING) {
        setIsPlaying(true);
        
        // Actualizar duración si es necesario
        if (typeof event.target.getDuration === 'function') {
          const newDuration = event.target.getDuration();
          if (newDuration && newDuration > 0) {
            setDuration(newDuration);
            console.log('[PlayerContext] ⏱️ Duración actualizada:', newDuration);
          }
        }
        
        // Actualizar tiempo actual
        if (typeof event.target.getCurrentTime === 'function') {
          const newCurrentTime = event.target.getCurrentTime();
          if (typeof newCurrentTime === 'number' && !isNaN(newCurrentTime)) {
            setCurrentTime(newCurrentTime);
          }
        }
      } 
      else if (state === window.YT?.PlayerState?.PAUSED) {
        setIsPlaying(false);
        console.log('[PlayerContext] ⏸️ Reproducción pausada');
      }
      else if (state === window.YT?.PlayerState?.ENDED) {
        console.log('[PlayerContext] 🔚 Pista finalizada, reproduciendo siguiente pista');
        setIsPlaying(false);
        setCurrentTime(0);
        
        // Emitir un evento para cambiar a la siguiente pista
        // Esto evita referencias circulares
        window.dispatchEvent(new CustomEvent('youtube-player-ended'));
      }
      else if (state === window.YT?.PlayerState?.BUFFERING) {
        console.log('[PlayerContext] 🔄 Video en buffer');
      }
      else if (state === window.YT?.PlayerState?.UNSTARTED) {
        console.log('[PlayerContext] ⚠️ Video no iniciado');
      }
    } catch (error) {
      console.error('[PlayerContext] ❌ Error al procesar evento de cambio de estado:', error);
    }
  };

  // Función para formatear el tiempo de reproducción
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Función para controlar reproducción/pausa
  const togglePlay = useCallback(() => {
    try {
      if (!youtubePlayerRef.current) {
        console.warn('PlayerContext: No hay reproductor disponible');
        setIsPlaying(false);
        return;
      }
      
      if (isPlaying) {
        // Pausar
        if (youtubePlayerRef.current.pauseVideo) {
          youtubePlayerRef.current.pauseVideo();
        }
        setIsPlaying(false);
    } else {
        // Reproducir
        if (currentTrack && youtubePlayerRef.current.playVideo) {
          youtubePlayerRef.current.playVideo();
          setIsPlaying(true);
        } else {
          console.warn('PlayerContext: No hay pista actual para reproducir');
        }
      }
    } catch (error) {
      console.error('PlayerContext: Error al alternar reproducción', error);
      setIsPlaying(false);
    }
  }, [isPlaying, currentTrack]);

  // Función para controlar el volumen
  const changeVolume = useCallback((newVolume: number) => {
    try {
      if (!youtubePlayerRef.current || !youtubePlayerRef.current.setVolume) {
        console.warn('PlayerContext: No hay reproductor disponible para cambiar volumen');
        return;
      }
      
      // Asegurar que el volumen esté entre 0 y 100
      const clampedVolume = Math.max(0, Math.min(100, newVolume));
      
      // Establecer el volumen en el reproductor
      youtubePlayerRef.current.setVolume(clampedVolume);
      
      // Actualizar el estado del volumen
      setVolume(clampedVolume);
      
      // Si el volumen > 0, no está silenciado
      if (clampedVolume > 0) {
        setIsMuted(false);
      } else {
        setIsMuted(true);
      }
    } catch (error) {
      console.error('PlayerContext: Error al cambiar volumen', error);
    }
  }, []);

  // Función para controlar el silencio
  const toggleMute = useCallback(() => {
    try {
      if (!youtubePlayerRef.current) {
        console.warn('PlayerContext: No hay reproductor disponible para silenciar');
        return;
      }
      
      if (isMuted) {
        // Restaurar volumen anterior
        if (youtubePlayerRef.current.setVolume) {
          youtubePlayerRef.current.setVolume(volume > 0 ? volume : 50);
        }
        setIsMuted(false);
      } else {
        // Silenciar
        if (youtubePlayerRef.current.setVolume) {
          youtubePlayerRef.current.setVolume(0);
        }
        setIsMuted(true);
        }
      } catch (error) {
      console.error('PlayerContext: Error al silenciar', error);
    }
  }, [isMuted, volume]);

  // Función para buscar una posición específica en la pista
  const seekTo = useCallback((time: number) => {
    try {
      if (!youtubePlayerRef.current || !youtubePlayerRef.current.seekTo) {
        console.warn('PlayerContext: No hay reproductor disponible para buscar tiempo');
        return;
      }
      
      // Asegurar que el tiempo esté dentro de los límites
      const clampedTime = Math.max(0, Math.min(duration, time));
      
      // Buscar la posición
      youtubePlayerRef.current.seekTo(clampedTime, true);
      
      // Actualizar el tiempo actual
      setCurrentTime(clampedTime);
    } catch (error) {
      console.error('PlayerContext: Error al buscar tiempo', error);
    }
  }, [duration]);

  /**
   * Función para buscar letras de una canción con manejo silencioso de errores
   */
  const fetchLyrics = useCallback(async (track: Track) => {
    if (!track || (!track.title && !track.artist)) {
      // Silenciar errores básicos
      return;
    }
    
    try {
      // Registrar solo si estamos en modo de desarrollo y no en producción
      const isDevMode = process.env.NODE_ENV === 'development';
      const logDebug = (message: string, ...args: any[]) => {
        if (isDevMode && false) { // Establecer a true para ver logs durante desarrollo
          console.log(message, ...args);
        }
      };
      
      logDebug('[PlayerContext] 🔍 Buscando letras para:', track.title, track.artist);
      setIsSearchingLyrics(true);
      
      // Crear una clave única para esta canción
      const lyricsKey = `lyrics-${track.id || `${track.title}-${track.artist}`}`;
      const errorKey = `lyrics-error-${track.id || `${track.title}-${track.artist}`}`;
      
      // Verificar si ya tenemos letras en caché local
      const cachedLyrics = localStorage.getItem(lyricsKey);
      if (cachedLyrics) {
        try {
          const parsed = JSON.parse(cachedLyrics);
          logDebug('[PlayerContext] 📦 Usando letras desde caché local');
          setLyrics({
            plain: parsed.plain || null,
            synced: parsed.synced || [],
            isLoading: false
          });
          setIsSearchingLyrics(false);
          return;
        } catch (parseError) {
          // Error silencioso
          localStorage.removeItem(lyricsKey);
        }
      }
      
      // Verificar si ya intentamos buscar letras para esta canción y falló
      if (localStorage.getItem(errorKey)) {
        logDebug('[PlayerContext] ℹ️ Ya se intentó buscar letras para esta canción sin éxito');
        setLyrics({ plain: null, synced: [], isLoading: false });
        setIsSearchingLyrics(false);
        return;
      }
      
      // Construir los parámetros de búsqueda
      const searchParams = new URLSearchParams({
        track_name: track.title,
        artist_name: track.artist
      });
      
      // Añadir duración si está disponible
      if (track.duration) {
        searchParams.append('duration', track.duration.toString());
      }
      
      // Llamar a la API con captura silenciosa de errores
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(),.5000); // 5s timeout
      
      try {
        const response = await fetch(`/api/lyrics?${searchParams.toString()}`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          // Silenciar errores 404 y 400
          if (response.status === 404 || response.status === 400) {
            localStorage.setItem(errorKey, 'true');
          } 
          
          setLyrics({ plain: null, synced: [], isLoading: false });
          setIsSearchingLyrics(false);
          return;
        }
        
        const data = await response.json();
        
        if (data && (data.plainLyrics || data.syncedLyrics?.length > 0)) {
          logDebug('[PlayerContext] ✅ Letras encontradas');
          
          const lyricsData = {
            plain: data.plainLyrics || null,
            synced: data.syncedLyrics || [],
            isLoading: false
          };
          
          // Guardar en caché local
          try {
            localStorage.setItem(lyricsKey, JSON.stringify({
              plain: lyricsData.plain,
              synced: lyricsData.synced
            }));
            logDebug('[PlayerContext] 💾 Letras guardadas en caché local');
          } catch (cacheError) {
            // Error silencioso
          }
          
          setLyrics(lyricsData);
        } else {
          logDebug('[PlayerContext] ℹ️ No se encontraron letras');
          // Guardar el error en cache para no repetir
          localStorage.setItem(errorKey, 'true');
          setLyrics({ plain: null, synced: [], isLoading: false });
        }
      } catch (fetchError) {
        // Silenciar errores de tiempo de espera o red
        clearTimeout(timeoutId);
        localStorage.setItem(errorKey, 'true');
        setLyrics({ plain: null, synced: [], isLoading: false });
      }
    } catch (error) {
      // Silenciar cualquier error general
      setLyrics({ plain: null, synced: [], isLoading: false });
    } finally {
      setIsSearchingLyrics(false);
    }
  }, []);

  // Función para guardar la pista en el historial
  const saveToHistory = useCallback(async (track: Track) => {
    try {
      if (!track.id) {
        console.warn('[PlayerContext] ⚠️ No se puede guardar en historial sin ID de pista');
        return;
      }
      
      // Verificar que la pista tenga youtubeId
      if (!track.youtubeId) {
        console.error('[PlayerContext] ❌ La pista no tiene youtubeId', track);
        // Intentar guardar otros datos igual
      }
      
      // Preparar datos completos para el historial
      const historyData = {
        trackId: track.id,
        trackName: track.title,         // Cambiado de 'title' a 'trackName'
        artistName: track.artist,       // Cambiado de 'artist' a 'artistName'
        albumName: track.album || 'Unknown Album', // Cambiado de 'album' a 'albumName'
        albumCover: track.cover || track.albumCover || '', // Cambiado de 'cover' a 'albumCover'
        youtubeId: track.youtubeId,
        spotifyId: track.spotifyId,
        source: track.source || 'local',
        sourceData: track.sourceData || {}
      };
      
      console.log('[PlayerContext] 🔄 Guardando en historial:', historyData);
      
      const response = await fetch('/api/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(historyData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PlayerContext] ❌ Error al guardar en historial', errorText);
        
        // Intentar guardar localmente si falla el guardado en la API
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            const localHistory = JSON.parse(localStorage.getItem('localHistory') || '[]');
            localHistory.unshift(historyData);
            // Mantener solo los últimos 50 elementos para no saturar localStorage
            const trimmedHistory = localHistory.slice(0, 50);
            localStorage.setItem('localHistory', JSON.stringify(trimmedHistory));
            console.log('[PlayerContext] ✅ Historial guardado localmente como respaldo');
          } catch (e) {
            console.error('[PlayerContext] ❌ Error al guardar historial local:', e);
          }
        }
      } else {
        console.log('[PlayerContext] ✅ Historial guardado correctamente en la API');
      }
    } catch (error) {
      console.error('[PlayerContext] ❌ Error al guardar en historial', error);
    }
  }, []);
  
  /**
   * Función para buscar el ID de YouTube para una pista que no lo tiene
   */
  const findYoutubeIdForTrack = useCallback(async (track: Track): Promise<Track> => {
    // Si ya tiene youtubeId, devolverlo tal cual
    if (track.youtubeId) {
      return track;
    }
    
    // Verificar si tenemos este ID en caché
    const cacheKey = `${track.id || track.title}-${track.artist}`;
    if (youtubeIdCacheRef.current.has(cacheKey)) {
      console.log('[PlayerContext] 📦 Usando youtubeId desde caché para:', track.title);
      const cachedId = youtubeIdCacheRef.current.get(cacheKey);
      return { ...track, youtubeId: cachedId };
    }
    
    // Evitar búsquedas repetidas para la misma pista
    if (failedYouTubeAttempts.current.has(track.id)) {
      console.log('[PlayerContext] ⚠️ Ya intentamos buscar youtubeId para esta pista antes:', track.title);
      return track;
    }
    
    try {
      console.log('[PlayerContext] 🔍 Buscando youtubeId para:', track.title, track.artist);
      setIsSearchingLyrics(true);
      
      // Verificar si ya sabemos que la cuota está excedida
      if (youtubeQuotaExceededRef.current) {
        console.warn('[PlayerContext] ⚠️ Cuota de YouTube ya excedida, saltando búsqueda');
        setIsSearchingLyrics(false);
        return track;
      }
      
      // Estrategias de búsqueda en orden de prioridad
      const searchStrategies = [
        // 1. Búsqueda completa con título y artista (más específica)
        `${track.title} ${track.artist}`,
        
        // 2. Solo título y primera palabra del artista
        `${track.title} ${track.artist.split(' ')[0]}`,
        
        // 3. Sanitizar título y artista para remover paréntesis, feat, etc.
        `${sanitizeSearchText(track.title)} ${sanitizeSearchText(track.artist)}`,
        
        // 4. Solo título (menos específico, pero mayor probabilidad de éxito)
        `${track.title} audio`
      ];
      
      // Intentar cada estrategia de búsqueda en orden
      for (const searchQuery of searchStrategies) {
        console.log(`[PlayerContext] 🔍 Intentando búsqueda: "${searchQuery}"`);
        
        try {
          // Llamar a la API de YouTube para buscar el video
          const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery)}&limit=1`);
          
          if (!response.ok) {
            const errorData = await response.json();
            
            // Detectar si es un error de límite de cuota
            if (response.status === 429 || 
                errorData?.error?.includes('quota') || 
                errorData?.details?.includes('quota')) {
              console.warn('[PlayerContext] ⚠️ Límite de cuota de YouTube alcanzado');
              youtubeQuotaExceededRef.current = true;
              break;
            }
            
            console.warn(`[PlayerContext] ⚠️ Búsqueda fallida: ${response.statusText}`);
            continue; // Probar con la siguiente estrategia
          }
          
          const data = await response.json();
          
          if (data && data.items && data.items.length > 0) {
            const videoId = data.items[0].id.videoId;
            console.log(`[PlayerContext] ✅ youtubeId encontrado con estrategia "${searchQuery}": ${videoId}`);
            
            // Guardar en caché para futuras referencias
            youtubeIdCacheRef.current.set(cacheKey, videoId);
            
            // Crear una nueva pista con el youtubeId encontrado
            const updatedTrack = {
              ...track,
              youtubeId: videoId
            };
            
            // Actualizar la pista en la playlist
            setPlaylist(prevPlaylist => prevPlaylist.map((p: Track) => 
              p.id === track.id ? updatedTrack : p
            ));
            
            setIsSearchingLyrics(false);
            return updatedTrack;
          }
        } catch (error) {
          console.warn(`[PlayerContext] ⚠️ Error con estrategia "${searchQuery}":`, error);
          
          // Detectar si es un error de límite de cuota
          if (error instanceof Error && 
              (error.message.includes('quota') || error.message.includes('Quota limit'))) {
            console.warn('[PlayerContext] ⚠️ Límite de cuota detectado en el error');
            youtubeQuotaExceededRef.current = true;
            break;
          }
        }
      }
      
      // Si ninguna estrategia funcionó
      console.warn('[PlayerContext] ⚠️ No se encontró youtubeId para:', track.title);
      failedYouTubeAttempts.current.add(track.id);
      setIsSearchingLyrics(false);
      return track;
    } catch (error) {
      console.error('[PlayerContext] ❌ Error al buscar youtubeId:', error);
      failedYouTubeAttempts.current.add(track.id);
      setIsSearchingLyrics(false);
      return track;
    }
  }, []);
  
  /**
   * Función auxiliar para sanitizar texto de búsqueda
   * Elimina caracteres especiales, datos entre paréntesis, etc.
   */
  const sanitizeSearchText = (text: string): string => {
    if (!text) return '';
    
    return text
      .replace(/\([^)]*\)/g, '') // Eliminar texto entre paréntesis
      .replace(/\[[^\]]*\]/g, '') // Eliminar texto entre corchetes
      .replace(/feat\.|ft\.|featuring/gi, '') // Eliminar feat, ft, featuring
      .replace(/remix|version|edit|extended|original/gi, '') // Eliminar palabras comunes en remixes
      .replace(/-/g, ' ') // Reemplazar guiones con espacios
      .replace(/\s+/g, ' ') // Reemplazar múltiples espacios con uno solo
      .trim();
  };

  // Configurar el reproductor de YouTube 
  const setupYoutubePlayer = useCallback(() => {
    // Verificar si estamos en el servidor
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      console.log('[PlayerContext] 🖥️ Ejecución en servidor, omitiendo configuración del reproductor');
      return;
    }
      
    // Evitar intentos repetidos en un corto período de tiempo
    const now = Date.now();
    const lastAttempt = playerInitTimeRef.current;
    playerInitTimeRef.current = now;

    if (lastAttempt && (now - lastAttempt < 2000)) {
      console.log('[PlayerContext] ⏱️ Demasiados intentos seguidos, esperando...');
      return;
    }

    try {
      console.log('[PlayerContext] 🚀 Iniciando configuración del reproductor de YouTube');
      
      // Verificar si la API está disponible
      if (!window.YT || !window.YT.Player || typeof window.YT.Player !== 'function') {
        console.error('[PlayerContext] ❌ API de YouTube no disponible, intentando cargar script');
        
        // Insertar el script de la API si no existe
        const existingScript = document.getElementById('youtube-api-script');
        if (!existingScript) {
          const script = document.createElement('script');
          script.id = 'youtube-api-script';
          script.src = 'https://www.youtube.com/iframe_api';
          document.head.appendChild(script);
          console.log('[PlayerContext] 📝 Script de la API insertado');
        }
        
        // Programar un reintento después de un tiempo
        setTimeout(setupYoutubePlayer, 2000);
        return;
      }
      
      // Limpiar referencia actual si existe
      if (youtubePlayerRef.current) {
        try {
          if (typeof youtubePlayerRef.current.destroy === 'function') {
            youtubePlayerRef.current.destroy();
            console.log('[PlayerContext] 🧹 Reproductor anterior destruido correctamente');
          }
        } catch (destroyError) {
          console.error('[PlayerContext] Error al destruir reproductor anterior:', destroyError);
        }
        youtubePlayerRef.current = null;
      }
      
      // Limpiar elementos existentes si los hay
      const oldContainer = document.getElementById('youtube-player-container');
      if (oldContainer) {
        console.log('[PlayerContext] 🧹 Eliminando contenedor anterior');
        oldContainer.remove();
      }
      
      // Crear nuevo contenedor en el DOM
      const container = document.createElement('div');
      container.id = 'youtube-player-container';
      container.style.position = 'absolute';
      container.style.width = '1px';
      container.style.height = '1px';
      container.style.visibility = 'hidden';
      container.style.pointerEvents = 'none';
      document.body.appendChild(container);
      
      // Crear elemento para el player
      const playerElement = document.createElement('div');
      playerElement.id = 'youtube-player';
      container.appendChild(playerElement);
      
      console.log('[PlayerContext] ✅ Contenedor creado correctamente:', document.getElementById('youtube-player'));
      
      // Asegurarnos de que el contenedor esté en el DOM antes de continuar
      if (!document.getElementById('youtube-player')) {
        console.error('[PlayerContext] ❌ No se pudo crear el contenedor para el reproductor');
        setTimeout(setupYoutubePlayer, 1000);
        return;
      }
      
      // Opciones para el reproductor de YouTube
      const playerOptions = {
      width: '1',
        height: '1',
        videoId: 'dQw4w9WgXcQ', // Video por defecto
      playerVars: {
          autoplay: 0,
        controls: 0,
          disablekb: 1,
        enablejsapi: 1,
        fs: 0,
          iv_load_policy: 3,
        modestbranding: 1,
          rel: 0,
          showinfo: 0,
          origin: window.location.origin,
          host: window.location.origin,
          playsinline: 1
      },
      events: {
          onReady: (event: any) => {
            console.log('[PlayerContext] ✅ REPRODUCTOR LISTO CORRECTAMENTE');
            console.log('[PlayerContext] 🔍 Objeto event:', {
              target: !!event.target,
              hasLoadVideoById: typeof event.target?.loadVideoById === 'function',
              hasSetVolume: typeof event.target?.setVolume === 'function',
              pendingTrack: !!pendingTrack
            });
            
            setPlayerReady(true);
            setIsYoutubeReady(true);
            
            // Verificar si tiene los métodos requeridos
            const hasLoadVideoById = typeof event.target.loadVideoById === 'function';
            const hasSetVolume = typeof event.target.setVolume === 'function';
            
            if (!hasLoadVideoById) {
              console.error('[PlayerContext] ❌ Método loadVideoById no disponible, reiniciando reproductor');
              youtubePlayerRef.current = null;
              // Esperar un poco antes de reintentar
              setTimeout(setupYoutubePlayer, 2000);
              return;
            }
            
            // Establecer volumen inicial
            if (hasSetVolume) {
              event.target.setVolume(volume);
              console.log('[PlayerContext] 🔊 Volumen inicial establecido:', volume);
            }
            
            // Reproducir track pendiente si existe
            if (pendingTrack && pendingTrack.youtubeId) {
              console.log('[PlayerContext] ▶️ Reproduciendo track pendiente:', pendingTrack.title);
              
              // Usar un timeout para asegurar que el reproductor esté listo
              setTimeout(() => {
                if (event.target && typeof event.target.loadVideoById === 'function') {
                  try {
                    event.target.loadVideoById(pendingTrack.youtubeId);
                    console.log('[PlayerContext] ✅ Video cargado correctamente:', pendingTrack.youtubeId);
                    setCurrentTrack(pendingTrack);
                    setIsPlaying(true);
                  } catch (loadError) {
                    console.error('[PlayerContext] ❌ Error al cargar video:', loadError);
                  }
                } else {
                  console.error('[PlayerContext] ❌ El reproductor no tiene método loadVideoById');
                }
              }, 500);
            }
          },
          onStateChange: handlePlayerStateChange,
          onError: (event: any) => {
            console.error('[PlayerContext] ❌ Error en reproductor YouTube:', event.data);
            if ([101, 150].includes(event.data)) {
              console.log('[PlayerContext] ℹ️ Error por restricciones de reproducción, intentando siguiente track');
              // Usar función anónima para evitar referencia directa
              setTimeout(() => {
                if (currentIndex < playlist.length - 1) {
                  const nextIndex = currentIndex + 1;
                  const nextTrack = playlist[nextIndex];
                  if (nextTrack) {
                    setCurrentIndex(nextIndex);
                    playTrack(nextTrack);
                  }
                }
              }, 500);
            }
          }
        }
      };
      
      // Crear nueva instancia del reproductor
      try {
        console.log('[PlayerContext] 🔄 Creando nueva instancia del reproductor con:', {
          YT: !!window.YT,
          Player: !!window.YT?.Player,
          containerId: 'youtube-player'
        });
        
        youtubePlayerRef.current = new window.YT.Player('youtube-player', playerOptions);
        console.log('[PlayerContext] ✅ Instancia del reproductor creada');
        
        // Verificar después de un momento que la instancia se haya creado correctamente
        setTimeout(() => {
          if (!youtubePlayerRef.current || typeof youtubePlayerRef.current.loadVideoById !== 'function') {
            console.error('[PlayerContext] ❌ Reproductor creado incorrectamente, verificando APIs disponibles');
            console.log('[PlayerContext] 🔍 Estado API YouTube:', {
              YT: !!window.YT,
              Player: !!(window.YT && window.YT.Player),
              PlayerState: !!(window.YT && window.YT.PlayerState)
            });
            
            youtubePlayerRef.current = null;
            
            // Intentar una vez más después de un tiempo
            setTimeout(setupYoutubePlayer, 3000);
          } else {
            console.log('[PlayerContext] ✅ Verificación de reproductor exitosa');
          }
        }, 1500);
      } catch (error) {
        console.error('[PlayerContext] ❌ Error al crear instancia del reproductor:', error);
        youtubePlayerRef.current = null;
        setTimeout(setupYoutubePlayer, 2000);
      }
    } catch (error) {
      console.error('[PlayerContext] ❌ Error general en setupYoutubePlayer:', error);
      setTimeout(setupYoutubePlayer, 2000);
    }
  }, [volume, pendingTrack, handlePlayerStateChange, currentIndex, playlist]);

  // Función para reproducir una pista
  const playTrack = useCallback(async (track: Track) => {
    try {
      // Verificar que estamos en el cliente
      if (typeof window === 'undefined') {
        console.warn('[PlayerContext] ⚠️ No se puede reproducir en el servidor');
        return;
      }
      
      // Resetear letras y estado antes de reproducir
      setLyrics({
        plain: null,
        synced: [],
        isLoading: false
      });
      setIsSearchingLyrics(false);
      
      if (!track) {
        console.error('[PlayerContext] ❌ No se puede reproducir una pista nula');
        return;
      }

      console.log('[PlayerContext] 🎵 Intentando reproducir:', track.title);

      // Verificar si la pista tiene ID de YouTube
      if (!track.youtubeId) {
        console.log('[PlayerContext] ⚠️ La pista no tiene youtubeId, intentando buscar uno:', track.title);
        
        // Guardar como pista pendiente mientras se busca el youtubeId
        setPendingTrack(track);
        
        const trackWithYoutubeId = await findYoutubeIdForTrack(track);
        
        if (!trackWithYoutubeId.youtubeId) {
          console.error('[PlayerContext] ❌ No se pudo encontrar youtubeId para:', track.title);
          // En lugar de simplemente detener la reproducción, actualizar el estado y mostrar un mensaje
          setCurrentTrack(track);
          
          // Si es probable que sea por límite de cuota, notificar al usuario pero mantener la experiencia
          const isLikelyQuotaLimit = failedYouTubeAttempts.current.size > 2 || youtubeQuotaExceededRef.current === true;
          if (isLikelyQuotaLimit) {
            console.warn('[PlayerContext] 🔄 Límite de cuota alcanzado, continuando con experiencia degradada');
            
            // Actualizar estado para mostrar que la pista se está reproduciendo aunque no se pueda reproducir realmente
            setIsPlaying(false);
            
            // Guardar en historial de todas formas
            saveToHistory(track);
            
            // Buscar letras si están disponibles
            fetchLyrics(track);
          } else {
            // En otros casos, simplemente detener la reproducción
            setIsPlaying(false);
            // Añadir a la lista de intentos fallidos
            failedYouTubeAttempts.current.add(track.id);
          }
          return;
        }
      
        // Usar la pista con ID de YouTube encontrado
        track = trackWithYoutubeId;
        console.log('[PlayerContext] ✅ Se encontró youtubeId para:', track.title, track.youtubeId);
      }
      
      // Actualizar estado y guardar en el historial
      setCurrentTrack(track);
      
      // Verificar el estado del reproductor de YouTube
      const playerIsReady = youtubePlayerRef.current && 
                          typeof youtubePlayerRef.current.loadVideoById === 'function' &&
                          typeof youtubePlayerRef.current.getCurrentTime === 'function';
                          
      if (!playerIsReady) {
        console.warn('[PlayerContext] ⚠️ Reproductor no inicializado o en estado incorrecto');
        
        // Guardar como pendiente y configurar el reproductor
        setPendingTrack(track);
        
        // Verificar si la API de YouTube está cargada
        if (window.YT && typeof window.YT.Player === 'function') {
          console.log('[PlayerContext] 🔄 API de YouTube disponible, configurando reproductor...');
          setupYoutubePlayer();
        } else {
          console.warn('[PlayerContext] ⚠️ API de YouTube no disponible, esperando carga...');
          // El useEffect cargará la API y reproducirá la pista pendiente
        }
        return;
      }
      
      console.log('[PlayerContext] ▶️ Reproductor listo, cargando video:', track.youtubeId);
      
      // Detener video actual si existe
      try {
        // Asegurar que el reproductor está listo y tiene los métodos necesarios
        if (typeof youtubePlayerRef.current.pauseVideo === 'function') {
          youtubePlayerRef.current.pauseVideo();
        }
        if (typeof youtubePlayerRef.current.stopVideo === 'function') {
          youtubePlayerRef.current.stopVideo();
        }
      } catch (stopError) {
        console.error('[PlayerContext] ❌ Error al detener video actual:', stopError);
      }
      
      // Pequeña pausa para asegurar que el video se detuvo
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Intentar cargar el nuevo video
      try {
        youtubePlayerRef.current.loadVideoById({
          videoId: track.youtubeId,
          startSeconds: 0
        });
        console.log('[PlayerContext] ✅ Video cargado correctamente');
        setIsPlaying(true);
      } catch (loadError) {
        console.error('[PlayerContext] ❌ Error al cargar video:', loadError);
        
        // Si falla, reiniciar el reproductor
        youtubePlayerRef.current = null;
        setPendingTrack(track);
        setupYoutubePlayer();
        return;
      }
      
      // Buscar letras y actualizar historial
      fetchLyrics(track);
      saveToHistory(track);
    } catch (error) {
      console.error('[PlayerContext] ❌ Error general en playTrack:', error);
      setIsPlaying(false);
    }
  }, [setupYoutubePlayer, findYoutubeIdForTrack, fetchLyrics, saveToHistory, playlist.length]);

  // useEffect para manejar la creación de playlist automática cuando cambia currentTrack
  useEffect(() => {
    // Solo crear playlist automática si hay una pista actual y la playlist está vacía o tiene solo 1 elemento
    if (currentTrack && playlist.length <= 1) {
      console.log('[PlayerContext] 🎵 Generando playlist automática para la canción actual');
      createAutoPlaylist(currentTrack)
        .then(newTracks => {
          console.log('[PlayerContext] ✅ Playlist automática generada con éxito');
        })
        .catch(error => {
          console.error('[PlayerContext] ❌ Error al generar playlist automática:', error);
        });
    }
  }, [currentTrack, playlist.length]);

  // Función para ir a la siguiente pista
  const nextTrack = useCallback(() => {
    try {
      if (playlist.length === 0) {
        console.warn('[PlayerContext] ⚠️ No hay lista de reproducción');
        return;
      }
      
      // Reiniciar el contador de saltos consecutivos al cambiar manualmente
      maxConsecutiveSkips.current = 0;
      
      console.log('[PlayerContext] ⏭️ Cambiando a siguiente canción. Playlist length:', playlist.length, 'Current index:', currentIndex);
      
      let nextIndex = currentIndex + 1;
      
      // Si estamos al final de la lista, volver al principio
      if (nextIndex >= playlist.length) {
        nextIndex = 0;
        console.log('[PlayerContext] 🔄 Llegamos al final de la playlist, volviendo al principio');
      }
      
      // Obtener la siguiente pista
      const track = playlist[nextIndex];
      
      if (!track) {
        console.error('[PlayerContext] ❌ No se encontró la pista en índice', nextIndex);
      return;
    }
    
      console.log('[PlayerContext] ▶️ Siguiente pista:', track.title, 'Índice:', nextIndex);
      
      // Actualizar el índice actual
          setCurrentIndex(nextIndex);
      
      // Verificar que la pista tiene un ID de YouTube válido
      if (!track.youtubeId) {
        console.error('[PlayerContext] ❌ La pista no tiene youtubeId', track);
        
        // Incrementar contador de saltos para evitar bucles infinitos
        maxConsecutiveSkips.current += 1;
        
        // Si hemos saltado demasiadas veces, deteniendo bucle
        if (maxConsecutiveSkips.current >= 3) {
          console.warn('[PlayerContext] ⚠️ Demasiados saltos consecutivos, deteniendo bucle');
          maxConsecutiveSkips.current = 0;
          setIsPlaying(false);
          return;
        }
        
        // Intentar buscar el ID de YouTube
        findYoutubeIdForTrack(track).then(updatedTrack => {
          if (updatedTrack.youtubeId) {
            // Si se encontró el ID, reproducir la pista actualizada
            playTrack(updatedTrack);
          } else {
            // Si no se encontró, pasar a la siguiente
            setTimeout(() => {
              console.log('[PlayerContext] 🔄 No se encontró youtubeId, pasando a siguiente pista');
              nextTrack();
            }, 500);
          }
        });
        return;
      }
      
      // Reproducir la pista
      playTrack(track);
      
      // Resetear el contador de saltos ya que encontramos una pista válida
      maxConsecutiveSkips.current = 0;
      } catch (error) {
      console.error('[PlayerContext] ❌ Error al ir a siguiente pista:', error);
      maxConsecutiveSkips.current = 0;
    }
  }, [currentIndex, playlist, playTrack, findYoutubeIdForTrack]);

  // Función para ir a la pista anterior
  const previousTrack = useCallback(() => {
    try {
      if (playlist.length === 0) {
        console.warn('[PlayerContext] ⚠️ No hay lista de reproducción');
        return;
      }
      
      // Reiniciar el contador de saltos consecutivos al cambiar manualmente
      maxConsecutiveSkips.current = 0;
      
      console.log('[PlayerContext] ⏮️ Cambiando a pista anterior. Playlist length:', playlist.length, 'Current index:', currentIndex);
      
      // Si estamos a más de 3 segundos en la pista actual, reiniciar la pista
      if (currentTime > 3) {
        console.log('[PlayerContext] ⏪ Reiniciando pista actual (tiempo > 3 segundos)');
        if (youtubePlayerRef.current && typeof youtubePlayerRef.current.seekTo === 'function') {
          youtubePlayerRef.current.seekTo(0, true);
          setCurrentTime(0);
        }
      return;
    }
    
      let prevIndex = currentIndex - 1;
      
      // Si estamos al principio de la lista, ir al final
      if (prevIndex < 0) {
        prevIndex = playlist.length - 1;
        console.log('[PlayerContext] 🔄 Estamos al inicio de la playlist, yendo al final');
      }
      
      // Obtener la pista anterior
      const track = playlist[prevIndex];
      
      if (!track) {
        console.error('[PlayerContext] ❌ No se encontró la pista en índice', prevIndex);
        return;
      }
      
      console.log('[PlayerContext] ▶️ Pista anterior:', track.title, 'Índice:', prevIndex);
      
      // Actualizar el índice actual
    setCurrentIndex(prevIndex);
      
      // Verificar que la pista tiene un ID de YouTube válido
      if (!track.youtubeId) {
        console.error('[PlayerContext] ❌ La pista no tiene youtubeId', track);
        
        // Incrementar contador para evitar bucles infinitos
        maxConsecutiveSkips.current += 1;
        
        // Si hemos saltado demasiadas veces, deteniendo bucle
        if (maxConsecutiveSkips.current >= 3) {
          console.warn('[PlayerContext] ⚠️ Demasiados saltos consecutivos, deteniendo bucle');
          maxConsecutiveSkips.current = 0;
          setIsPlaying(false);
          return;
        }
        
        // Intentar buscar el ID de YouTube
        findYoutubeIdForTrack(track).then(updatedTrack => {
          if (updatedTrack.youtubeId) {
            // Si se encontró el ID, reproducir la pista actualizada
            playTrack(updatedTrack);
          } else {
            // Si no se encontró, pasar a la anterior
            setTimeout(() => {
              console.log('[PlayerContext] 🔄 No se encontró youtubeId, pasando a pista anterior');
              previousTrack();
            }, 500);
          }
        });
        return;
      }
      
      // Reproducir la pista
      playTrack(track);
      
      // Resetear el contador de saltos ya que encontramos una pista válida
      maxConsecutiveSkips.current = 0;
    } catch (error) {
      console.error('[PlayerContext] ❌ Error al ir a pista anterior:', error);
      maxConsecutiveSkips.current = 0;
    }
  }, [currentIndex, playlist, currentTime, playTrack, findYoutubeIdForTrack]);

  // Efecto para mantener actualizado el tiempo actual durante la reproducción
  useEffect(() => {
    if (!isPlaying || !youtubePlayerRef.current) return;
    
    console.log('[PlayerContext] ⏱️ Iniciando intervalo de actualización de tiempo');
    
    // Crear un intervalo para actualizar el tiempo actual cada 100ms
    const timeUpdateInterval = setInterval(() => {
      try {
        if (youtubePlayerRef.current && typeof youtubePlayerRef.current.getCurrentTime === 'function') {
          const newTime = youtubePlayerRef.current.getCurrentTime();
          if (!isNaN(newTime) && newTime > 0) {
            setCurrentTime(newTime);
            }
          }
        } catch (error) {
        console.error('[PlayerContext] ❌ Error al actualizar tiempo:', error);
      }
    }, 100);
    
    // Limpiar el intervalo cuando se detenga la reproducción
    return () => {
      console.log('[PlayerContext] ⏱️ Deteniendo intervalo de actualización de tiempo');
      clearInterval(timeUpdateInterval);
    };
  }, [isPlaying]);

  // Efecto: Cargar letras de la canción actual
  useEffect(() => {
    if (!currentTrack) {
      setLyrics(prev => ({ ...prev, plain: null, synced: [], isLoading: false }));
      return;
    }
    
      setLyrics(prev => ({ ...prev, isLoading: true }));
      
    getLyrics(currentTrack)
      .then(result => {
        setLyrics({
          plain: result.plainLyrics,
          synced: result.syncedLyrics ? parseSyncedLyrics(result.syncedLyrics) : [],
          isLoading: false,
        });
      })
      .catch(error => {
        console.error('Error al cargar letras:', error);
        setLyrics({
          plain: null,
          synced: [],
          isLoading: false,
        });
      });
  }, [currentTrack]);

  // Efecto para actualizar las letras sincronizadas con el tiempo actual
  useEffect(() => {
    if (!isPlaying || lyrics.synced.length === 0) return;
    
    // Intervalo para actualizar las letras actuales
    const lyricsInterval = setInterval(() => {
      try {
        // Encontrar la línea de letra actual basada en el tiempo de reproducción
        const currentLyrics = getCurrentLyricLine(lyrics.synced, currentTime);
        
        // Si ya tenemos esta información en el estado, no hacer nada
        if (currentLyrics.index === currentLyricIndex) return;
        
        // Actualizar el estado con la letra actual
        setCurrentLyricIndex(currentLyrics.index);
        
        // Emitir un evento para que la UI pueda reaccionar (opcional)
        if (typeof window !== 'undefined') {
          const lyricsEvent = new CustomEvent('lyricsUpdate', { 
            detail: { 
              line: currentLyrics.line,
              index: currentLyrics.index
            }
          });
          window.dispatchEvent(lyricsEvent);
          console.log('[PlayerContext] 🎵 Letra actualizada:', currentLyrics.line?.text || 'No hay letra');
        }
      } catch (error) {
        console.error('[PlayerContext] ❌ Error al actualizar letras:', error);
      }
    }, 100); // Actualizar frecuentemente para precisión
    
    return () => clearInterval(lyricsInterval);
  }, [isPlaying, lyrics.synced, currentTime]);
  
  // Función para obtener la línea de letra actual basada en el tiempo
  const getCurrentLyricLine = (syncedLyrics: LyricLine[], currentTime: number): { 
    line: LyricLine | null, 
    index: number 
  } => {
    if (!syncedLyrics || syncedLyrics.length === 0) {
      return { line: null, index: -1 };
    }
    
    // Encontrar la última letra cuyo tiempo sea menor o igual al tiempo actual
    let index = -1;
    for (let i = 0; i < syncedLyrics.length; i++) {
      if (syncedLyrics[i].time <= currentTime) {
        index = i;
      } else {
        break; // Las letras están ordenadas por tiempo, así que podemos salir
      }
    }
    
    return {
      line: index >= 0 ? syncedLyrics[index] : null,
      index: index
    };
  };

  // Función para convertir un objeto de track de Spotify a nuestro formato Track
  const convertSpotifyTrackToTrack = (spotifyTrack: any): Track => {
    const coverUrl = spotifyTrack.album?.images?.[0]?.url || 'https://placehold.co/300x300/gray/white?text=No+Cover';
    return {
      id: spotifyTrack.id,
      title: spotifyTrack.name,
      artist: spotifyTrack.artists?.map((artist: any) => artist.name).join(', ') || 'Artista desconocido',
      album: spotifyTrack.album?.name || 'Álbum desconocido',
      cover: coverUrl,
      albumCover: coverUrl, // Añadir albumCover con el mismo valor que cover
      duration: spotifyTrack.duration_ms || 0,
      spotifyId: spotifyTrack.id,
      artistId: spotifyTrack.artists?.[0]?.id // Guardamos el ID del primer artista para recomendaciones
    };
  };

  // Reproducir una playlist con precarga mejorada
  const playPlaylist = async (tracks: Track[], startIndex: number = 0) => {
    if (tracks.length === 0) return;
    
    console.log('[PlayerContext] 🎵 Iniciando reproducción de playlist con', tracks.length, 'pistas');
    
    // Actualizar playlist
    setPlaylist(tracks);
    setCurrentIndex(startIndex);
    
    // Primero, asegurémonos de que la primera canción tenga ID de YouTube
    const firstTrack = tracks[startIndex];
    
    // Definir cuántas canciones precargar al inicio (máximo 5 o el total si hay menos)
    const preloadCount = Math.min(5, tracks.length);
    console.log(`[PlayerContext] 🔍 Precargando IDs para ${preloadCount} canciones iniciales`);
    
    try {
      // Mostrar indicador de búsqueda
      setIsSearchingLyrics(true);
      
      // Buscar ID para la primera pista si no lo tiene
      let currentTrackWithId = firstTrack;
      if (!firstTrack.youtubeId) {
        console.log('[PlayerContext] 🔍 Buscando ID para la primera canción:', firstTrack.title);
        currentTrackWithId = await findYoutubeIdForTrack(firstTrack);
        
        // Si no se encontró ID para la primera canción, intentemos reproducirla de todos modos
        if (!currentTrackWithId.youtubeId) {
          console.warn('[PlayerContext] ⚠️ No se encontró ID para la primera canción, intentando reproducir de todos modos');
        }
      }
      
      // Reproducir la primera canción inmediatamente
      await playTrack(currentTrackWithId);
      
      // Buscar IDs para las siguientes canciones en paralelo
      const tracksToPreload = [];
      for (let i = 1; i < preloadCount; i++) {
        const nextIndex = (startIndex + i) % tracks.length;
        if (tracks[nextIndex] && !tracks[nextIndex].youtubeId) {
          tracksToPreload.push(tracks[nextIndex]);
        }
      }
      
      // Si hay canciones para precargar, hacerlo secuencialmente para no sobrecargar la API
      if (tracksToPreload.length > 0) {
        console.log(`[PlayerContext] 🔄 Buscando IDs para ${tracksToPreload.length} canciones adicionales`);
        
        // Usar Promise.all pero con un pequeño retraso entre cada solicitud
        const updatedTracks = await tracksToPreload.reduce<Promise<Track[]>>(async (accumulator, track, index) => {
          // Esperar al resultado anterior
          const results = await accumulator;
          
          // Añadir un pequeño retraso entre solicitudes para no sobrecargar la API
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          try {
            console.log(`[PlayerContext] 🔍 Buscando ID para: ${track.title}`);
            const updatedTrack = await findYoutubeIdForTrack(track);
            
            if (updatedTrack.youtubeId) {
              console.log(`[PlayerContext] ✅ ID encontrado para: ${updatedTrack.title}`);
              
              // Actualizar la playlist con el ID encontrado
              setPlaylist(prev => prev.map(pt => 
                pt.id === updatedTrack.id ? updatedTrack : pt
              ));
        } else {
              console.warn(`[PlayerContext] ⚠️ No se encontró ID para: ${track.title}`);
            }
            
            return [...results, updatedTrack];
          } catch (error) {
            console.error(`[PlayerContext] ❌ Error al buscar ID para ${track.title}:`, error);
            return [...results, track];
          }
        }, Promise.resolve([]));
        
        console.log(`[PlayerContext] ✅ Búsqueda de IDs completada para ${updatedTracks.length} canciones`);
      }
      
      // Precargar el contenido de la siguiente canción
      setTimeout(() => {
        precacheNextTrack();
      }, 2000);
      
    } catch (error) {
      console.error('[PlayerContext] ❌ Error al iniciar playlist:', error);
    } finally {
      setIsSearchingLyrics(false);
    }
  };
  
  // Función para precargar el siguiente video de la playlist de manera más directa
  const precacheNextTrack = useCallback(() => {
    try {
      // Desactivar la precarga si estamos teniendo problemas con el reproductor principal
      if (!youtubePlayerRef.current || typeof youtubePlayerRef.current.loadVideoById !== 'function') {
        console.log('[PlayerContext] ⚠️ Reproductor principal no inicializado, omitiendo precarga');
        return;
      }
      
      // Verificar que hay playlist y un video actual
      if (playlist.length <= 1 || currentIndex === -1) return;
      
      // Calcular el índice de la siguiente pista
      const nextIndex = (currentIndex + 1) % playlist.length;
      const nextTrack = playlist[nextIndex];
      
      // Verificar que la siguiente pista existe
      if (!nextTrack) {
        console.log('[PlayerContext] ⚠️ No se encontró siguiente pista en índice', nextIndex);
        return;
      }
      
      // Verificar si la pista tiene un ID de YouTube válido
      if (!nextTrack.youtubeId) {
        console.log('[PlayerContext] ⚠️ La siguiente pista no tiene youtubeId:', nextTrack.title);
        
        // Si no tiene ID y no está ya en proceso de búsqueda, intentar encontrarlo
        if (!failedYouTubeAttempts.current.has(nextTrack.id)) {
          console.log('[PlayerContext] 🔍 Buscando ID para siguiente pista:', nextTrack.title);
          
          findYoutubeIdForTrack(nextTrack)
            .then(updatedTrack => {
              if (updatedTrack.youtubeId) {
                console.log('[PlayerContext] ✅ ID encontrado para siguiente pista:', updatedTrack.title);
                // Actualizar la playlist con el ID encontrado
                setPlaylist(prev => prev.map(pt => 
                  pt.id === updatedTrack.id ? updatedTrack : pt
                ));
              } else {
                console.warn('[PlayerContext] ⚠️ No se pudo encontrar ID para siguiente pista:', nextTrack.title);
                // Añadir a la lista de intentos fallidos para no repetir
                failedYouTubeAttempts.current.add(nextTrack.id);
              }
            })
            .catch(error => {
              console.warn('[PlayerContext] ⚠️ Error al buscar ID para siguiente pista:', error);
              failedYouTubeAttempts.current.add(nextTrack.id);
            });
        }
        return;
      }
      
      console.log(`[PlayerContext] 🔄 Precargando contenido para siguiente pista: ${nextTrack.title} (${nextTrack.youtubeId})`);
      
      // 1. Precargar miniatura para que esté en caché del navegador
      try {
        const img = new Image();
        img.onerror = () => {
          console.warn(`[PlayerContext] ⚠️ Error al cargar miniatura para: ${nextTrack.title}`);
        };
        img.src = `https://i.ytimg.com/vi/${nextTrack.youtubeId}/hqdefault.jpg`;
      } catch (imgError) {
        console.warn('[PlayerContext] ⚠️ Error al precargar miniatura:', imgError);
      }
      
      // 2. Precargar letras si están disponibles y no las estamos ya buscando
      if (nextTrack.title && nextTrack.artist && !isSearchingLyrics) {
        // Verificar si ya tenemos las letras en caché
        const lyricsKey = `lyrics-${nextTrack.id || `${nextTrack.title}-${nextTrack.artist}`}`;
        const errorKey = `lyrics-error-${nextTrack.id || `${nextTrack.title}-${nextTrack.artist}`}`;
        const cachedLyrics = localStorage.getItem(lyricsKey);
        
        // Si no hay letras en caché y no hay registro de error previo, intentar buscarlas silenciosamente
        if (!cachedLyrics && !localStorage.getItem(errorKey)) {
          // Sin logs para evitar mensajes en consola
          // Usar un tiempo de espera para no bloquear otras operaciones más importantes
          setTimeout(() => {
            // Buscar letras silenciosamente
            fetchLyrics(nextTrack).catch(() => {
              // Silenciar cualquier error
            });
          }, 1000);
        }
      }
      
      // 3. Precargar el video directamente usando la técnica más similar a la reproducción real
      // NUEVA IMPLEMENTACIÓN: crear un segundo player oculto para precargar
      try {
        // No precargar si ya hay un precargador para este video
        const preloadId = `yt-preload-${nextTrack.youtubeId}`;
        if (document.getElementById(preloadId)) {
          console.log(`[PlayerContext] ℹ️ Ya existe un precargador para: ${nextTrack.title}`);
          return;
        }
        
        // Verificar si estamos en el cliente
        if (typeof window === 'undefined' || typeof document === 'undefined') {
          return;
        }
        
        // Verificar que la API de YouTube esté cargada
        if (!window.YT || !window.YT.Player) {
          console.log('[PlayerContext] ⚠️ API de YouTube no disponible para precarga');
          return;
        }
        
        // Para evitar crear demasiados players, comprobar si ya hay alguno
        const existingPreloaders = document.querySelectorAll('[id^="yt-preload-"]');
        if (existingPreloaders.length > 0) {
          console.log('[PlayerContext] ℹ️ Ya hay un precargador activo, reutilizando');
          
          // Intentar reutilizar el preloader existente
          const existingPreloader = existingPreloaders[0];
          const preloaderId = existingPreloader.id;
          const ytPlayer = (window as any)[preloaderId];
          
          if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
            // Cargar el nuevo video en el player existente
            try {
              ytPlayer.loadVideoById({
                videoId: nextTrack.youtubeId,
                startSeconds: 0,
                endSeconds: 15
              });
              ytPlayer.mute();
              ytPlayer.pauseVideo();
              console.log(`[PlayerContext] ✅ Video precargado en player existente: ${nextTrack.title}`);
            } catch (loadError) {
              console.warn('[PlayerContext] ⚠️ Error al cargar video en player existente:', loadError);
            }
            return;
          }
        }
        
        // Crear contenedor para el player
        const preloadContainer = document.createElement('div');
        preloadContainer.id = preloadId + '-container';
        preloadContainer.style.position = 'absolute';
        preloadContainer.style.width = '1px';
        preloadContainer.style.height = '1px';
        preloadContainer.style.opacity = '0.01';
        preloadContainer.style.pointerEvents = 'none';
        preloadContainer.style.overflow = 'hidden';
        preloadContainer.style.visibility = 'hidden';
        document.body.appendChild(preloadContainer);
        
        // Crear elemento para el player
        const playerElement = document.createElement('div');
        playerElement.id = preloadId;
        preloadContainer.appendChild(playerElement);
        
        // Configurar opciones del player
        const playerOptions = {
          width: '1',
          height: '1',
          videoId: nextTrack.youtubeId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            enablejsapi: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            origin: window.location.origin,
            host: window.location.origin,
            start: 0,
            end: 15
          },
          events: {
            onReady: (event: any) => {
              console.log(`[PlayerContext] ✅ Preloader listo para: ${nextTrack.title}`);
              // Silenciar y pausar inmediatamente para que solo se precargue
              if (event.target && typeof event.target.mute === 'function') {
                event.target.mute();
              }
              if (event.target && typeof event.target.pauseVideo === 'function') {
                event.target.pauseVideo();
              }
            },
            onError: (event: any) => {
              console.warn(`[PlayerContext] ⚠️ Error en preloader: ${event.data}`);
            }
          }
        };
        
        // Crear nueva instancia del reproductor para precarga
        try {
          // Guardar referencia global para poder acceder después
          (window as any)[preloadId] = new window.YT.Player(preloadId, playerOptions);
          console.log(`[PlayerContext] ✅ Preloader creado para: ${nextTrack.title}`);
          
          // Configurar eliminación automática después de un tiempo
          setTimeout(() => {
            try {
              const container = document.getElementById(preloadId + '-container');
              if (container) {
                // Destruir el player primero
                const player = (window as any)[preloadId];
                if (player && typeof player.destroy === 'function') {
                  player.destroy();
                }
                // Eliminar el contenedor
                container.remove();
                // Eliminar referencia global
                delete (window as any)[preloadId];
                console.log(`[PlayerContext] 🧹 Preloader eliminado para: ${nextTrack.title}`);
              }
            } catch (cleanupError) {
              console.warn('[PlayerContext] ⚠️ Error al limpiar preloader:', cleanupError);
            }
          }, 30000); // 30 segundos de tiempo máximo para precargar
          
        } catch (playerError) {
          console.error(`[PlayerContext] ❌ Error al crear preloader:`, playerError);
          // Limpiar en caso de error
          try {
            const container = document.getElementById(preloadId + '-container');
            if (container) container.remove();
          } catch (e) {}
        }
        
      } catch (preloadError) {
        console.warn('[PlayerContext] ⚠️ Error al precargar video:', preloadError);
      }
      
    } catch (error) {
      console.warn('[PlayerContext] ⚠️ Error general en precarga:', error);
    }
  }, [playlist, currentIndex, findYoutubeIdForTrack, fetchLyrics, isSearchingLyrics]);

  // Función para buscar recomendaciones basadas en el track actual
  const createAutoPlaylist = async (track: Track): Promise<Track[]> => {
    try {
      console.log('[PlayerContext] 🔄 Iniciando creación de playlist automática basada en:', track.title);
      
      // Si ya hay una playlist con más de 5 elementos, no hacer nada
      if (playlist.length > 5) {
        console.log('[PlayerContext] Playlist ya tiene suficientes elementos, omitiendo creación');
        return playlist;
      }
      
      // Intentar obtener recomendaciones utilizando varios enfoques
      let recommendedTracks: Track[] = [];
      
      try {
        // 1. Intentar obtener pistas similares basadas en la pista actual
        console.log('[PlayerContext] Intentando obtener pistas similares...');
        const similarTracks = await getSimilarTracks(track, 15);
        recommendedTracks = [...similarTracks];
        console.log(`[PlayerContext] Obtenidas ${recommendedTracks.length} pistas similares`);
      } catch (similarError) {
        console.error('[PlayerContext] Error al obtener pistas similares:', similarError);
      }
      
      // Si no conseguimos suficientes pistas, intentar otro enfoque
      if (recommendedTracks.length < 5) {
        try {
          // 2. Intentar obtener pistas populares del artista
          console.log('[PlayerContext] Intentando obtener pistas populares del artista...');
          const artistTracks = await getArtistTopTracks(track.artist);
          
          // Filtrar para no duplicar pistas
          const existingTrackIds = [];
          for (const t of recommendedTracks) {
            if (t.id) existingTrackIds.push(t.id);
          }

          // Filtrar artistas para eliminar duplicados
          const newArtistTracks = [];
          for (const t of artistTracks) {
            if (t.id && !existingTrackIds.includes(t.id) && t.id !== track.id) {
              newArtistTracks.push(t);
            }
          }
          
          recommendedTracks = [...recommendedTracks, ...newArtistTracks];
          console.log(`[PlayerContext] Añadidas ${newArtistTracks.length} pistas del artista`);
        } catch (artistError) {
          console.error('[PlayerContext] Error al obtener pistas del artista:', artistError);
        }
      }
      
      // Manejar el caso donde no se pudieron obtener recomendaciones
      if (recommendedTracks.length === 0) {
        console.warn('[PlayerContext] No se pudieron obtener recomendaciones. Manteniendo la pista actual.');
        // No modificar la playlist existente si no pudimos obtener recomendaciones
        return playlist.length > 0 ? playlist : [track];
      }
      
      // Asegurar que la pista actual esté al principio si no está ya en la lista
      const currentTrackInRecommended = recommendedTracks.some((t: Track) => t.id === track.id);
      
      if (!currentTrackInRecommended) {
        recommendedTracks = [track, ...recommendedTracks];
      }
      
      // Limitar el tamaño de la playlist
      recommendedTracks = recommendedTracks.slice(0, 20);
      
      console.log(`[PlayerContext] Playlist automática creada con ${recommendedTracks.length} pistas`);
      
      // Actualizar la playlist y el índice actual
      setPlaylist(recommendedTracks);
      
      // Establecer el índice actual como 0 si la pista actual está al principio
      if (currentTrackInRecommended) {
        const currentIndex = recommendedTracks.findIndex((t: Track) => t.id === track.id);
        if (currentIndex >= 0) {
          setCurrentIndex(currentIndex);
        }
      } else {
        setCurrentIndex(0);
      }
      
      return recommendedTracks;
    } catch (error) {
      console.error('[PlayerContext] Error al crear playlist automática:', error);
      return playlist;
    }
  };

  // Efecto para mantener actualizado el tiempo actual durante la reproducción
  useEffect(() => {
    if (!isPlaying || !youtubePlayerRef.current) return;
    
    console.log('[PlayerContext] ⏱️ Iniciando intervalo de actualización de tiempo');
    
    // Crear un intervalo para actualizar el tiempo actual cada 100ms
    const timeUpdateInterval = setInterval(() => {
      try {
        if (youtubePlayerRef.current && typeof youtubePlayerRef.current.getCurrentTime === 'function') {
          const newTime = youtubePlayerRef.current.getCurrentTime();
          if (!isNaN(newTime) && newTime > 0) {
            setCurrentTime(newTime);
            }
          }
        } catch (error) {
        console.error('[PlayerContext] ❌ Error al actualizar tiempo:', error);
      }
    }, 100);
    
    // Limpiar el intervalo cuando se detenga la reproducción
    return () => {
      console.log('[PlayerContext] ⏱️ Deteniendo intervalo de actualización de tiempo');
      clearInterval(timeUpdateInterval);
    };
  }, [isPlaying]);

  // Buscar donde se establece la imagen de la miniatura
  const getThumbnailUrl = (youtubeId: string | undefined) => {
    if (!youtubeId) return '/placeholder-album.jpg';
    return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
  };

  /**
   * Efecto para cargar la API de YouTube
   */
  useEffect(() => {
    let apiLoadTimeout: NodeJS.Timeout | null = null;
    let retryCount = 0;
    const maxRetries = 10;

    console.log('[PlayerContext] 🚀 Iniciando carga de YouTube API...');
    
    // Si estamos en el servidor, no hacer nada
    if (typeof window === 'undefined') {
      console.log('[PlayerContext] 🖥️ Ejecución en servidor, omitiendo carga de YouTube API');
          return;
        }

    // Restablecer reproductor si hay algún problema
    if (youtubePlayerRef.current && typeof youtubePlayerRef.current.getPlayerState !== 'function') {
      console.warn('[PlayerContext] ⚠️ Reproductor en estado incorrecto, restableciendo');
      youtubePlayerRef.current = null;
    }

    // Verificar estado actual
    console.log('[PlayerContext] 🔍 Estado inicial:', {
      youtubeReady: isYoutubeReady,
      playerExists: !!youtubePlayerRef.current,
      apiExists: !!(window.YT && window.YT.Player)
    });

    // Limpiar la callback global antigua si existe
    if ((window as any).onYouTubeIframeAPIReady) {
      console.log('[PlayerContext] 🧹 Limpiando callback antiguo de YouTube API');
      (window as any).onYouTubeIframeAPIReady = null;
    }

    // Definir callback global para cuando se cargue la API
    (window as any).onYouTubeIframeAPIReady = () => {
      console.log('[PlayerContext] ✅ YouTube API cargada correctamente - callback ejecutado');
      setIsYoutubeReady(true);
      
      // Esperar para asegurarse de que la API esté completamente inicializada
      setTimeout(() => {
        console.log('[PlayerContext] 🔄 Configurando reproductor después de cargar API');
        setupYoutubePlayer();
        
        // Si hay una pista pendiente, reproducirla
        if (pendingTrack) {
          console.log('[PlayerContext] ▶️ Reproduciendo pista pendiente después de inicialización:', pendingTrack.title);
          playTrack(pendingTrack);
        }
      }, 1500);
    };

    // Si la API ya está cargada, configurar el reproductor
    if (window.YT && typeof window.YT.Player === 'function') {
      console.log('[PlayerContext] ✅ YouTube API ya está cargada');
      setIsYoutubeReady(true);
      
      // Configurar el reproductor si no existe
      if (!youtubePlayerRef.current) {
        console.log('[PlayerContext] 🔄 Configurando reproductor inmediatamente con API ya cargada');
        const timer = setTimeout(() => {
          setupYoutubePlayer();
          
          // Reproducir pista pendiente si hay alguna
          if (pendingTrack) {
            console.log('[PlayerContext] ▶️ Reproduciendo pista pendiente inmediatamente:', pendingTrack.title);
            playTrack(pendingTrack);
          }
        }, 500);
        
        return () => clearTimeout(timer);
      }
      return;
    }
    
    // Función para cargar el script de la API
    const loadYouTubeIframeAPI = () => {
      // Verificar y eliminar cualquier script anterior
      const existingScript = document.getElementById('youtube-api-script');
      if (existingScript) {
        console.log('[PlayerContext] 🧹 Eliminando script anterior de YouTube API');
        existingScript.remove();
      }
      
      // Crear y añadir el nuevo script
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.id = 'youtube-api-script';
      
      // Añadir evento de error para reintento
      tag.onerror = () => {
        console.error(`[PlayerContext] ❌ Error al cargar script de YouTube API (intento ${retryCount + 1}/${maxRetries})`);
        
        if (retryCount < maxRetries) {
          retryCount++;
          // Esperar progresivamente más tiempo entre cada intento
          const retryDelay = 1000 * Math.pow(1.5, retryCount);
          console.log(`[PlayerContext] 🔄 Reintentando en ${retryDelay}ms...`);
          
          setTimeout(loadYouTubeIframeAPI, retryDelay);
        } else {
          console.error('[PlayerContext] ❌ Se alcanzó el número máximo de reintentos para cargar YouTube API');
        }
      };
      
      // Insertar el script en el head para mayor prioridad
      const firstScript = document.getElementsByTagName('script')[0];
      firstScript.parentNode?.insertBefore(tag, firstScript);
      
      console.log('[PlayerContext] 📝 Script de YouTube API insertado');
    };
    
    // Iniciar la carga del script
    loadYouTubeIframeAPI();

    // Limpieza al desmontar
    return () => {
      if (apiLoadTimeout) {
        clearTimeout(apiLoadTimeout);
      }
      
      // Limpiar callback global
      if (typeof window !== 'undefined') {
        (window as any).onYouTubeIframeAPIReady = null;
      }
      
      // Intentar destruir el reproductor
      if (youtubePlayerRef.current && typeof youtubePlayerRef.current.destroy === 'function') {
        try {
          youtubePlayerRef.current.destroy();
          console.log('[PlayerContext] 🧹 Player destruido al desmontar');
        } catch (e) {
          console.error('[PlayerContext] ❌ Error al destruir player:', e);
        }
      }
    };
  }, [setupYoutubePlayer, pendingTrack, playTrack]);

  // Efecto para cargar la API de YouTube cuando el componente se monta
  useEffect(() => {
    // Variables para control de reintentos
    let retryCount = 0;
    const maxRetries = 3;
    let apiLoadTimeout: NodeJS.Timeout | null = null;
    
    console.log('[PlayerContext] 🔄 Iniciando carga de YouTube API');
    console.log('[PlayerContext] 🔍 Estado inicial YouTube API:', {
      YT: typeof window !== 'undefined' && !!window.YT, 
      Player: typeof window !== 'undefined' && window.YT && !!window.YT.Player
    });
    
    // Si el reproductor está en un estado incorrecto, resetearlo
    if (youtubePlayerRef.current && typeof youtubePlayerRef.current.loadVideoById !== 'function') {
      console.warn('[PlayerContext] ⚠️ Reproductor en estado incorrecto, reseteando');
      youtubePlayerRef.current = null;
    }
    
    // Definir callback global para cuando se cargue la API
    window.onYouTubeIframeAPIReady = () => {
      console.log('[PlayerContext] ✅ YouTube API cargada correctamente - callback ejecutado');
      setIsYoutubeReady(true);
      
      // Esperar para asegurarse de que la API esté completamente inicializada
      apiLoadTimeout = setTimeout(() => {
        console.log('[PlayerContext] 🔄 Configurando reproductor después de cargar API');
        setupYoutubePlayer();
        
        // Si hay una pista pendiente, reproducirla
        if (pendingTrack) {
          console.log('[PlayerContext] ▶️ Reproduciendo pista pendiente después de inicialización:', pendingTrack.title);
          playTrack(pendingTrack);
        }
      }, 1000);
    };

    // Si la API ya está cargada, configurar el reproductor
    if (window.YT && typeof window.YT.Player === 'function') {
      console.log('[PlayerContext] ✅ YouTube API ya está cargada');
      setIsYoutubeReady(true);
      
      // Configurar el reproductor si no existe
      if (!youtubePlayerRef.current) {
        console.log('[PlayerContext] 🔄 Configurando reproductor inmediatamente con API ya cargada');
        apiLoadTimeout = setTimeout(() => {
          setupYoutubePlayer();
          
          // Reproducir pista pendiente si hay alguna
          if (pendingTrack) {
            console.log('[PlayerContext] ▶️ Reproduciendo pista pendiente inmediatamente:', pendingTrack.title);
            playTrack(pendingTrack);
          }
        }, 500);
      }
      return;
    }

    // Función para cargar el script de la API con reintentos exponenciales
    const loadYouTubeIframeAPI = () => {
      // Verificar y eliminar cualquier script anterior
      const existingScript = document.getElementById('youtube-api-script');
      if (existingScript) {
        console.log('[PlayerContext] 🧹 Eliminando script anterior de YouTube API');
        existingScript.remove();
      }
      
      // Crear y añadir el nuevo script
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.id = 'youtube-api-script';
      
      // Añadir evento de error para reintento
      tag.onerror = () => {
        console.error(`[PlayerContext] ❌ Error al cargar script de YouTube API (intento ${retryCount + 1}/${maxRetries})`);
        
        if (retryCount < maxRetries) {
          retryCount++;
          // Esperar progresivamente más tiempo entre cada intento (backoff exponencial)
          const retryDelay = 1000 * Math.pow(2, retryCount);
          console.log(`[PlayerContext] 🔄 Reintentando en ${retryDelay}ms...`);
          
          setTimeout(loadYouTubeIframeAPI, retryDelay);
        } else {
          console.error('[PlayerContext] ❌ Se alcanzó el número máximo de reintentos para cargar YouTube API');
        }
      };
      
      // Insertar el script en el head para mayor prioridad
      const firstScript = document.getElementsByTagName('script')[0];
      firstScript.parentNode?.insertBefore(tag, firstScript);
      
      console.log('[PlayerContext] 📝 Script de YouTube API insertado');
    };
    
    // Iniciar la carga del script
    loadYouTubeIframeAPI();

    // Limpieza al desmontar
    return () => {
      if (apiLoadTimeout) {
        clearTimeout(apiLoadTimeout);
      }
      
      // Limpiar callback global
      window.onYouTubeIframeAPIReady = null;
      
      // Intentar destruir el reproductor
      if (youtubePlayerRef.current && typeof youtubePlayerRef.current.destroy === 'function') {
        try {
          youtubePlayerRef.current.destroy();
          console.log('[PlayerContext] 🧹 Player destruido al desmontar');
        } catch (e) {
          console.error('[PlayerContext] ❌ Error al destruir player:', e);
        }
      }
    };
  }, [setupYoutubePlayer, pendingTrack, playTrack]);

  // Efecto para escuchar el evento personalizado 'playTrack'
  useEffect(() => {
    const handleExternalPlayEvent = (event: any) => {
      try {
        console.log('[PlayerContext] 📡 Evento externo recibido:', event?.detail);
        
        if (!event || !event.detail) {
          console.error('[PlayerContext] ❌ Evento recibido sin datos');
          return;
        }
        
        const track = event.detail as Track;
        
        if (!track) {
          return;
        }
        
        if (!track.youtubeId) {
          console.error('[PlayerContext] ❌ Track sin youtubeId', track);
          return;
        }
        
        // Llamar a playTrack directamente
        playTrack(track);
      } catch (error) {
        console.error('[PlayerContext] ❌ Error al manejar evento externo:', error);
      }
    };

    // Añadir el listener
    window.addEventListener('playTrack', handleExternalPlayEvent as EventListener);
    console.log('[PlayerContext] 🔄 Listener para evento playTrack registrado');

    // Limpiar al desmontar
    return () => {
      window.removeEventListener('playTrack', handleExternalPlayEvent as EventListener);
      console.log('[PlayerContext] 🧹 Listener para evento playTrack eliminado');
    };
  }, [playTrack]);

  // Efecto para avanzar a la siguiente pista cuando termina una canción
  useEffect(() => {
    const handleTrackEnded = () => {
      console.log('[PlayerContext] 🎵 Evento de finalización detectado, avanzando a siguiente pista');
      
      if (playlist.length <= 1) {
        console.log('[PlayerContext] ℹ️ No hay suficientes pistas en la playlist para avanzar');
        return;
      }
      
      // Usar setTimeout para asegurar que cualquier actualización de estado pendiente se complete
      setTimeout(() => {
        try {
          // Calcular el siguiente índice
          const nextIndex = (currentIndex + 1) % playlist.length;
          console.log(`[PlayerContext] ⏭️ Avanzando a pista ${nextIndex} de ${playlist.length}`);
          
          // Establecer el nuevo índice
          setCurrentIndex(nextIndex);
          
          // Obtener la siguiente pista
          const nextTrackToPlay = playlist[nextIndex];
          
          if (nextTrackToPlay) {
            console.log('[PlayerContext] ▶️ Reproduciendo siguiente pista:', nextTrackToPlay.title);
            // Reproducir la siguiente pista
            playTrack(nextTrackToPlay);
          } else {
            console.error('[PlayerContext] ❌ No se encontró la siguiente pista en el índice', nextIndex);
            }
          } catch (error) {
          console.error('[PlayerContext] ❌ Error al avanzar a siguiente pista:', error);
        }
      }, 300);
    };
    
    // Añadir listener para el evento personalizado
    if (typeof window !== 'undefined') {
      window.addEventListener('youtube-player-ended', handleTrackEnded);
      console.log('[PlayerContext] 🔄 Listener para evento youtube-player-ended registrado');
    }
    
    // Limpiar al desmontar
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('youtube-player-ended', handleTrackEnded);
        console.log('[PlayerContext] 🧹 Listener para evento youtube-player-ended eliminado');
      }
    };
  }, [playlist, currentIndex, playTrack]);

  // Sincronizar el tiempo cuando isPlaying cambia a true
  useEffect(() => {
    if (isPlaying && youtubePlayerRef.current && youtubePlayerRef.current.getCurrentTime) {
      // Actualizar inmediatamente el tiempo actual cuando se inicia la reproducción
      try {
        const currentTimeFromPlayer = youtubePlayerRef.current.getCurrentTime();
        console.log('[PlayerContext] ⏱️ Tiempo actual sincronizado:', currentTimeFromPlayer);
        setCurrentTime(currentTimeFromPlayer);
          } catch (error) {
        console.error('[PlayerContext] ❌ Error al sincronizar tiempo:', error);
      }
    }
  }, [isPlaying]);

  // Efecto para precargar la siguiente pista de forma más eficiente y con menos solicitudes
  useEffect(() => {
    // Solo intentar precargar si:
    // 1. Hay una pista actual
    // 2. La playlist tiene más de una canción
    // 3. El reproductor principal ya está funcionando correctamente
    // 4. isPlaying está activo (para evitar precargar si está pausado)
    // 5. No hay cuota de YouTube excedida
    if (!currentTrack || 
        playlist.length <= 1 || 
        !youtubePlayerRef.current || 
        typeof youtubePlayerRef.current.getCurrentTime !== 'function' || 
        !isPlaying ||
        youtubeQuotaExceededRef.current) {
      return;
    }
    
    // Verificar si la siguiente pista ya tiene un ID
    const nextIndex = (currentIndex + 1) % playlist.length;
    const nextTrack = playlist[nextIndex];
    
    // Si no hay siguiente pista o ya estamos precargándola, salir
    if (!nextTrack) return;
    
    console.log('[PlayerContext] 🔄 Configurando precarga para la siguiente pista:', nextTrack.title);
    
    // Si la canción actual tiene una duración muy corta, precargar inmediatamente
    if (duration < 60) {
      console.log('[PlayerContext] ⏱️ Canción corta, precargando siguiente inmediatamente');
      setTimeout(precacheNextTrack, 1000);
      return;
    }
    
    // Calcular cuándo precargar basado en la duración de la canción actual
    // - Si la canción dura más de 2 minutos, precargar cuando quede 1 minuto
    // - Si la canción es más corta, precargar a la mitad
    const preloadDelay = Math.min(60, Math.max(5, duration / 2));
    
    // Variable para trackear si ya se ha hecho la precarga
    let preloadDone = false;
    
    // Crear una función que verifique si es momento de precargar
    const checkAndPreload = () => {
      try {
        if (!youtubePlayerRef.current || !isPlaying || preloadDone) return;
        
        const currentTimeNow = youtubePlayerRef.current.getCurrentTime();
        const timeRemaining = duration - currentTimeNow;
        
        // Si queda poco tiempo para que termine y no hemos precargado aún
        if (timeRemaining <= preloadDelay && timeRemaining > 0 && !preloadDone) {
          console.log(`[PlayerContext] ⏱️ Precargando siguiente pista (quedan ${timeRemaining.toFixed(1)} segundos)`);
          
          // Marcar como completado para no repetir
          preloadDone = true;
          
          // Ejecutar la precarga
          precacheNextTrack();
        }
      } catch (error) {
        console.warn('[PlayerContext] ⚠️ Error al verificar tiempo para precarga:', error);
      }
    };
    
    // Verificar cada 5 segundos si es momento de precargar
    // Usamos un intervalo más largo para reducir carga
    const preloadIntervalId = setInterval(checkAndPreload, 5000);
    
    // También intentamos precargar inmediatamente si la canción ya está avanzada
    checkAndPreload();
    
    return () => {
      clearInterval(preloadIntervalId);
    };
  }, [currentTrack, playlist, currentIndex, youtubePlayerRef.current, duration, isPlaying, precacheNextTrack, youtubeQuotaExceededRef.current]);

  // Valor del contexto
  const playerContextValue: PlayerContextType = {
    isPlaying,
    currentTime,
    duration,
    currentTrack,
    volume: volume / 100, // Convertir a escala 0-1 para la interfaz externa
    playlist,
    lyrics,
    playTrack,
    playPlaylist,
    togglePlay,
    nextTrack,
    previousTrack,
    setVolume: (newVolume: number) => {
      // Convertir de escala 0-1 a escala 0-100 para YouTube
      const volumeForYT = Math.round(newVolume * 100);
      console.log('[PlayerContext] 🔊 setVolume llamado con:', newVolume, 'convertido a:', volumeForYT);
      
      // Actualizar el estado interno
      setVolume(volumeForYT);
      
      // Aplicar al reproductor de YouTube
      if (youtubePlayerRef.current && youtubePlayerRef.current.setVolume) {
        console.log('[PlayerContext] 🔊 Aplicando volumen al reproductor YouTube:', volumeForYT);
        youtubePlayerRef.current.setVolume(volumeForYT);
      } else {
        console.warn('[PlayerContext] ⚠️ No se puede aplicar volumen - reproductor no disponible');
      }
    },
    seekTo,
    addToQueue: (track: Track) => {
      setPlaylist(prev => [...prev, track]);
    },
    createAutoPlaylist,
    resetYouTubeQuota
  };

  // Renderizar el proveedor del contexto
  return (
    <PlayerContext.Provider value={playerContextValue}>
      {children}
      
      {/* Elemento para guardar el player de YouTube en el DOM */}
      {typeof window !== 'undefined' && (
        <div className="hidden">
          <div 
            id="youtube-player-wrapper" 
            style={{ position: 'absolute', width: '1px', height: '1px', visibility: 'hidden' }}
          >
            <div id="youtube-player"></div>
          </div>
        </div>
      )}

      {/* En algún lugar donde se renderiza la imagen */}
      {currentTrack?.youtubeId && (
        <img 
          src={getThumbnailUrl(currentTrack.youtubeId)} 
          alt={currentTrack.title || 'Album cover'} 
          onError={(e) => {
            // Si la imagen falla, establecer una imagen predeterminada
            (e.target as HTMLImageElement).src = '/images/default-album-cover.jpg';
            console.log('Miniatura no disponible para el video, usando imagen predeterminada');
          }}
        />
      )}
    </PlayerContext.Provider>
  );
};

export default PlayerProvider; 