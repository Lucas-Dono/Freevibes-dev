'use client';

import React, { useEffect, useState } from 'react';
import { Box, IconButton, LinearProgress, Typography, Stack } from '@mui/material';
import { PlayArrow, Pause, SkipNext, SkipPrevious, VolumeUp, VolumeOff } from '@mui/icons-material';
import { usePlayer } from '@/contexts/PlayerContext';

interface YouTubePlayerProps {
  showControls?: boolean;
  height?: string | number;
  className?: string;
}

const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
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

  // Manejar cambio de volumen
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  // Manejar toggleMute
  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (volume === 0) setVolume(0.5);
    } else {
      setIsMuted(true);
      setVolume(0);
    }
  };

  // Función para formatear el tiempo en minutos:segundos
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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

  return (
    <Box className={className} sx={{ height, position: 'relative' }}>
      {/* Contenedor oculto donde se cargará el iframe de YouTube */}
      <Box id="youtube-player-visible" sx={{ height: '100%', width: '100%' }} />

      {/* Controles del reproductor */}
      {showControls && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            bgcolor: 'rgba(0,0,0,0.6)',
            p: 1,
            backdropFilter: 'blur(5px)'
          }}
        >
          {/* Barra de progreso */}
          <Box
            sx={{
              height: '4px',
              bgcolor: 'background.paper',
              cursor: 'pointer',
              mb: 1,
              borderRadius: 1,
              overflow: 'hidden'
            }}
            onClick={handleProgressClick}
          >
            <Box
              sx={{
                height: '100%',
                width: `${progress}%`,
                bgcolor: 'primary.main',
                transition: 'width 0.1s'
              }}
            />
          </Box>

          {/* Tiempos */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {formatTime(currentTime)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatTime(duration)}
            </Typography>
          </Box>

          {/* Botones de control */}
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton onClick={previousTrack} size="small" color="primary">
                <SkipPrevious />
              </IconButton>

              <IconButton onClick={togglePlay} size="medium" color="primary" sx={{ mx: 1 }}>
                {isPlaying ? <Pause /> : <PlayArrow />}
              </IconButton>

              <IconButton onClick={nextTrack} size="small" color="primary">
                <SkipNext />
              </IconButton>
            </Box>

            {/* Controles de volumen */}
            <Box sx={{ display: 'flex', alignItems: 'center', width: '120px' }}>
              <IconButton onClick={handleToggleMute} size="small">
                {isMuted || volume === 0 ? <VolumeOff /> : <VolumeUp />}
              </IconButton>

              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                style={{ width: '80px' }}
              />
            </Box>
          </Stack>
        </Box>
      )}

      {/* Información de la canción actual */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          p: 2,
          color: 'white',
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          pointerEvents: 'none'
        }}
      >
        <Typography variant="h6" fontWeight="bold">
          {currentTrack.title}
        </Typography>
        <Typography variant="body2">
          {currentTrack.artist}
        </Typography>
      </Box>
    </Box>
  );
};

export default YouTubePlayer;
