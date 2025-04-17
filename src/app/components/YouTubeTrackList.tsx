'use client';

import React from 'react';
import { List, ListItem, ListItemText, ListItemAvatar, Avatar, IconButton, Typography, Box } from '@mui/material';
import { PlayArrow, Pause } from '@mui/icons-material';
import { usePlayer, Track } from '@/contexts/PlayerContext';

interface YouTubeTrackListProps {
  tracks: Track[];
  title?: string;
  showArtist?: boolean;
  showDuration?: boolean;
  onTrackClick?: (track: Track, index: number) => void;
}

const YouTubeTrackList: React.FC<YouTubeTrackListProps> = ({
  tracks,
  title,
  showArtist = true,
  showDuration = true,
  onTrackClick
}) => {
  const { playTrack, playPlaylist, currentTrack, isPlaying, togglePlay } = usePlayer();

  // Comprobar si una canción está reproduciéndose, verificando también el youtubeId
  const isTrackPlaying = (track: Track) => {
    if (!currentTrack || !isPlaying) return false;
    
    // Si ambos tienen youtubeId, comparar por ese ID (más preciso)
    if (track.youtubeId && currentTrack.youtubeId) {
      return track.youtubeId === currentTrack.youtubeId;
    }
    
    // De lo contrario, usar el ID normal
    return currentTrack.id === track.id;
  };

  // Manejar clic en una canción
  const handleTrackClick = (track: Track, index: number) => {
    
    if (onTrackClick) {
      onTrackClick(track, index);
      return;
    }

    // Si es la misma canción, alternamos reproducción/pausa
    if ((track.youtubeId && currentTrack?.youtubeId === track.youtubeId) || 
        (!track.youtubeId && currentTrack?.id === track.id)) {
      togglePlay();
    } else {
      // Reproducir toda la lista empezando por esta canción
      playPlaylist(tracks, index);
    }
  };

  // Formatear duración
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (tracks.length === 0) {
    return (
      <Box sx={{ py: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No hay canciones disponibles
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {title && (
        <Typography variant="h6" sx={{ mb: 2 }}>
          {title}
        </Typography>
      )}
      
      <List sx={{ width: '100%', bgcolor: 'background.paper', borderRadius: 1 }}>
        {tracks.map((track, index) => (
          <ListItem
            key={track.id}
            alignItems="center"
            secondaryAction={
              <IconButton 
                edge="end" 
                aria-label="play"
                onClick={() => handleTrackClick(track, index)}
                color={isTrackPlaying(track) ? 'primary' : 'default'}
              >
                {isTrackPlaying(track) ? <Pause /> : <PlayArrow />}
              </IconButton>
            }
            sx={{
              borderBottom: '1px solid',
              borderColor: 'divider',
              '&:last-child': {
                borderBottom: 'none',
              },
              '&:hover': {
                bgcolor: 'action.hover',
              },
              cursor: 'pointer',
            }}
            onClick={() => handleTrackClick(track, index)}
          >
            <ListItemAvatar>
              <Avatar 
                alt={track.title} 
                src={track.cover} 
                variant="rounded"
                sx={{ 
                  width: 48, 
                  height: 48,
                  boxShadow: 1,
                  borderRadius: 1
                }}
              />
            </ListItemAvatar>
            <ListItemText
              primary={
                <Box component="span" sx={{ 
                  fontWeight: isTrackPlaying(track) ? 'bold' : 'normal',
                  color: isTrackPlaying(track) ? 'primary.main' : 'text.primary',
                }}>
                  {track.title}
                </Box>
              }
              secondary={
                <React.Fragment>
                  {showArtist && (
                    <Typography
                      component="span"
                      variant="body2"
                      color="text.secondary"
                      sx={{ display: 'block' }}
                    >
                      {track.artist}
                    </Typography>
                  )}
                </React.Fragment>
              }
            />
            {showDuration && (
              <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
                {formatDuration(track.duration)}
              </Typography>
            )}
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default YouTubeTrackList; 