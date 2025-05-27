'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import {
  Box,
  IconButton,
  Slider,
  Typography,
  styled,
  Tabs,
  Tab,
  Avatar,
  useTheme,
  Drawer,
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
  Close,
  Share,
  Download,
  MoreVert,
  ExpandLess,
} from '@mui/icons-material';
import { usePlayer } from '@/contexts/PlayerContext';

// Contenedor principal del reproductor móvil (fijo, no draggeable)
const PlayerBarContainer = styled(Box)(({ theme }) => ({
  height: '65px',
  backgroundColor: 'rgba(15, 15, 24, 0.95)',
  backdropFilter: 'blur(10px)',
  borderTop: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(0, 1),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  position: 'fixed',
  bottom: '4.5rem',
  left: 0,
  right: 0,
  zIndex: 40,
  color: 'white',
  transition: 'all 0.3s ease',
  cursor: 'pointer',
}));

// Componente para la barra de progreso
const ProgressBar = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  width: '100%',
  height: 3,
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  zIndex: 2,
}));

// Overlay del reproductor expandido (fijo, no draggeable)
const ExpandedPlayerOverlay = styled(Box)(({ theme }) => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(15, 15, 24, 0.98)',
  backdropFilter: 'blur(20px)',
  zIndex: 3000,
  display: 'flex',
  flexDirection: 'column',
  color: 'white',
}));

// Slider personalizado con colores modernos
const StyledSlider = styled(Slider)(({ theme }) => ({
  color: theme.palette.secondary.main,
  height: 12,
  padding: 0,
  minHeight: 0,
  '& .MuiSlider-thumb': {
    width: 10,
    height: 10,
    transition: '0.3s cubic-bezier(.47,1.64,.41,.8)',
    '&::before': {
      boxShadow: '0 2px 12px 0 rgba(0,0,0,0.4)',
    },
    '&:hover, &.Mui-focusVisible': {
      boxShadow: `0px 0px 0px 8px ${theme.palette.mode === 'dark' ? 'rgb(128 25 167 / 16%)' : 'rgb(128 25 167 / 16%)'}`,
    },
    '&.Mui-active': {
      width: 12,
      height: 12,
    },
  },
  '& .MuiSlider-rail': {
    opacity: 0.28,
    height: 3,
  },
  '& .MuiSlider-track': {
    height: 3,
  },
  '@media (pointer: coarse)': {
    padding: 0,
    minHeight: 0,
    height: 12,
  }
}));

// Función para formatear tiempo en formato mm:ss
const formatTime = (seconds: number): string => {
  // Manejar valores inválidos o indefinidos
  if (!seconds || isNaN(seconds) || seconds <= 0) {
    return '--:--';
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const MobilePlayerBar: React.FC = () => {
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
    lyrics
  } = usePlayer();

  const theme = useTheme();

  // Estados locales
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [localVolume, setLocalVolume] = useState(contextVolume * 100);
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(30); // Porcentaje de altura

  // Referencias
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  // Calcular progreso actual
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Formateamos los tiempos para la UI
  const currentTimeFormatted = formatTime(currentTime);
  const totalTimeFormatted = formatTime(duration);

  // Actualizar volumen cuando cambia en el contexto
  useEffect(() => {
    setLocalVolume(contextVolume * 100);
  }, [contextVolume]);

  // Detectar la línea actual basado en el tiempo actual
  useEffect(() => {
    if (!lyrics.synced.length) return;

    const offsetTime = currentTime + 0.2;
    let foundIndex = null;

    for (let i = 0; i < lyrics.synced.length; i++) {
      const currentLine = lyrics.synced[i];
      const nextLine = i < lyrics.synced.length - 1 ? lyrics.synced[i + 1] : null;

      if (nextLine) {
        if (offsetTime >= currentLine.time && offsetTime < nextLine.time) {
          foundIndex = i;
          break;
        }
      } else {
        if (offsetTime >= currentLine.time) {
          foundIndex = i;
        }
      }
    }

    if (foundIndex !== null && foundIndex !== currentLineIndex) {
      setCurrentLineIndex(foundIndex);

      if (lyricsContainerRef.current && bottomSheetOpen) {
        const lineElement = document.getElementById(`lyric-line-${foundIndex}`);
        if (lineElement) {
          lineElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }
    }
  }, [currentTime, lyrics.synced, currentLineIndex, bottomSheetOpen]);

  // Manejar el cambio de tabs
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Manejar cambios en la barra de progreso
  const handleProgressChange = (_: Event, newValue: number | number[]) => {
    const newTime = ((newValue as number) / 100) * duration;
    seekTo(newTime);
  };

  // Manejar cambios de volumen
  const handleVolumeChange = (_: Event, newValue: number | number[]) => {
    const newVolume = (newValue as number) / 100;
    setLocalVolume(newValue as number);
    setVolume(newVolume);
  };

  // Alternar favorito
  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
  };

  // Expandir el reproductor
  const expandPlayer = () => {
    setIsExpanded(true);
  };

  // Cerrar el reproductor expandido
  const closeExpandedPlayer = () => {
    setIsExpanded(false);
    setBottomSheetOpen(false);
  };

  // Manejar el drag del bottom sheet
  const handleDrag = (_: any, info: PanInfo) => {
    const windowHeight = window.innerHeight;
    const dragY = info.offset.y;
    const currentHeightPx = (sheetHeight / 100) * windowHeight;
    const newHeightPx = Math.max(windowHeight * 0.2, Math.min(windowHeight * 0.9, currentHeightPx - dragY));
    const newHeightPercent = (newHeightPx / windowHeight) * 100;
    setSheetHeight(newHeightPercent);
  };

  // Manejar el final del drag
  const handleDragEnd = (_: any, info: PanInfo) => {
    const velocity = info.velocity.y;
    
    if (velocity > 500) {
      // Arrastrar hacia abajo rápido - cerrar
      setBottomSheetOpen(false);
    } else if (velocity < -500) {
      // Arrastrar hacia arriba rápido - expandir
      setSheetHeight(90);
    } else {
      // Snap a posiciones predefinidas
      if (sheetHeight < 40) {
        setSheetHeight(30);
      } else if (sheetHeight < 70) {
        setSheetHeight(60);
      } else {
        setSheetHeight(90);
      }
    }
  };

  // Elimino logs anteriores y agrego nuevos logs de depuración
  useEffect(() => {
    console.log('[DEBUG-MPB] MobilePlayerBar MONTADO');
    return () => {
      console.log('[DEBUG-MPB] MobilePlayerBar DESMONTADO');
    };
  }, []);

  // Log específico cuando cambia la playlist
  useEffect(() => {
    console.log('[DEBUG-MPB] Playlist cambió, nueva length:', playlist.length);
    console.log('[DEBUG-MPB] Playlist tracks:', playlist.map(t => t.title));
  }, [playlist]);

  console.log('[DEBUG-MPB] Render, isExpanded:', isExpanded);
  console.log('[DEBUG-MPB] Playlist length:', playlist.length);
  console.log('[DEBUG-MPB] Current track:', currentTrack?.title);
  console.log('[DEBUG-MPB] Playlist tracks:', playlist.map(t => t.title));

  // Si no hay canción actual, no mostrar nada
  if (!currentTrack) return null;

  // URL de la portada por defecto o proporcionada
  const coverUrl = currentTrack.cover || 'https://placehold.co/600x600/1a1a2e/FFFFFF?text=No+Image';

  return (
    <>
      {/* Barra de reproductor fija (no draggeable) */}
      <PlayerBarContainer onClick={expandPlayer}>
        {/* Barra de progreso */}
        <ProgressBar>
          <StyledSlider
            value={progress}
            onChange={handleProgressChange}
            aria-label="Progress"
            sx={{
              position: 'absolute',
              top: -8,
              left: 0,
              right: 0,
              height: 16,
              '& .MuiSlider-thumb': {
                width: 12,
                height: 12,
                opacity: 0,
                transition: 'opacity 0.2s',
                '&:hover, &.Mui-focusVisible, &.Mui-active': {
                  opacity: 1,
                  boxShadow: '0px 0px 0px 8px rgba(128, 25, 167, 0.16)',
                },
              },
              '& .MuiSlider-track': {
                height: 5,
                border: 'none',
              },
              '& .MuiSlider-rail': {
                height: 5,
                opacity: 0.3,
              },
            }}
          />
        </ProgressBar>

        <motion.div
          className="w-full flex items-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Portada e información de la canción (40%) */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              width: '40%',
              overflow: 'hidden',
            }}
          >
            <div className="relative w-10 h-10 rounded-md overflow-hidden mr-3 shadow-lg">
              <img
                src={coverUrl}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
            </div>
            <Box sx={{ overflow: 'hidden', flex: 1 }}>
              <Typography noWrap variant="body2" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
                {currentTrack.title}
              </Typography>
              <Typography noWrap variant="caption" color="text.secondary" sx={{ lineHeight: 1.1 }}>
                {currentTrack.artist}
              </Typography>
            </Box>
          </Box>

          {/* Controles de reproducción (60%) */}
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '60%', gap: 1 }}>
            <IconButton onClick={e => { e.stopPropagation(); previousTrack(); }} color="inherit" size="small">
              <SkipPrevious />
            </IconButton>
            <IconButton
              onClick={e => { e.stopPropagation(); togglePlay(); }}
              color="secondary"
              sx={{
                backgroundColor: 'secondary.main',
                color: 'black',
                width: 36,
                height: 36,
                minWidth: 36,
                minHeight: 36,
                '&:hover': {
                  backgroundColor: 'secondary.light',
                },
                '&:active': {
                  transform: 'scale(0.95)',
                },
                transition: 'background-color 0.2s, transform 0.1s',
              }}
            >
              {isPlaying ? <Pause /> : <PlayArrow />}
            </IconButton>
            <IconButton onClick={e => { e.stopPropagation(); nextTrack(); }} color="inherit" size="small">
              <SkipNext />
            </IconButton>
          </Box>
        </motion.div>
      </PlayerBarContainer>

      {/* Overlay del reproductor expandido (fijo, no draggeable) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 15, 24, 0.98)',
              zIndex: 3000,
              display: 'flex',
              flexDirection: 'column',
              color: 'white'
            }}
          >
            <ExpandedPlayerOverlay>
              {/* Header con botón de cerrar */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
                  <Box sx={{ flex: 1 }} />
                  <Box
                    sx={{
                      width: 40,
                      height: 4,
                      backgroundColor: 'rgba(255, 255, 255, 0.3)',
                      borderRadius: 2,
                      mx: 'auto',
                    }}
                  />
                  <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                    <IconButton
                      edge="end"
                      color="inherit"
                      onClick={closeExpandedPlayer}
                      size="small"
                    >
                      <Close />
                    </IconButton>
                  </Box>
                </Box>
              </motion.div>

              {/* Contenido fijo del reproductor */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', px: 2 }}>
                {/* Portada grande */}
                <motion.div
                  className="mx-auto mb-6 relative"
                  initial={{ scale: 0.8, opacity: 0, y: 30 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                  style={{ width: '70%', maxWidth: 280, aspectRatio: '1/1' }}
                >
                  <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl">
                    <img
                      src={coverUrl}
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </motion.div>

                {/* Información de la canción */}
                <motion.div
                  className="text-center mb-6"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    {currentTrack.title}
                  </Typography>
                  <Typography variant="subtitle1" color="text.secondary">
                    {currentTrack.artist}
                  </Typography>
                </motion.div>

                {/* Barra de progreso */}
                <motion.div
                  className="px-4 mb-6"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.4 }}
                >
                  <StyledSlider
                    value={progress}
                    onChange={handleProgressChange}
                    aria-label="Progress"
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {currentTimeFormatted}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {totalTimeFormatted}
                    </Typography>
                  </Box>
                </motion.div>

                {/* Controles principales */}
                <motion.div
                  className="flex justify-center items-center space-x-8 mb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.6 }}
                  >
                    <IconButton color="inherit">
                      <Shuffle />
                    </IconButton>
                  </motion.div>
                  
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.65 }}
                  >
                    <IconButton onClick={previousTrack} color="inherit">
                      <SkipPrevious sx={{ fontSize: 32 }} />
                    </IconButton>
                  </motion.div>
                  
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.7 }}
                  >
                    <IconButton
                      onClick={togglePlay}
                      sx={{
                        backgroundColor: 'secondary.main',
                        color: 'black',
                        p: 1.5,
                        boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                        '&:hover': {
                          backgroundColor: 'secondary.light'
                        }
                      }}
                    >
                      {isPlaying ? <Pause sx={{ fontSize: 32 }} /> : <PlayArrow sx={{ fontSize: 32 }} />}
                    </IconButton>
                  </motion.div>
                  
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.65 }}
                  >
                    <IconButton onClick={nextTrack} color="inherit">
                      <SkipNext sx={{ fontSize: 32 }} />
                    </IconButton>
                  </motion.div>
                  
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.6 }}
                  >
                    <IconButton color="inherit">
                      <Repeat />
                    </IconButton>
                  </motion.div>
                </motion.div>

                {/* Botón para abrir bottom sheet */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.8 }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                    <IconButton
                      onClick={() => setBottomSheetOpen(true)}
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        },
                      }}
                    >
                      <ExpandLess />
                    </IconButton>
                  </Box>
                </motion.div>
              </Box>
            </ExpandedPlayerOverlay>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Sheet personalizado draggeable */}
      <Drawer
        anchor="bottom"
        open={bottomSheetOpen}
        onClose={() => setBottomSheetOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            height: `${sheetHeight}vh`,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            backgroundColor: 'rgba(15, 15, 24, 0.98)',
            backdropFilter: 'blur(20px)',
            overflow: 'hidden',
          },
          '& .MuiBackdrop-root': {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          },
        }}
      >
        <motion.div
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.1}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        >
          {/* Handle para arrastrar */}
          <Box sx={{ p: 2, textAlign: 'center', cursor: 'grab' }}>
            <Box
              sx={{
                width: 40,
                height: 4,
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                borderRadius: 2,
                mx: 'auto',
                mb: 2,
              }}
            />
            
            {/* Pestañas */}
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              centered
              variant="fullWidth"
              sx={{
                '& .MuiTab-root': { color: 'rgba(255,255,255,0.7)' },
                '& .Mui-selected': { color: 'white' },
                '& .MuiTabs-indicator': { backgroundColor: theme.palette.secondary.main }
              }}
            >
              <Tab label="Letras" />
              <Tab label="Lista" />
              <Tab label="Opciones" />
            </Tabs>
          </Box>

          {/* Contenido */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2, color: 'white' }}>
            {/* Contenido según la pestaña activa */}
            {activeTab === 0 && (
              <div
                className="lyrics-container h-full overflow-y-auto"
                ref={lyricsContainerRef}
              >
                {lyrics.isLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <Typography variant="body2" textAlign="center" color="text.secondary">
                      Cargando letras...
                    </Typography>
                  </Box>
                ) : lyrics.synced.length > 0 ? (
                  lyrics.synced.map((line, index) => (
                    <motion.div
                      key={`${index}-${line.time}`}
                      id={`lyric-line-${index}`}
                      initial={{ opacity: 0.7 }}
                      animate={{
                        opacity: currentLineIndex === index ? 1 : 0.7,
                        scale: currentLineIndex === index ? 1.02 : 1
                      }}
                      transition={{ duration: 0.3 }}
                      className="my-4 text-center"
                    >
                      <Typography
                        variant="body1"
                        sx={{
                          fontWeight: currentLineIndex === index ? 'bold' : 'normal',
                          color: currentLineIndex === index ? 'white' : 'text.secondary'
                        }}
                      >
                        {line.text}
                      </Typography>
                    </motion.div>
                  ))
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <Typography variant="body2" textAlign="center" color="text.secondary">
                      No hay letras disponibles para esta canción.
                    </Typography>
                  </Box>
                )}
              </div>
            )}

            {activeTab === 1 && (
              <Box sx={{ height: '100%', overflow: 'auto' }}>
                {(() => {
                  console.log('[DEBUG-MPB] Renderizando pestaña Lista, playlist length:', playlist.length);
                  console.log('[DEBUG-MPB] Playlist completa:', playlist);
                  console.log('[DEBUG-MPB] activeTab:', activeTab);
                  console.log('[DEBUG-MPB] isExpanded:', isExpanded);
                  return null;
                })()}
                {playlist.length === 0 ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                    <Typography variant="body2" color="text.secondary">
                      No hay canciones en la lista de reproducción
                    </Typography>
                  </Box>
                ) : (
                  playlist.map((track, index) => (
                    <motion.div
                      key={track.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                      className={`flex items-center p-2 mb-2 rounded-lg ${
                        currentTrack.id === track.id ? 'bg-secondary-main bg-opacity-20' : ''
                      }`}
                      onClick={() => playTrack(track)}
                      style={{ cursor: 'pointer' }}
                    >
                      <Avatar
                        src={track.cover}
                        variant="rounded"
                        sx={{ width: 42, height: 42, mr: 2 }}
                      />
                      <div className="flex-1 min-w-0">
                        <Typography variant="body2" noWrap>
                          {track.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {track.artist}
                        </Typography>
                      </div>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {formatTime(track.duration)}
                      </Typography>
                    </motion.div>
                  ))
                )}
              </Box>
            )}

            {activeTab === 2 && (
              <motion.div
                className="h-full flex flex-col space-y-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Box
                  className="flex items-center justify-between p-3 rounded-lg"
                  sx={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                >
                  <Typography variant="body2">Me gusta</Typography>
                  <IconButton onClick={toggleFavorite} color="inherit">
                    {isFavorite ? <Favorite color="error" /> : <FavoriteBorder />}
                  </IconButton>
                </Box>

                <Box
                  className="flex items-center justify-between p-3 rounded-lg"
                  sx={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                >
                  <Typography variant="body2">Compartir</Typography>
                  <IconButton color="inherit">
                    <Share />
                  </IconButton>
                </Box>

                <Box
                  className="flex items-center justify-between p-3 rounded-lg"
                  sx={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                >
                  <Typography variant="body2">Descargar</Typography>
                  <IconButton color="inherit">
                    <Download />
                  </IconButton>
                </Box>

                <Box
                  className="flex items-center justify-between p-3 rounded-lg"
                  sx={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                >
                  <Typography variant="body2">Volumen</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: 120 }}>
                    <IconButton color="inherit" size="small">
                      {localVolume === 0 ? <VolumeOff /> : <VolumeUp />}
                    </IconButton>
                    <StyledSlider
                      value={localVolume}
                      onChange={handleVolumeChange}
                      aria-label="Volume"
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  </Box>
                </Box>

                <Box
                  className="flex items-center justify-between p-3 rounded-lg"
                  sx={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                >
                  <Typography variant="body2">Más opciones</Typography>
                  <IconButton color="inherit">
                    <MoreVert />
                  </IconButton>
                </Box>
              </motion.div>
            )}
          </Box>
        </motion.div>
      </Drawer>
    </>
  );
};
