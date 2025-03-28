'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { getLyrics, parseSyncedLyrics } from '@/services/lyricsService';
import { getRecommendedTracks, getArtistTopTracks, searchTracks } from '@/services/spotify';
// Importar las nuevas funciones del sistema multi-fuente
import { getSimilarTracks, getArtistTopTracks as getMultiArtistTracks, getGeneralRecommendations } from '@/services/recommendations';
// Importar el tipo Track de types.ts
import { Track as AppTrack, LyricLine as AppLyricLine } from '@/types/types';

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
  createAutoPlaylist: (track: Track) => Promise<void>; // Nueva función para generar lista automática
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
  createAutoPlaylist: async () => {}, // Función vacía por defecto
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
  // Estado del reproductor
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolumeState] = useState<number>(0.7);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [lyrics, setLyrics] = useState<{
    plain: string | null;
    synced: LyricLine[];
    isLoading: boolean;
  }>({
    plain: null,
    synced: [],
    isLoading: false
  });
  
  // Referencia al reproductor de YouTube
  const [youtubePlayer, setYoutubePlayer] = useState<any>(null);
  const [isYoutubeReady, setIsYoutubeReady] = useState<boolean>(false);
  const youtubePlayerRef = useRef<any>(null);

  // Cargar la API de YouTube
  useEffect(() => {
    // Cargar la API de YouTube cuando se monta el componente
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      
      window.onYouTubeIframeAPIReady = () => {
        setIsYoutubeReady(true);
      };

      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    } else {
      setIsYoutubeReady(true);
    }

    return () => {
      window.onYouTubeIframeAPIReady = null;
    };
  }, []);

  // Configurar el reproductor de YouTube cuando esté listo
  useEffect(() => {
    if (!isYoutubeReady) return;

  

    // Verificar si ya existe el reproductor visible
    let playerContainer = document.getElementById('youtube-player-container');
    let playerElement: HTMLElement;
    
    // Si no existe, crear los elementos necesarios
    if (!playerContainer) {
      // Crear elemento div para el reproductor de YouTube
      playerContainer = document.createElement('div');
      playerContainer.id = 'youtube-player-container';
      
      // Posicionar fuera de la vista pero manteniendo funcionalidad
      playerContainer.style.position = 'fixed';
      playerContainer.style.bottom = '-1px';
      playerContainer.style.right = '0';
      playerContainer.style.width = '1px';
      playerContainer.style.height = '1px';
      playerContainer.style.opacity = '0.01'; // No completamente invisible para que YouTube siga funcionando
      playerContainer.style.pointerEvents = 'none';
      
      // Crear el elemento para el iframe de YouTube
      playerElement = document.createElement('div');
      playerElement.id = 'youtube-player';
      playerContainer.appendChild(playerElement);
      document.body.appendChild(playerContainer);
      

    } else {
      playerElement = document.getElementById('youtube-player') as HTMLElement;
     
    }

    // Crear instancia del reproductor con opciones mejoradas
  

    // Definir funciones callback antes de crear el player para evitar problemas de closure
    const onPlayerReady = (event: any) => {
    
      setYoutubePlayer(event.target);
      youtubePlayerRef.current = event.target; // Guardar en la referencia también
      event.target.setVolume(volume * 100);
      
      // Si ya hay una canción actual, cargarla en el reproductor
      if (currentTrack && currentTrack.youtubeId) {

        event.target.loadVideoById({
          videoId: currentTrack.youtubeId,
          startSeconds: 0,
          suggestedQuality: 'default'
        });
        
        // Sincronizar el estado de reproducción según isPlaying
        if (!isPlaying) {
          event.target.pauseVideo();
        }
      }
    };
    
    const onPlayerStateChange = (event: any) => {
      // YT.PlayerState.UNSTARTED = -1
      // YT.PlayerState.ENDED = 0
      // YT.PlayerState.PLAYING = 1
      // YT.PlayerState.PAUSED = 2
      // YT.PlayerState.BUFFERING = 3
      // YT.PlayerState.CUED = 5
      
      if (event.data === 1) { // PLAYING
        setIsPlaying(true);
        
        // Actualizar la duración solo cuando está disponible
        const duration = event.target.getDuration();
        if (duration && duration > 0) {
          setDuration(duration);
        }
        
        // Actualizar tiempo actual de inmediato para que las letras sincronizadas funcionen
        const currentTimeFromPlayer = event.target.getCurrentTime();
        if (currentTimeFromPlayer !== undefined && currentTimeFromPlayer !== null) {
          setCurrentTime(currentTimeFromPlayer);
        }
      } 
      else if (event.data === 2) { // PAUSED
        setIsPlaying(false);
      }
      else if (event.data === 0) { // ENDED
        setIsPlaying(false);
        
        // Intentar reproducir la siguiente canción automáticamente después de un breve retardo
        setTimeout(() => {
          nextTrack();
        }, 500);
      }
    };
    
    const onPlayerError = (event: any) => {
      console.error('PlayerContext: Error en el reproductor de YouTube', event.data);
      
      // Códigos de error comunes:
      // 2 – La solicitud contiene un valor de parámetro no válido
      // 5 – El contenido solicitado no puede ser reproducido en un reproductor HTML5
      // 100 – El video solicitado no se encuentra
      // 101, 150 – El propietario del video solicitado no permite que se reproduzca en reproductores insertados
      
      // Intentar siguiente canción en caso de error
      if (event.data === 150 || event.data === 101 || event.data === 100) {
      
        setTimeout(() => nextTrack(), 500);
      }
    };

    // Crear y configurar el reproductor
    const player = new window.YT.Player('youtube-player', {
      height: '1',
      width: '1',
      playerVars: {
        autoplay: 0, // No autoplay hasta que lo solicitemos explícitamente
        controls: 0,
        enablejsapi: 1,
        fs: 0,
        rel: 0,
        modestbranding: 1,
        iv_load_policy: 3, // Ocultar anotaciones
        playsinline: 1, // Reproducir en dispositivos móviles
        origin: window.location.origin // Importante para seguridad
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
        onError: onPlayerError
      }
    });

    // Iniciar intervalo para actualizar el tiempo actual y sincronizar estados
    const interval = setInterval(() => {
      if (!youtubePlayerRef.current) {
        return;
      }
      
      try {
        // Asegurarse de que podemos acceder a los métodos del reproductor
        if (youtubePlayerRef.current.getCurrentTime && youtubePlayerRef.current.getPlayerState) {
          // Actualizar tiempo actual solo si el reproductor está activo (no en estado 0=ENDED)
          if (youtubePlayerRef.current.getPlayerState() !== 0) {
            const currentTimeFromPlayer = youtubePlayerRef.current.getCurrentTime();
            
            // Usar una función para asegurar que estamos actualizando desde el último estado
            setCurrentTime((prevTime) => {
              // Solo actualizar si hay un cambio significativo para evitar renders innecesarios
              if (Math.abs(prevTime - currentTimeFromPlayer) > 0.1) {
                return currentTimeFromPlayer;
              }
              return prevTime;
            });
          }
          
          // Sincronizar el estado de reproducción con el estado actual del reproductor
          const playerState = youtubePlayerRef.current.getPlayerState();
          const shouldBePlaying = playerState === 1; // PLAYING
          
          if (isPlaying !== shouldBePlaying) {
            setIsPlaying(shouldBePlaying);
          }
          
          // Verificar si el reproductor ha cambiado de video
          if (youtubePlayerRef.current.getVideoData && currentTrack) {
            const videoData = youtubePlayerRef.current.getVideoData();
            // Si el ID del video actual no coincide con el del track, actualizar el contexto
            if (videoData && videoData.video_id && videoData.video_id !== currentTrack.youtubeId) {
              // Aquí podríamos buscar el track correcto en la playlist, pero es complicado
            }
          }
        }
      } catch (error) {
        console.error('PlayerContext: Error al actualizar estado del reproductor:', error);
      }
    }, 200); // Actualizar cada 200ms para una respuesta más rápida

    return () => {
      clearInterval(interval);
      // No eliminar el contenedor, solo desconectar eventos
      if (youtubePlayerRef.current) {
        try {
          youtubePlayerRef.current.stopVideo();
        } catch (e) {
          console.error('Error al detener el video:', e);
        }
      }
    };
  }, [isYoutubeReady]);

  // Cargar letras cuando cambia la canción actual
  useEffect(() => {
    if (!currentTrack) return;
    
    const fetchLyrics = async () => {
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
    
    fetchLyrics();
  }, [currentTrack]);

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

  // Reproducir una canción
  const playTrack = async (track: Track) => {
    try {
      // Actualizar estado
      setCurrentTrack(track);
      
      // Si no está en la playlist actual, la actualizamos
      let trackIndex = playlist.findIndex(t => t.id === track.id);
      
      if (trackIndex === -1) {
        // Si la canción no está en la playlist, la añadimos como única canción
        // y luego generamos recomendaciones
        setPlaylist([track]);
        setCurrentIndex(0);
        trackIndex = 0;
        
        // Si solo hay un elemento en la lista de reproducción (la canción actual),
        // intentamos generar automáticamente una lista de reproducción en segundo plano
        createAutoPlaylist(track).catch(error => {
          console.error('Error al generar lista de reproducción automática:', error);
        });
      } else {
        // Si la canción ya está en la playlist, actualizamos el índice
        setCurrentIndex(trackIndex);
      }
      
      // Si ya tiene ID de YouTube, usarlo directamente
      if (track.youtubeId) {
        if (youtubePlayerRef.current) {
          // Primero pausamos cualquier reproducción actual
          youtubePlayerRef.current.pauseVideo();
          
          // Luego cargamos el nuevo video
          youtubePlayerRef.current.loadVideoById({
            videoId: track.youtubeId,
            startSeconds: 0,
            suggestedQuality: 'default'
          });
          
          // Establecer volumen
          youtubePlayerRef.current.setVolume(volume * 100);
          
          // Actualizar el estado
          setIsPlaying(true);
        } else {
          console.error('PlayerContext: YouTube player no está disponible');
        }
        return;
      }
      
      // Si no tiene ID de YouTube, obtenerlo de la API
     
      
      try {
        // Llamar a nuestra API que maneja la búsqueda en YouTube
        const response = await fetch('/api/spotify/play', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            trackId: track.spotifyId || track.id,
            name: track.title,
            artist: track.artist
          }),
        });
        
        if (!response.ok) {
          throw new Error(`Error en la respuesta: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.videoId) {
          // Guardar el ID del video para futuras reproducciones
          track.youtubeId = data.videoId;
          
          // Reproducir el video
          if (youtubePlayerRef.current) {
            youtubePlayerRef.current.loadVideoById({
              videoId: data.videoId,
              startSeconds: 0,
              suggestedQuality: 'default'
            });
            youtubePlayerRef.current.setVolume(volume * 100);
            
            // Actualizar el estado
            setIsPlaying(true);
            
       
          } else {
            console.error('PlayerContext: YouTube player no está disponible después de obtener videoId');
          }
        } else {
          console.error('No se encontró un video para esta canción');
        }
      } catch (error) {
        console.error('Error al buscar video para la canción:', error);
      }
    } catch (error) {
      console.error('Error al reproducir la canción:', error);
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
    if (!youtubePlayerRef.current || !currentTrack) {
      console.warn('PlayerContext: No se puede alternar reproducción, falta player o track');
      return;
    }
    
    if (isPlaying) {
      youtubePlayerRef.current.pauseVideo();
    } else {
      youtubePlayerRef.current.playVideo();
    }
  };

  // Siguiente canción
  const nextTrack = async () => {
    if (playlist.length <= 1 || currentIndex < 0) {
      // Si no hay más canciones, intentamos generar recomendaciones si tenemos la canción actual
      if (currentTrack) {
        try {
          await createAutoPlaylist(currentTrack);
          // Si se creó una playlist, avanzamos a la siguiente canción
          if (playlist.length > 1) {
            const nextIndex = 1; // La siguiente canción después de la actual
            setCurrentIndex(nextIndex);
            await playTrack(playlist[nextIndex]);
            return; // Importante: retornar para evitar continuar con la ejecución
          }
        } catch (error) {
          console.error('Error al generar recomendaciones al llegar al final de la playlist:', error);
        }
      }
      return;
    }
    
    // Si ya estamos en la última canción, intentamos obtener más recomendaciones
    if (currentIndex === playlist.length - 1) {
      try {
        // Usamos la canción actual para generar más recomendaciones
        await createAutoPlaylist(currentTrack!);
        
        // Si se actualizó la playlist, ajustamos el índice a la siguiente canción
        if (playlist.length > 1) {
          const nextIndex = 1; // La canción nueva estará después de la actual que volvió a la posición 0
          setCurrentIndex(nextIndex);
          await playTrack(playlist[nextIndex]);
          return;
        }
      } catch (recommendationError) {
        console.error('Error al obtener más recomendaciones:', recommendationError);
        // Si falla, seguimos con el comportamiento normal de ciclar la playlist
      }
    }
    
    // Comportamiento normal: avanzar a la siguiente canción en la playlist
    const nextIndex = (currentIndex + 1) % playlist.length;
    setCurrentIndex(nextIndex);
    await playTrack(playlist[nextIndex]);
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
    setVolume(newVolume);
    if (youtubePlayerRef.current) {
      youtubePlayerRef.current.setVolume(newVolume * 100);
    }
  };

  // Evento para escuchar eventos de reproducción desde fuera del contexto
  useEffect(() => {
    // Función para manejar el evento personalizado 'playTrack'
    const handleExternalPlayEvent = (event: any) => {
      try {
        if (!event || !event.detail) {
          console.error('PlayerContext: Evento recibido sin datos');
          return;
        }
        
        const track = event.detail as Track;
        
        if (!track) {
          return;
        }
        
        if (!track.youtubeId) {
          console.error('PlayerContext: Track sin youtubeId', track);
          return;
        }
        
        // Llamar a playTrack directamente
        playTrack(track);
      } catch (error) {
        console.error('Error al manejar evento externo:', error);
      }
    };

    // Añadir el listener
    window.addEventListener('playTrack', handleExternalPlayEvent as EventListener);

    // Limpiar al desmontar
    return () => {
      window.removeEventListener('playTrack', handleExternalPlayEvent as EventListener);
    };
  }, [playTrack]);

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

  // Nueva función para generar lista de reproducción automática
  const createAutoPlaylist = async (track: Track) => {
    try {
      console.log('[Playlist] Generando lista de reproducción automática para:', track.title);
      
      let recommendedTracks: Track[] = [];
      
      // Usar el nuevo sistema multi-fuente para obtener recomendaciones similares
      try {
        console.log('[Playlist] Intentando obtener tracks similares con sistema multi-fuente');
        // Asegurar que track tiene todas las propiedades necesarias
        const trackForRecommendation: AppTrack = {
          ...track,
          albumCover: track.cover // Usar cover como albumCover si no existe
        };
        
        const similarTracks = await getSimilarTracks(trackForRecommendation, 25);
        if (similarTracks && similarTracks.length > 0) {
          recommendedTracks = similarTracks;
          console.log('[Playlist] Recomendaciones obtenidas por sistema multi-fuente:', recommendedTracks.length);
        }
      } catch (error) {
        console.error('[Playlist] Error con recomendador multi-fuente:', error);
      }
      
      // Si no funcionó el sistema multi-fuente, intentar el sistema antiguo
      if (recommendedTracks.length === 0) {
        // Intentamos diferentes métodos para obtener recomendaciones, en orden de prioridad
        console.log('[Playlist] Usando sistema de recomendaciones de fallback');
        
        // 1. Si tenemos el ID de Spotify, obtener recomendaciones directamente
        if (track.spotifyId) {
          try {
            // Preparar parámetros para la API
            let params = new URLSearchParams();
            params.append('action', 'recommended');
            params.append('limit', '20');
            
            // Añadir seed_tracks si hay spotifyId
            if (track.spotifyId) {
              params.append('seed_tracks', track.spotifyId);
            }
            
            // Añadir seed_artists si hay artistId
            if (track.artistId) {
              params.append('seed_artists', track.artistId);
            }
            
            // Obtener recomendaciones basadas en la canción y artista actual
            const response = await fetch(`/api/spotify?${params.toString()}`);
            
            if (response.ok) {
              const data = await response.json();
              if (data.tracks && data.tracks.length > 0) {
                recommendedTracks = data.tracks.map((track: any) => convertSpotifyTrackToTrack(track));
                console.log('[Playlist] Recomendaciones obtenidas por método combinado:', recommendedTracks.length);
              }
            }
          } catch (error) {
            console.error('[Playlist] Error al obtener recomendaciones combinadas:', error);
          }
        }
        
        // 2. Si no hay recomendaciones y tenemos el ID del artista, obtener canciones populares del artista
        if (recommendedTracks.length === 0 && track.artist) {
          try {
            // Intentar primero con el sistema multi-fuente
            const artistTracks = await getMultiArtistTracks(track.artist, 20);
            if (artistTracks && artistTracks.length > 0) {
              recommendedTracks = artistTracks.filter(t => t.id !== track.id); // Filtrar canción actual
              console.log('[Playlist] Recomendaciones obtenidas por artista (multi):', recommendedTracks.length);
            }
            
            // Si no funciona, intentar con el sistema antiguo si tenemos el artistId
            if (recommendedTracks.length === 0 && track.artistId) {
              const spotifyArtistTracks = await getArtistTopTracks(track.artistId);
              if (spotifyArtistTracks && spotifyArtistTracks.length > 0) {
                recommendedTracks = spotifyArtistTracks
                  .filter((t: any) => t.id !== track.spotifyId)
                  .map((track: any) => convertSpotifyTrackToTrack(track)); 
                console.log('[Playlist] Recomendaciones obtenidas por artista (spotify):', recommendedTracks.length);
              }
            }
          } catch (error) {
            console.error('[Playlist] Error al obtener canciones populares del artista:', error);
          }
        }
        
        // 3. Si aún no hay recomendaciones, buscar por nombre del artista
        if (recommendedTracks.length === 0 && track.artist) {
          try {
            const searchResults = await searchTracks(track.artist, 20);
            if (searchResults && searchResults.length > 0) {
              recommendedTracks = searchResults
                .filter((t: any) => t.id !== track.spotifyId)
                .map((track: any) => convertSpotifyTrackToTrack(track));
              console.log('[Playlist] Recomendaciones obtenidas por búsqueda de artista:', recommendedTracks.length);
            }
          } catch (error) {
            console.error('[Playlist] Error al buscar canciones por artista:', error);
          }
        }
      }
      
      // 4. Si todavía no hay recomendaciones, obtener recomendaciones generales
      if (recommendedTracks.length === 0) {
        try {
          // Intentar primero con el sistema multi-fuente
          const generalRecs = await getGeneralRecommendations(20);
          if (generalRecs && generalRecs.length > 0) {
            recommendedTracks = generalRecs;
            console.log('[Playlist] Recomendaciones generales obtenidas (multi):', recommendedTracks.length);
          } else {
            // Si no funciona, intentar con el sistema antiguo
            const spotifyRecs = await getRecommendedTracks(20);
            if (spotifyRecs && spotifyRecs.length > 0) {
              recommendedTracks = spotifyRecs.map((track: any) => convertSpotifyTrackToTrack(track));
              console.log('[Playlist] Recomendaciones generales obtenidas (spotify):', recommendedTracks.length);
            }
          }
        } catch (error) {
          console.error('[Playlist] Error al obtener recomendaciones generales:', error);
        }
      }
      
      if (recommendedTracks.length > 0) {
        // Añadir la canción actual al principio si no está ya
        let newPlaylist: Track[] = [track];
        
        // Añadir las recomendaciones, evitando duplicados
        recommendedTracks.forEach(recTrack => {
          if (!newPlaylist.some(t => t.id === recTrack.id)) {
            newPlaylist.push(recTrack);
          }
        });
        
        // Actualizar la playlist
        console.log('[Playlist] Lista de reproducción automática generada con', newPlaylist.length, 'canciones');
        setPlaylist(newPlaylist);
        setCurrentIndex(0); // La canción actual estará en la posición 0
      } else {
        console.warn('[Playlist] No se pudieron obtener recomendaciones para la lista automática');
      }
    } catch (error) {
      console.error('[Playlist] Error al generar la lista de reproducción automática:', error);
    }
  };

  // Valor del contexto
  const value: PlayerContextType = {
    currentTrack,
    playlist,
    isPlaying,
    volume,
    currentTime,
    duration,
    lyrics,
    playTrack,
    playPlaylist,
    togglePlay,
    nextTrack,
    previousTrack,
    setVolume,
    seekTo,
    addToQueue,
    createAutoPlaylist
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
};

export default PlayerContext; 