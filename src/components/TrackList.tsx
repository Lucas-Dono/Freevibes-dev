'use client';

import React from 'react';
import { Box, Typography, Grid, Card, CardMedia, IconButton, useTheme } from '@mui/material';
import { PlayArrow, Favorite, MoreVert } from '@mui/icons-material';

export interface Artist {
  name: string;
  id?: string;
}

export interface Album {
  name: string;
  id?: string;
  images?: Array<{
    url: string;
  }>;
}

export interface Track {
  id: string;
  name?: string;
  title?: string;
  artists?: Artist[];
  artist?: string;
  album?: Album;
  albumArt?: string;
  coverUrl?: string;
  duration_ms?: number;
}

interface TrackListProps {
  tracks: Track[];
}

// Datos de ejemplo para cuando no hay tracks reales
const exampleTracks: Track[] = [
  {
    id: '1',
    title: 'Ejemplo Track 1',
    artist: 'Artista Ejemplo',
    albumArt: 'https://via.placeholder.com/80',
    duration_ms: 180000
  },
  {
    id: '2',
    title: 'Ejemplo Track 2',
    artist: 'Otro Artista',
    albumArt: 'https://via.placeholder.com/80',
    duration_ms: 210000
  }
];

export function TrackList({ tracks }: TrackListProps) {
  const theme = useTheme();
  const displayTracks = (!tracks || tracks.length === 0) ? exampleTracks : tracks;
  
  const formatDuration = (ms?: number) => {
    if (!ms) return '--:--';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Función auxiliar para obtener la URL de la imagen
  const getImageUrl = (track: Track): string => {
    if (track.albumArt) return track.albumArt;
    if (track.coverUrl) return track.coverUrl;
    if (track.album?.images && track.album.images.length > 0) return track.album.images[0].url;
    return 'https://via.placeholder.com/80';
  };

  // Función auxiliar para obtener el nombre del artista
  const getArtistName = (track: Track): string => {
    if (track.artist) return track.artist;
    if (track.artists && track.artists.length > 0) {
      return track.artists.map(artist => artist.name).join(', ');
    }
    return 'Artista desconocido';
  };

  // Función auxiliar para obtener el título de la canción
  const getTrackTitle = (track: Track): string => {
    return track.title || track.name || 'Pista sin título';
  };

  console.log("Renderizando tracks:", displayTracks);

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
                {formatDuration(track.duration_ms)}
              </Typography>
            </Box>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
} 