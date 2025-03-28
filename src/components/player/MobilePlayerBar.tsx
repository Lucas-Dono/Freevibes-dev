'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  IconButton,
  Slider,
  Typography,
  styled,
  SwipeableDrawer,
  Tabs,
  Tab,
  Avatar,
  useTheme,
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
} from '@mui/icons-material';
import { usePlayer } from '@/contexts/PlayerContext';

// Contenedor principal del reproductor móvil
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
  bottom: 0,
  left: 0, 
  right: 0,
  zIndex: 100,
  color: 'white',
  transition: 'all 0.3s ease',
}));

// Componente para la barra de progreso
const ProgressBar = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: -2,
  left: 0,
  right: 0,
  height: 2,
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
}));

// Estilo para panel expandido
const ExpandedPanel = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  padding: theme.spacing(2),
  background: 'linear-gradient(180deg, rgba(15, 15, 24, 0.95) 0%, rgba(26, 26, 46, 0.98) 100%)',
  height: '100%',
  overflow: 'hidden',
  position: 'relative',
}));

// Slider personalizado con colores modernos
const StyledSlider = styled(Slider)(({ theme }) => ({
  color: theme.palette.secondary.main,
  height: 4,
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
  },
}));

// Función para formatear tiempo en formato mm:ss
const formatTime = (seconds: number): string => {
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [localVolume, setLocalVolume] = useState(contextVolume * 100);
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState<number | null>(null);

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
      } else {
        // Si es la última línea y ha pasado su tiempo
        if (offsetTime >= currentLine.time) {
          foundIndex = i;
        }
      }
    }
    
    // Si encontramos una línea válida y es diferente a la actual
    if (foundIndex !== null && foundIndex !== currentLineIndex) {
      setCurrentLineIndex(foundIndex);
      
      // Auto-scroll a la línea actual
      if (lyricsContainerRef.current && drawerOpen) {
        const lineElement = document.getElementById(`lyric-line-${foundIndex}`);
        
        if (lineElement) {
          lineElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }
    }
  }, [currentTime, lyrics.synced, currentLineIndex, drawerOpen]);
  
  // Controlar el drawer
  const toggleDrawer = (open: boolean) => {
    setDrawerOpen(open);
  };
  
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
  
  // Si no hay canción actual, no mostrar nada
  if (!currentTrack) return null;
  
  // URL de la portada por defecto o proporcionada
  const coverUrl = currentTrack.cover || 'https://placehold.co/600x600/1a1a2e/FFFFFF?text=No+Image';
  
  return (
    <>
      {/* Barra de reproductor fija en la parte inferior */}
      <PlayerBarContainer>
        {/* Barra de progreso en la parte superior */}
        <ProgressBar>
          <motion.div
            style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: theme.palette.secondary.main,
            }}
            transition={{ duration: 0.1 }}
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
              cursor: 'pointer'
            }}
            onClick={() => toggleDrawer(true)}
          >
            <motion.div 
              className="relative w-10 h-10 rounded-md overflow-hidden mr-3 shadow-lg"
              animate={isPlaying ? { rotate: [0, 360] } : { rotate: 0 }}
              transition={isPlaying ? 
                { rotate: { repeat: Infinity, duration: 20, ease: "linear" } } : 
                { duration: 0.3 }
              }
            >
              <img 
                src={coverUrl} 
                alt={currentTrack.title} 
                className="w-full h-full object-cover" 
              />
            </motion.div>
            
            <Box sx={{ overflow: 'hidden' }}>
              <Typography noWrap variant="body2" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
                {currentTrack.title}
              </Typography>
              <Typography noWrap variant="caption" color="text.secondary" sx={{ lineHeight: 1.1 }}>
                {currentTrack.artist}
              </Typography>
            </Box>
          </Box>
          
          {/* Botón de reproducción central (20%) */}
          <Box sx={{ display: 'flex', justifyContent: 'center', width: '20%' }}>
            <IconButton 
              onClick={togglePlay} 
              color="secondary"
              sx={{ 
                backgroundColor: 'secondary.main', 
                color: 'black', 
                width: 36, 
                height: 36,
                boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
                '&:hover': {
                  backgroundColor: 'secondary.light',
                }
              }}
            >
              {isPlaying ? <Pause /> : <PlayArrow />}
            </IconButton>
          </Box>
          
          {/* Controles adicionales (40%) */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '40%', alignItems: 'center' }}>
            <IconButton onClick={previousTrack} color="inherit" size="small">
              <SkipPrevious />
            </IconButton>
            
            <IconButton onClick={nextTrack} color="inherit" size="small">
              <SkipNext />
            </IconButton>
            
            <IconButton onClick={toggleFavorite} color="inherit" size="small">
              {isFavorite ? <Favorite color="error" /> : <FavoriteBorder />}
            </IconButton>
          </Box>
        </motion.div>
      </PlayerBarContainer>
      
      {/* Panel expandido (Drawer) */}
      <SwipeableDrawer
        anchor="bottom"
        open={drawerOpen}
        onClose={() => toggleDrawer(false)}
        onOpen={() => toggleDrawer(true)}
        disableSwipeToOpen
        sx={{
          '& .MuiDrawer-paper': {
            height: 'calc(100% - 10px)',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            overflow: 'hidden'
          },
        }}
      >
        <ExpandedPanel>
          {/* Cabecera con botón de cierre */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
            <IconButton 
              edge="end" 
              color="inherit" 
              onClick={() => toggleDrawer(false)}
              size="small"
            >
              <Close />
            </IconButton>
          </Box>
          
          {/* Portada grande animada */}
          <motion.div
            className="mx-auto mb-6 relative"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            style={{ width: '70%', maxWidth: 280, aspectRatio: '1/1' }}
          >
            <motion.div
              className="w-full h-full rounded-2xl overflow-hidden shadow-2xl"
              animate={isPlaying ? { rotate: 360 } : { rotate: 0 }}
              transition={isPlaying ? 
                { rotate: { repeat: Infinity, duration: 20, ease: "linear" } } : 
                { duration: 0.5 }
              }
            >
              <img 
                src={coverUrl} 
                alt={currentTrack.title} 
                className="w-full h-full object-cover" 
              />
              
              {/* Efecto de vinilo/disco cuando gira */}
              {isPlaying && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'radial-gradient(circle, transparent 58%, rgba(0,0,0,0.3) 60%, transparent 62%)',
                    mixBlendMode: 'overlay',
                  }}
                />
              )}
            </motion.div>
            
            {/* Reflejo/sombra decorativa debajo de la portada */}
            <div 
              className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-3/4 h-10 rounded-full opacity-15"
              style={{ 
                background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%)',
                filter: 'blur(8px)'
              }}
            />
          </motion.div>
          
          {/* Información de la canción */}
          <motion.div 
            className="text-center mb-6"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <IconButton color="inherit">
              <Shuffle />
            </IconButton>
            
            <IconButton onClick={previousTrack} color="inherit">
              <SkipPrevious sx={{ fontSize: 32 }} />
            </IconButton>
            
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
            
            <IconButton onClick={nextTrack} color="inherit">
              <SkipNext sx={{ fontSize: 32 }} />
            </IconButton>
            
            <IconButton color="inherit">
              <Repeat />
            </IconButton>
          </motion.div>
          
          {/* Pestañas para contenido adicional */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
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
          
          {/* Contenido según la pestaña activa */}
          <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
            {/* Pestaña de letras */}
            {activeTab === 0 && (
              <div 
                className="lyrics-container h-full overflow-y-auto px-2"
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
            
            {/* Pestaña de lista de reproducción */}
            {activeTab === 1 && (
              <Box sx={{ height: '100%', overflow: 'auto' }}>
                {playlist.map((track, index) => (
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
                ))}
              </Box>
            )}
            
            {/* Pestaña de opciones */}
            {activeTab === 2 && (
              <motion.div 
                className="h-full flex flex-col space-y-3 p-2"
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
        </ExpandedPanel>
      </SwipeableDrawer>
    </>
  );
}; 