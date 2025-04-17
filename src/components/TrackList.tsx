'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardMedia, IconButton, useTheme } from '@mui/material';
import { PlayArrow, Favorite, MoreVert } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayer } from '@/contexts/PlayerContext';
import { Track, Artist } from '@/types/types';

interface TrackListProps {
  tracks: Track[];
  onPlayTrack?: (track: Track) => void;
}

// Datos de ejemplo para cuando no hay tracks reales
const exampleTracks: Track[] = [
  {
    id: 'example-1',
    title: 'Ejemplo Track 1',
    artist: 'Artista Ejemplo',
    album: 'Album Ejemplo 1',
    cover: 'https://via.placeholder.com/80',
    duration: 180,
    source: 'example'
  },
  {
    id: 'example-2',
    title: 'Ejemplo Track 2',
    artist: 'Otro Artista',
    album: 'Album Ejemplo 2',
    cover: 'https://via.placeholder.com/80',
    duration: 210,
    source: 'example'
  }
];

export function TrackList({ tracks, onPlayTrack }: TrackListProps) {
  const theme = useTheme();
  const displayTracks = (!tracks || tracks.length === 0) ? exampleTracks : tracks;
  const { playTrack, addToQueue, createAutoPlaylist } = usePlayer();
  
  // Estados para el menú contextual
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    visible: boolean;
    trackId: string;
  }>({
    mouseX: 0,
    mouseY: 0,
    visible: false,
    trackId: '',
  });
  
  // Función para abrir el menú contextual
  const handleContextMenu = (event: React.MouseEvent, trackId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      mouseX: event.clientX,
      mouseY: event.clientY,
      visible: true,
      trackId,
    });
  };
  
  // Función para cerrar el menú contextual
  const handleCloseContextMenu = () => {
    setContextMenu({
      ...contextMenu,
      visible: false,
    });
  };
  
  // Escuchar clicks fuera del menú para cerrarlo
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        handleCloseContextMenu();
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu.visible]);
  
  // Convertir track a formato compatible con PlayerContext
  const convertToAppTrack = (track: Track): Track => {
    return {
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      cover: track.cover,
      duration: track.duration,
      source: track.source,
      youtubeId: track.youtubeId,
      spotifyId: track.spotifyId,
      sourceUrl: track.sourceUrl,
      albumCover: track.albumCover,
      artistId: track.artistId,
      albumId: track.albumId,
      weight: track.weight,
      sourceData: track.sourceData,
      thumbnail: track.thumbnail,
      spotifyCoverUrl: track.spotifyCoverUrl,
      language: track.language,
      subregion: track.subregion,
      color: track.color
    };
  };
  
  // Manejadores de acciones del menú contextual
  const handlePlayNow = (trackId: string) => {
    const track = displayTracks.find(t => t.id === trackId);
    if (track) {
      if (onPlayTrack) {
        onPlayTrack(track);
      } else {
        playTrack(convertToAppTrack(track));
      }
    }
    handleCloseContextMenu();
  };
  
  const handleAddToQueue = (trackId: string) => {
    const track = displayTracks.find(t => t.id === trackId);
    if (track) {
      addToQueue(convertToAppTrack(track));
    }
    handleCloseContextMenu();
  };
  
  const handleCreateRadio = (trackId: string) => {
    const track = displayTracks.find(t => t.id === trackId);
    if (track) {
      createAutoPlaylist(convertToAppTrack(track))
        .then(() => console.log('Radio creada con éxito'))
        .catch(err => console.error('Error al crear radio:', err));
    }
    handleCloseContextMenu();
  };
  
  const handleGoToArtist = (trackId: string) => {
    const track = displayTracks.find(t => t.id === trackId);
    if (track) {
      const artistName = track.artist;
      if (artistName) {
        window.location.href = `/search?q=${encodeURIComponent(artistName)}&type=artist`;
      } else {
        console.warn("Cannot navigate to artist, name not found.");
      }
    }
    handleCloseContextMenu();
  };
  
  const handleOpenInSpotify = (trackId: string) => {
    if (trackId.length === 22) {
      window.open(`https://open.spotify.com/track/${trackId}`, '_blank');
    }
    handleCloseContextMenu();
  };

  const formatDuration = (durationInSeconds?: number) => {
    if (durationInSeconds === undefined || durationInSeconds === null || isNaN(durationInSeconds)) return '--:--';
    const minutes = Math.floor(durationInSeconds / 60);
    const seconds = Math.floor(durationInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Función auxiliar para obtener la URL de la imagen
  const getImageUrl = (track: Track): string => {
    return track.cover || track.albumCover || track.thumbnail || 'https://via.placeholder.com/80';
  };

  // Función auxiliar para obtener el nombre del artista
  const getArtistName = (track: Track): string => {
    return track.artist || 'Artista desconocido';
  };

  // Función auxiliar para obtener el título de la canción
  const getTrackTitle = (track: Track): string => {
    return track.title || 'Pista sin título';
  };

  return (
    <Grid container spacing={2}>
      {displayTracks.map((track) => (
        <Grid item xs={12} key={track.id}>
          <Card 
            sx={{ 
              display: 'flex',
              backgroundColor: 'background.paper',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              },
              borderRadius: 2
            }}
            variant="outlined"
            onContextMenu={(e) => handleContextMenu(e, track.id)}
          >
            <CardMedia
              component="img"
              sx={{ width: 60, height: 60 }}
              image={getImageUrl(track)}
              alt={getTrackTitle(track)}
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: '1 0 auto', justifyContent: 'center', px: 2 }}>
              <Typography component="div" variant="subtitle1">
                {getTrackTitle(track)}
              </Typography>
              <Typography variant="subtitle2" color="text.secondary" component="div">
                {getArtistName(track)}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', pr: 2 }}>
              <IconButton 
                aria-label="play/pause"
                onClick={() => {
                  if (onPlayTrack) {
                    onPlayTrack(track);
                  } else {
                    playTrack(convertToAppTrack(track));
                  }
                }}
                sx={{ 
                  color: theme.palette.primary.main,
                  '&:hover': { color: theme.palette.primary.light }
                }}
              >
                <PlayArrow />
              </IconButton>
              <IconButton 
                aria-label="add to favorites"
                sx={{ 
                  color: 'text.secondary',
                  '&:hover': { color: '#e25555' }
                }}
              >
                <Favorite />
              </IconButton>
              <Typography sx={{ width: 80, textAlign: 'right', ml: 1 }} variant="body2" color="text.secondary">
                {formatDuration(track.duration)}
              </Typography>
            </Box>
          </Card>
        </Grid>
      ))}
      
      {/* Menú contextual */}
      <AnimatePresence>
        {contextMenu.visible && (
          <motion.div
            className="fixed z-50 bg-[#0f0f18]/95 backdrop-blur-lg shadow-lg rounded-lg overflow-hidden border border-white/10 w-48 text-white"
            style={{ 
              top: contextMenu.mouseY, 
              left: contextMenu.mouseX
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="py-1">
              <button 
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex items-center"
                onClick={() => handlePlayNow(contextMenu.trackId)}
              >
                <svg className="w-3.5 h-3.5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                Reproducir ahora
              </button>
              <button 
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex items-center"
                onClick={() => handleAddToQueue(contextMenu.trackId)}
              >
                <svg className="w-3.5 h-3.5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.11 0 2-.9 2-2V5c0-1.11-.89-2-2-2zm0 16H3V5h18v14zM8 15c0-1.66 1.34-3 3-3 .35 0 .69.07 1 .18V6h5v2h-3v7.03c-.02 1.64-1.35 2.97-3 2.97-1.66 0-3-1.34-3-3z"/>
                </svg>
                Reproducir a continuación
              </button>
              <button 
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex items-center"
                onClick={() => handleCreateRadio(contextMenu.trackId)}
              >
                <svg className="w-3.5 h-3.5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.24 6.15C2.51 6.43 2 7.17 2 8v12c0 1.1.89 2 2 2h16c1.11 0 2-.9 2-2V8c0-1.11-.89-2-2-2H8.3l8.26-3.34L15.88 1 3.24 6.15zM7 20c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm13-8h-2v-2h-2v2H4V8h16v4z"/>
                </svg>
                Reproducir radio
              </button>
              <button 
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex items-center"
                onClick={() => handleGoToArtist(contextMenu.trackId)}
              >
                <svg className="w-3.5 h-3.5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
                Ir al artista
              </button>
              <button 
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex items-center"
                onClick={() => handleOpenInSpotify(contextMenu.trackId)}
              >
                <svg className="w-3.5 h-3.5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-14v8l6-4z"/>
                </svg>
                Abrir en Spotify
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Grid>
  );
} 