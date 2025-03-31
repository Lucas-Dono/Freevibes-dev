'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Box, Typography, Container, Stack, IconButton, LinearProgress } from '@mui/material';
import { PlayArrow, Pause, SkipNext, SkipPrevious, VolumeUp, VolumeOff, Album } from '@mui/icons-material';
import { usePlayer } from '@/contexts/PlayerContext';

interface MockYouTubePlayerProps {
  showControls?: boolean;
  height?: string | number;
  className?: string;
}

const MockYouTubePlayer: React.FC<MockYouTubePlayerProps> = ({
  showControls = true,
  height = '400px',
  className
}) => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    togglePlay,
    nextTrack,
    previousTrack,
    setVolume,
    seekTo
  } = usePlayer();

  const [isMuted, setIsMuted] = useState(false);
  const storedVolume = useRef(volume);

  // Formatear tiempo en formato mm:ss
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // Manejar cambio de volumen
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  // Manejar el silencio
  const toggleMute = () => {
    if (isMuted) {
      // Restaurar volumen anterior
      setVolume(storedVolume.current > 0 ? storedVolume.current : 50);
      setIsMuted(false);
    } else {
      // Guardar volumen actual antes de silenciar
      storedVolume.current = volume;
      setVolume(0);
      setIsMuted(true);
    }
  };

  // Calcular progreso para la barra
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Manejar clic en la barra de progreso
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    seekTo(newTime);
  };

  // Generar un fondo gradiente aleatorio basado en el título de la canción
  const generateGradient = (title: string) => {
    const hash = title.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    const color1 = `hsl(${Math.abs(hash) % 360}, 70%, 30%)`;
    const color2 = `hsl(${(Math.abs(hash) + 120) % 360}, 70%, 40%)`;
    
    return `linear-gradient(135deg, ${color1}, ${color2})`;
  };

  if (!currentTrack) {
    return (
      <Box 
        className={className}
        sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          height,
          bgcolor: 'background.paper',
          borderRadius: 1,
          p: 2
        }}
      >
        <Typography variant="body1" color="text.secondary">
          No hay canción seleccionada
        </Typography>
      </Box>
    );
  }

  const background = generateGradient(currentTrack.title);

  return (
    <Box 
      className={className} 
      sx={{ 
        height, 
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        background,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
    >
      {/* Mensaje de modo simulado */}
      <Box 
        sx={{ 
          position: 'absolute',
          top: 10,
          right: 10,
          bgcolor: 'rgba(255,255,255,0.2)',
          borderRadius: 1,
          px: 1,
          py: 0.5
        }}
      >
        <Typography variant="caption" sx={{ color: 'white' }}>
          Modo simulado
        </Typography>
      </Box>
      
      {/* Contenido principal */}
      <Box 
        sx={{ 
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          p: 4
        }}
      >
        {/* Ícono de álbum */}
        <Box 
          sx={{ 
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            bgcolor: 'rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 4,
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
            animation: isPlaying ? 'spin 20s linear infinite' : 'none',
            '@keyframes spin': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' }
            }
          }}
        >
          <Album sx={{ fontSize: 100, color: 'rgba(255,255,255,0.8)' }} />
        </Box>
        
        {/* Información de la canción */}
        <Typography variant="h4" align="center" sx={{ color: 'white', mb: 1, fontWeight: 'bold' }}>
          {currentTrack.title}
        </Typography>
        <Typography variant="h6" align="center" sx={{ color: 'rgba(255,255,255,0.8)' }}>
          {currentTrack.artist}
        </Typography>
      </Box>
      
      {/* Controles */}
      {showControls && (
        <Box 
          sx={{ 
            p: 2,
            bgcolor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(10px)'
          }}
        >
          {/* Barra de progreso */}
          <Box 
            sx={{ 
              height: '6px', 
              bgcolor: 'rgba(255,255,255,0.2)',
              cursor: 'pointer',
              mb: 1,
              borderRadius: 3,
              overflow: 'hidden'
            }}
            onClick={handleProgressClick}
          >
            <Box
              sx={{
                height: '100%',
                width: `${progress}%`,
                bgcolor: 'white',
                transition: 'width 0.1s'
              }}
            />
          </Box>
          
          {/* Tiempos */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="body2" sx={{ color: 'white' }}>
              {formatTime(currentTime)}
            </Typography>
            <Typography variant="body2" sx={{ color: 'white' }}>
              {formatTime(duration)}
            </Typography>
          </Box>
          
          {/* Botones de control */}
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton onClick={previousTrack} size="medium" sx={{ color: 'white' }}>
                <SkipPrevious />
              </IconButton>
              
              <IconButton 
                onClick={togglePlay} 
                size="large" 
                sx={{ 
                  mx: 1, 
                  color: 'white',
                  bgcolor: 'rgba(255,255,255,0.2)',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.3)'
                  }
                }}
              >
                {isPlaying ? <Pause /> : <PlayArrow />}
              </IconButton>
              
              <IconButton onClick={nextTrack} size="medium" sx={{ color: 'white' }}>
                <SkipNext />
              </IconButton>
            </Box>
            
            {/* Controles de volumen */}
            <Box sx={{ display: 'flex', alignItems: 'center', width: '120px' }}>
              <IconButton onClick={toggleMute} size="small" sx={{ color: 'white' }}>
                {isMuted || volume === 0 ? <VolumeOff /> : <VolumeUp />}
              </IconButton>
              
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={volume}
                onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                style={{ 
                  width: '80px',
                  accentColor: 'white',
                }}
              />
            </Box>
          </Stack>
        </Box>
      )}
    </Box>
  );
};

export default MockYouTubePlayer; 