'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  IconButton,
  Slider,
  Typography,
  styled,
  Stack,
  Avatar,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  SkipNext,
  SkipPrevious,
  VolumeUp,
  VolumeOff,
  Repeat,
  Shuffle,
  Favorite,
  FavoriteBorder,
  QueueMusic,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { usePlayer, Track } from '@/contexts/PlayerContext';

// Data URL para imagen placeholder, evita solicitudes HTTP
const placeholderDataUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzMzMyIvPjwvc3ZnPg==';

const PlayerBarContainer = styled(Box)(({ theme }) => ({
  height: '90px',
  backgroundColor: '#0f0f18',
  borderTop: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(1, 2),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 100,
  color: 'white',
}));

const TrackInfo = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  width: '30%',
  overflow: 'hidden',
});

const Controls = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40%',
});

const ExtraControls = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  width: '30%',
});

// Slider personalizado con color morado
const PurpleSlider = styled(Slider)(({ theme }) => ({
  color: theme.palette.secondary.main,
  '& .MuiSlider-thumb': {
    width: 12,
    height: 12,
    transition: '0.3s cubic-bezier(.47,1.64,.41,.8)',
    '&::before': {
      boxShadow: '0 2px 12px 0 rgba(0,0,0,0.4)',
    },
    '&:hover, &.Mui-focusVisible': {
      boxShadow: `0px 0px 0px 8px ${theme.palette.mode === 'dark' ? 'rgb(128 25 167 / 16%)' : 'rgb(128 25 167 / 16%)'}`,
    },
    '&.Mui-active': {
      width: 14,
      height: 14,
    },
  },
  '& .MuiSlider-rail': {
    opacity: 0.28,
  },
}));

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const PlayerBar = () => {
  // Obtener contexto del reproductor
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume: contextVolume,
    togglePlay,
    nextTrack,
    previousTrack,
    seekTo,
    setVolume,
    playlist,
    playTrack,
    lyrics,
    createAutoPlaylist,
    isShuffleEnabled,
    isRepeatEnabled,
    toggleShuffle,
    toggleRepeat
  } = usePlayer();

  // Estados locales del componente
  const [localVolume, setLocalVolume] = useState(contextVolume * 100);
  const [isMuted, setIsMuted] = useState(contextVolume === 0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVolumeVisible, setIsVolumeVisible] = useState(false);
  const [leftPanelTab, setLeftPanelTab] = useState<'vinyl' | 'playlist'>('vinyl');
  const [rightPanelTab, setRightPanelTab] = useState<'lyrics' | 'info'>('lyrics');
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);

  // Referencias
  const progressBarRef = useRef<HTMLDivElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProgrammaticScrollRef = useRef(false);

  // Agregar manejador de eventos de teclado para atajos
  useEffect(() => {
    // Solo configurar el event listener si hay una canción actual
    if (!currentTrack) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Evitar actuar si el usuario está escribiendo en un input
      if (e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.code) {
        case 'Space': // Barra espaciadora para reproducir/pausar
          e.preventDefault(); // Evitar scroll en la página
          togglePlay();
          break;
        case 'ArrowRight': // Flecha derecha para siguiente canción
          e.preventDefault();
          nextTrack();
          break;
        case 'ArrowLeft': // Flecha izquierda para canción anterior
          e.preventDefault();
          previousTrack();
          break;
      }
    };

    // Agregar event listener
    window.addEventListener('keydown', handleKeyDown);

    // Eliminar event listener cuando se desmonte
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentTrack, togglePlay, nextTrack, previousTrack]);

  // Calcular progreso actual
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Formateamos los tiempos para la UI
  const currentTimeFormatted = formatTime(currentTime);
  const totalTimeFormatted = formatTime(duration);

  // Simplificar la lógica de scroll
  useEffect(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 3000);

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [isUserScrolling]);

  // Log de debug para la playlist
  useEffect(() => {
    if (playlist) {
      console.log("[PlayerBar] Playlist actualizada:", playlist.length, "canciones");
    }
  }, [playlist]);

  // Log de debug para la canción actual
  useEffect(() => {
    if (currentTrack) {
      console.log("[PlayerBar] Canción actual actualizada:", currentTrack.title);
    }
  }, [currentTrack]);

  // Memoizar la función handleUserScroll para evitar recreaciones innecesarias
  const memoizedHandleUserScroll = useCallback(() => {
    if (isProgrammaticScrollRef.current) {
      isProgrammaticScrollRef.current = false;
      return;
    }

    // Marcamos que el usuario está scrolleando manualmente
    setIsUserScrolling(true);

    // Solo desactivamos el autocentrado y configuramos el temporizador
    // si el autocentrado está activado actualmente
    if (autoScrollEnabled) {
      setAutoScrollEnabled(false);

      // Limpiar cualquier timeout existente
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Establecer un nuevo timeout para reactivar el auto-scroll después de 3 segundos
      scrollTimeoutRef.current = setTimeout(() => {
        setIsUserScrolling(false);
        setAutoScrollEnabled(true);
      }, 3000);
    }
  }, [autoScrollEnabled]);

  // Actualizar volumen cuando cambia en el contexto
  useEffect(() => {
    setLocalVolume(contextVolume * 100);
    setIsMuted(contextVolume === 0);
  }, [contextVolume]);

  // Detectar la línea actual basado en el tiempo actual
  useEffect(() => {
    if (!lyrics.synced.length) return;

    // Pequeño offset para anticipar ligeramente el cambio de línea
    const offsetTime = currentTime + 0.2; // 200ms de anticipación

    // Encontrar la línea actual
    let foundIndex = null;

    // Buscar la línea actual
    for (let i = 0; i < lyrics.synced.length; i++) {
      const currentLine = lyrics.synced[i];
      const nextLine = i < lyrics.synced.length - 1 ? lyrics.synced[i + 1] : null;

      if (nextLine) {
        // Si estamos entre esta línea y la siguiente
        if (offsetTime >= currentLine.time && offsetTime < nextLine.time) {
          foundIndex = i;
          break;
        }
      } else if (offsetTime >= currentLine.time) {
        // Si es la última línea y ya pasó su tiempo
        foundIndex = i;
      }
    }

    // Si encontramos una línea actual y es diferente a la anterior, actualizar el estado
    if (foundIndex !== null && foundIndex !== currentLineIndex) {
      setCurrentLineIndex(foundIndex);

      // Hacer scroll a la línea actual si el autocentrado está activado y no hay scroll manual
      if (autoScrollEnabled && !isUserScrolling) {
        const element = document.getElementById(`lyric-line-${foundIndex}`);
        if (element && lyricsContainerRef.current) {
          // Calcular posición para centrar
          const container = lyricsContainerRef.current;
          const elementTop = element.offsetTop;
          const elementHeight = element.clientHeight;
          const containerHeight = container.clientHeight;

          // Marcar que el scroll está siendo programático para evitar activar el evento de scroll manual
          isProgrammaticScrollRef.current = true;

          // Scroll simple para centrar el elemento
          container.scrollTo({
            top: elementTop - (containerHeight / 2) + (elementHeight / 2),
            behavior: 'smooth'
          });
        }
      }
    }
  }, [currentTime, lyrics.synced, autoScrollEnabled, isUserScrolling, currentLineIndex]);

  // Limpiar timeout cuando cambia la canción
  useEffect(() => {
    setAutoScrollEnabled(true);
    setIsUserScrolling(false);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
  }, [currentTrack]);

  // Añadir y eliminar el listener de scroll
  useEffect(() => {
    const lyricsContainer = lyricsContainerRef.current;
    if (lyricsContainer) {
      lyricsContainer.addEventListener('scroll', memoizedHandleUserScroll);
    }

    return () => {
      if (lyricsContainer) {
        lyricsContainer.removeEventListener('scroll', memoizedHandleUserScroll);
      }
      // Limpiar el timeout al desmontar
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [memoizedHandleUserScroll]);

  // Función para manejar el clic en una línea
  const handleLyricLineClick = useCallback((time: number, index: number) => {
    // Navegar al tiempo indicado
    seekTo(time);

    // También activar el efecto visual
    const element = document.getElementById(`lyric-line-${index}`);
    if (element && lyricsContainerRef.current) {
      // Aplicar efecto visual temporal más notorio y duradero
      element.classList.add('bg-secondary/20', 'scale-110', 'text-white', 'font-bold');

      // Eliminar las clases en secuencia para un efecto más suave
      setTimeout(() => element.classList.remove('scale-110'), 300);
      setTimeout(() => element.classList.remove('bg-secondary/20'), 800);
      setTimeout(() => {
        element.classList.remove('text-white', 'font-bold');
      }, 1000);

      // Hacer scroll a la línea
      const container = lyricsContainerRef.current;
      const elementTop = element.offsetTop;
      const elementHeight = element.clientHeight;
      const containerHeight = container.clientHeight;

      // Scroll simple para centrar el elemento
      container.scrollTo({
        top: elementTop - (containerHeight / 2) + (elementHeight / 2),
        behavior: 'smooth'
      });
    }
  }, [seekTo]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (progressBarRef.current && duration > 0) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const clickPosition = e.clientX - rect.left;
      const percentage = (clickPosition / rect.width);
      const newTime = percentage * duration;
      seekTo(newTime);
    }
  }, [duration, seekTo]);

  const handleToggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      setVolume(localVolume / 100);
    } else {
      setIsMuted(true);
      setVolume(0);
    }
  }, [isMuted, localVolume, setVolume]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setLocalVolume(value);
    setVolume(value / 100);

    if (value === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  }, [isMuted, setVolume]);

  const toggleExpand = useCallback(() => {
    setIsExpanded(prevState => !prevState);
  }, []);

  // Si no hay canción actual, no mostrar el reproductor
  if (!currentTrack) {
    return null;
  }

  // Validar URL de la portada con múltiples opciones de respaldo
  let coverUrl = currentTrack.cover;
  if (!coverUrl) {
    if (currentTrack.albumCover) {
      coverUrl = currentTrack.albumCover;
    } else if (currentTrack.youtubeId) {
      coverUrl = `https://i.ytimg.com/vi/${currentTrack.youtubeId}/hqdefault.jpg`;
    } else {
      coverUrl = placeholderDataUrl;
    }
  }

  return (
    <motion.div
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#0f0f18]/80 backdrop-blur-lg border-t border-white/10"
      style={{ height: isExpanded ? 'auto' : '90px' }}
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100 }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center px-4 h-20">
          {/* Información de la canción */}
          <div className="flex items-center w-1/4">
            <motion.div
              className="relative w-12 h-12 rounded-full overflow-hidden mr-3 shadow-lg"
              whileHover={{ scale: 1.08 }}
              animate={isPlaying ? { rotate: [0, 360] } : { rotate: 0 }}
              transition={isPlaying ?
                { rotate: { repeat: Infinity, duration: 16, ease: "linear" } } :
                { duration: 0.3 }
              }
            >
              <div className="absolute inset-0 bg-black rounded-full opacity-90"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full overflow-hidden border-2 border-gray-800">
                  <img
                    src={coverUrl}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </motion.div>
            <div className="overflow-hidden">
              <motion.h3
                className="font-medium text-sm truncate text-white"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {currentTrack.title}
              </motion.h3>
              <motion.div
                className="text-gray-400 text-xs truncate"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {currentTrack.artist}
              </motion.div>
            </div>
          </div>

          {/* Controles de reproducción */}
          <div className="flex flex-col items-center justify-center flex-1 px-4 space-y-2">
            <div className="flex items-center justify-center space-x-4">
              <motion.button
                className="text-gray-400 hover:text-white"
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                onClick={previousTrack}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
              </motion.button>

              <motion.button
                className="bg-white text-black rounded-full w-8 h-8 flex items-center justify-center"
                onClick={togglePlay}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.3 }}
                >
                  {isPlaying ? (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </motion.div>
              </motion.button>

              <motion.button
                className="text-gray-400 hover:text-white"
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                onClick={nextTrack}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
              </motion.button>
            </div>

            <div className="w-full flex items-center space-x-2">
              <span className="text-gray-400 text-xs w-8 text-right">{currentTimeFormatted}</span>
              <div
                className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden cursor-pointer relative"
                onClick={handleProgressClick}
                ref={progressBarRef}
              >
                <motion.div
                  className="absolute inset-0 flex items-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div
                    className="h-full bg-gradient-to-r from-primary to-secondary"
                    style={{ width: `${progress}%` }}
                  />
                </motion.div>
              </div>
              <span className="text-gray-400 text-xs w-8">{totalTimeFormatted}</span>
            </div>
          </div>

          {/* Controles secundarios */}
          <div className="flex items-center justify-center w-1/4 space-x-4">
            <div className="relative flex items-center justify-center">
              <motion.button
                className="text-gray-400 hover:text-white flex items-center justify-center"
                onClick={handleToggleMute}
                onMouseEnter={() => setIsVolumeVisible(true)}
                onMouseLeave={() => setIsVolumeVisible(false)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                {isMuted || localVolume === 0 ? (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  </svg>
                ) : localVolume < 50 ? (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                )}
              </motion.button>

              <AnimatePresence>
                {isVolumeVisible && (
                  <motion.div
                    className="absolute bottom-full mb-2 bg-gray-800 p-2 rounded-lg shadow-lg"
                    style={{ left: '50%', transform: 'translateX(-50%)' }}
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    onMouseEnter={() => setIsVolumeVisible(true)}
                    onMouseLeave={() => setIsVolumeVisible(false)}
                  >
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={isMuted ? 0 : localVolume}
                      onChange={handleVolumeChange}
                      className="w-24 h-1.5 bg-gray-600 rounded-full appearance-none cursor-pointer"
                      style={{
                        backgroundImage: `linear-gradient(to right, #7C3AED ${isMuted ? 0 : localVolume}%, #475569 ${isMuted ? 0 : localVolume}%)`,
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Botón de reproducción aleatoria */}
            <motion.button
              className={`${isShuffleEnabled ? 'text-primary' : 'text-gray-400'} hover:text-primary flex items-center justify-center`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleShuffle}
              title={isShuffleEnabled ? "Desactivar reproducción aleatoria" : "Activar reproducción aleatoria"}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
              </svg>
            </motion.button>

            {/* Botón de repetición */}
            <motion.button
              className={`${isRepeatEnabled ? 'text-primary' : 'text-gray-400'} hover:text-primary flex items-center justify-center`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleRepeat}
              title={isRepeatEnabled ? "Desactivar repetición" : "Activar repetición"}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
              </svg>
            </motion.button>

            <motion.button
              className="text-gray-400 hover:text-white flex items-center justify-center"
              onClick={toggleExpand}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              {isExpanded ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
                </svg>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Reproductor expandido */}
      {isExpanded && (
        <motion.div
          className="bg-gradient-to-br from-gray-900 to-gray-800 pb-6 border-t border-white/5"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="max-w-5xl mx-auto pt-8 px-4 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Panel izquierdo - Vinilo/Cola de reproducción */}
            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                <div className="flex space-x-2">
                  <button
                    className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                      leftPanelTab === 'vinyl'
                        ? 'bg-white/10 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    onClick={() => setLeftPanelTab('vinyl')}
                  >
                    Vinilo
                  </button>
                  <button
                    className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                      leftPanelTab === 'playlist'
                        ? 'bg-white/10 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    onClick={() => setLeftPanelTab('playlist')}
                  >
                    Cola de reproducción
                  </button>
                </div>
              </div>

              {/* Contenido del panel izquierdo */}
              <div className="flex-1 min-h-[400px]">
                {/* Vista Vinilo */}
                {leftPanelTab === 'vinyl' && (
                  <div className="flex flex-col items-center justify-start h-full">
                    <motion.div
                      className="w-64 h-64 rounded-full overflow-hidden shadow-lg relative mb-6"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{
                        scale: 1,
                        opacity: 1,
                        rotate: isPlaying ? 360 : 0
                      }}
                      transition={{
                        opacity: { duration: 0.3 },
                        scale: { duration: 0.4 },
                        rotate: isPlaying ? { repeat: Infinity, duration: 20, ease: "linear" } : { duration: 0.5 }
                      }}
                    >
                      {/* Fondo y diseño de vinilo */}
                      <div className="absolute inset-0 bg-black rounded-full opacity-90"></div>

                      {/* Surcos del vinilo */}
                      {[...Array(10)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute inset-0 border border-gray-600 rounded-full opacity-30"
                          style={{
                            transform: `scale(${0.95 - i * 0.06})`,
                            borderWidth: '1px'
                          }}
                        ></div>
                      ))}

                      {/* Etiqueta central del vinilo con la portada */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-gray-800 shadow-inner">
                          <img
                            src={coverUrl}
                            alt={currentTrack.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>

                      {/* Agujero central del vinilo */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-5 h-5 rounded-full bg-gray-300 shadow-inner"></div>
                      </div>
                    </motion.div>

                    {/* Visualizador de audio */}
                    <div className="w-full h-20 flex items-center justify-center">
                      {isPlaying ? (
                        <div className="flex items-end space-x-0.5">
                          {Array.from({ length: 32 }).map((_, i) => (
                            <motion.div
                              key={i}
                              className="w-1.5 bg-gradient-to-t from-primary to-secondary rounded-t"
                              animate={{
                                height: Math.sin(i / 3) * 20 +
                                        Math.sin(i / 2) * 15 +
                                        Math.sin(i) * 10 +
                                        30
                              }}
                              transition={{
                                repeat: Infinity,
                                repeatType: "mirror",
                                duration: 0.8 + (i % 4) * 0.2,
                                ease: "easeInOut"
                              }}
                              style={{
                                height: 5 + Math.random() * 30,
                              }}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-500 text-sm">
                          El visualizador se activará al reproducir
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Vista Cola de reproducción */}
                {leftPanelTab === 'playlist' && (
                  <div className="h-full">
                    <div className="bg-gray-800/50 rounded-lg p-3 overflow-y-auto h-[400px]">
                      {playlist && playlist.length > 1 ? (
                        <div className="space-y-2">
                          {playlist.map((track, index) => (
                            <motion.div
                              key={`playlist-item-${track.id}-${index}`}
                              className={`flex items-center p-2 ${currentTrack && currentTrack.id === track.id ? 'bg-white/20' : 'hover:bg-white/10'} rounded-md cursor-pointer group`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              onClick={() => {
                                console.log(`[PlayerBar] Clic en track de playlist: ${track.title}`);
                                if (playlist) playTrack(track);
                              }}
                            >
                              <div className="w-10 h-10 rounded-md overflow-hidden mr-3 bg-gray-700 flex-shrink-0">
                                {track.cover ? (
                                  <img
                                    src={track.cover}
                                    alt={track.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      // Usar Data URL directamente en lugar de solicitar un archivo
                                      const target = e.target as HTMLImageElement;
                                      target.src = placeholderDataUrl;
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center"
                                    style={{
                                      backgroundImage: `url(${placeholderDataUrl})`,
                                      backgroundSize: 'cover'
                                    }}>
                                    <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6zm-2 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{track.title}</p>
                                <p className="text-xs text-gray-400 truncate">{track.artist}</p>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full space-y-4 text-gray-500">
                          <p>No hay más canciones en la cola</p>

                          {/* Botón para regenerar recomendaciones */}
                          {currentTrack && (
                            <motion.button
                              className="bg-primary hover:bg-primary/80 text-white rounded-full py-2 px-4 flex items-center mt-4"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={async () => {
                                if (currentTrack) {
                                  try {
                                    console.log("[PlayerBar] Regenerando recomendaciones para:", currentTrack.title);
                                    await createAutoPlaylist(currentTrack);
                                    // Forzar actualización de la UI
                                    setTimeout(() => {
                                      setLeftPanelTab('vinyl');
                                      setTimeout(() => {
                                        setLeftPanelTab('playlist');
                                      }, 100);
                                    }, 1000);
                                  } catch (error) {
                                    console.error("[PlayerBar] Error al regenerar recomendaciones:", error);
                                  }
                                }
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                              </svg>
                              <span>Regenerar recomendaciones</span>
                            </motion.button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Panel derecho - Letra/Información */}
            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                <div className="flex space-x-2">
                  <button
                    className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                      rightPanelTab === 'lyrics'
                        ? 'bg-white/10 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    onClick={() => setRightPanelTab('lyrics')}
                  >
                    Letra
                  </button>
                  <button
                    className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                      rightPanelTab === 'info'
                        ? 'bg-white/10 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    onClick={() => setRightPanelTab('info')}
                  >
                    Información
                  </button>
                </div>
              </div>

              {/* Contenido del panel derecho */}
              <div className="flex-1 min-h-[400px]">
                {/* Vista Letra */}
                {rightPanelTab === 'lyrics' && (
                  <div className="bg-gray-800/30 rounded-lg p-6 border border-white/5 h-full">
                    <div className="h-[360px] overflow-y-auto lyrics-container px-10" ref={lyricsContainerRef}>
                      {lyrics.isLoading ? (
                        // Estado de carga
                        <div className="flex flex-col items-center justify-center h-full">
                          <div className="w-10 h-10 border-t-2 border-b-2 border-primary rounded-full animate-spin mb-4"></div>
                          <p className="text-gray-400">Cargando letras...</p>
                        </div>
                      ) : lyrics.synced.length > 0 ? (
                        // Mostrar letras sincronizadas
                        <div className="space-y-4 text-gray-300 relative">
                          {/* Indicador de estado de autocentrado */}
                          <div className="flex justify-between items-center mb-4">
                            <button
                              onClick={() => {
                                // Al hacer clic en el botón, simplemente invertimos el estado sin configurar un timeout
                                setAutoScrollEnabled(!autoScrollEnabled);
                                // No activamos el estado de scrolling manual cuando se clickea el botón
                              }}
                              className={`text-xs px-3 py-1 rounded-full transition-colors ${
                                autoScrollEnabled
                                  ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                                  : 'bg-gray-600/20 text-gray-400 hover:bg-gray-600/30'
                              }`}
                            >
                              {autoScrollEnabled ? (
                                <span className="flex items-center">
                                  <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                  </svg>
                                  Auto-centrado
                                </span>
                              ) : (
                                <span className="flex items-center">
                                  <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                                  </svg>
                                  Activar centrado
                                  {/* Solo mostramos el mensaje cuando el scroll es automático y se está reactivando temporalmente */}
                                  {isUserScrolling && scrollTimeoutRef.current && <span className="ml-1 text-yellow-500 text-xs"> (Se reactivará en 3s)</span>}
                                </span>
                              )}
                            </button>
                          </div>

                          {/* Indicador de ayuda para navegación por clic */}
                          <motion.div
                            className="text-xs text-center text-gray-400 mb-6 bg-gray-800/30 py-2 px-3 rounded-lg"
                            initial={{ opacity: 0 }}
                            animate={{
                              opacity: 1,
                              y: [0, -3, 0]
                            }}
                            transition={{
                              opacity: { duration: 0.5 },
                              y: { repeat: 2, duration: 1.5, ease: "easeInOut", delay: 1 }
                            }}
                          >
                            <div className="flex items-center justify-center space-x-2">
                              <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M15.04 12.79l-8.5-8.5c-.39-.39-1.04-.39-1.43 0s-.39 1.04 0 1.43l7.72 7.72-7.72 7.72c-.39.39-.39 1.04 0 1.43.39.39 1.04.39 1.43 0l8.5-8.5c.39-.39.39-1.04 0-1.43z" />
                              </svg>
                              <span>Haz clic en cualquier línea para saltar a ese momento de la canción</span>
                            </div>
                          </motion.div>

                          {/* Lista de líneas de letras */}
                          {lyrics.synced.map((line, index) => {
                            // Verificación simplificada de línea actual
                            const isCurrentLine = index === currentLineIndex;

                            return (
                              <motion.div
                                key={`${line.time}-${index}`}
                                className={`relative transition-all duration-300 text-center py-1.5 ${
                                  isCurrentLine
                                    ? 'text-white font-bold text-lg bg-primary/10 rounded-md pl-6'
                                    : currentTime < line.time ? 'text-gray-600' : 'text-gray-400'
                                } cursor-pointer hover:bg-white/5 hover:scale-105 rounded-lg mx-4`}
                                initial={{ opacity: 0 }}
                                animate={{
                                  opacity: 1,
                                  scale: isCurrentLine ? 1.05 : 1,
                                  textShadow: isCurrentLine ? '0 0 10px rgba(124, 58, 237, 0.6)' : 'none',
                                  backgroundColor: isCurrentLine ? 'rgba(124, 58, 237, 0.08)' : undefined
                                }}
                                transition={{
                                  scale: { type: "spring", stiffness: 300, damping: 30 },
                                  backgroundColor: { duration: 0.3 }
                                }}
                                onClick={() => handleLyricLineClick(line.time, index)}
                                id={`lyric-line-${index}`}
                                data-time={line.time}
                                data-iscurrent={isCurrentLine}
                              >
                                {isCurrentLine && (
                                  <motion.div
                                    className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary"
                                    animate={{
                                      boxShadow: ['0 0 0px rgba(124, 58, 237, 0.3)', '0 0 6px rgba(124, 58, 237, 0.8)', '0 0 0px rgba(124, 58, 237, 0.3)'],
                                      scale: [1, 1.2, 1]
                                    }}
                                    transition={{
                                      boxShadow: { repeat: Infinity, duration: 1.5 },
                                      scale: { repeat: Infinity, duration: 1.5 }
                                    }}
                                  />
                                )}
                                {line.text || "♪"}
                              </motion.div>
                            );
                          })}
                        </div>
                      ) : lyrics.plain ? (
                        // Mostrar letras planas si no hay sincronizadas
                        <div className="text-gray-300 whitespace-pre-line">
                          {lyrics.plain.split('\n').map((line, i) => (
                            <div key={i} className="mb-2">{line || "♪"}</div>
                          ))}
                        </div>
                      ) : (
                        // Mensaje de que no hay letras disponibles
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                          <svg className="w-12 h-12 mb-3 opacity-50" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM16 18H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                          </svg>
                          <div>No hay letras disponibles para esta canción</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Vista Información */}
                {rightPanelTab === 'info' && (
                  <div className="bg-gray-800/30 rounded-lg p-6 border border-white/5 h-full">
                    <div className="h-[360px] overflow-y-auto">
                      <motion.h2
                        className="text-3xl font-bold mb-1 text-white"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        {currentTrack.title}
                      </motion.h2>
                      <motion.h3
                        className="text-xl text-gray-300 mb-4"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                      >
                        {currentTrack.artist}
                      </motion.h3>
                      <motion.div
                        className="text-gray-400 text-sm mb-6"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        Álbum: {currentTrack.album}
                      </motion.div>

                      {/* Información adicional del track */}
                      <div className="space-y-4 text-gray-300">
                        <motion.div
                          className="leading-relaxed"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: isPlaying ? 1 : 0.5 }}
                          transition={{ delay: 0.3 }}
                        >
                          <span className="text-white font-medium">ID de YouTube:</span><br />
                          {currentTrack.youtubeId || "No disponible"}
                        </motion.div>

                        <motion.div
                          className="leading-relaxed"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: isPlaying ? 1 : 0.5 }}
                          transition={{ delay: 0.4 }}
                        >
                          <span className="text-white font-medium">Duración:</span><br />
                          {totalTimeFormatted}
                        </motion.div>
                      </div>

                      {/* Controles adicionales */}
                      <div className="mt-6 flex flex-wrap gap-3">
                        <motion.button
                          className="bg-white/10 hover:bg-white/20 text-white rounded-full py-2 px-4 flex items-center"
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                          Guardar
                        </motion.button>

                        <motion.button
                          className="bg-white/10 hover:bg-white/20 text-white rounded-full py-2 px-4 flex items-center"
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
                          </svg>
                          Compartir
                        </motion.button>

                        <motion.button
                          className="bg-white/10 hover:bg-white/20 text-white rounded-full py-2 px-4 flex items-center"
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                        >
                          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z" />
                          </svg>
                          Añadir a Playlist
                        </motion.button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
