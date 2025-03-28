'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  Container, 
  Grid, 
  Card, 
  CardContent, 
  CardMedia,
  IconButton,
  CircularProgress,
  Divider,
  styled,
  useTheme,
  alpha
} from '@mui/material';
import { PlayArrow, ArrowBack, FavoriteRounded } from '@mui/icons-material';
import { getUserPersonalRotation } from '@/services/spotify';
import Link from 'next/link';
import { AutoSizer, WindowScroller, List, CellMeasurer, CellMeasurerCache } from 'react-virtualized';

// Estilo para las tarjetas de música
const MusicCard = styled(Card)(({ theme }) => ({
  backgroundColor: 'rgba(255,255,255,0.03)',
  borderRadius: '8px',
  overflow: 'hidden',
  transition: 'all 0.3s',
  '&:hover': {
    transform: 'translateY(-4px)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
}));

const CoverImage = styled(CardMedia)(({ theme }) => ({
  height: 180,
  borderRadius: '4px',
}));

interface Track {
  id: string;
  name: string;
  album?: {
    images: Array<{ url: string }>;
    name: string;
  };
  artists: Array<{ name: string; id: string }>;
  isTopTrack?: boolean;
  duration_ms?: number;
}

export default function LibraryPage() {
  const theme = useTheme();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // Referencia para el observador de intersección
  const observer = useRef<IntersectionObserver | null>(null);
  // Referencia para el último elemento
  const lastTrackElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading) return;
    
    // Desconectar el observador anterior si existe
    if (observer.current) observer.current.disconnect();
    
    // Crear un nuevo observador
    observer.current = new IntersectionObserver(entries => {
      // Si el último elemento es visible y hay más elementos por cargar
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    
    // Observar el último elemento
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);
  
  // Formatear la duración de la pista
  const formatDuration = (ms: number | undefined): string => {
    if (!ms) return '0:00';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  // Cargar canciones
  const loadTracks = async (pageNumber: number) => {
    try {
      setLoading(true);
      
      // Calculamos el offset basado en la página
      const offset = (pageNumber - 1) * 50;
      // Para la primera página, usamos 50 elementos; para las siguientes, 20 para mejorar el rendimiento
      const count = pageNumber === 1 ? 50 : 20;
      
      // Llamada al servicio para obtener canciones con offset
      const newTracks = await getUserPersonalRotation(count, offset);
      
      // Si no hay nuevas canciones, significa que hemos llegado al final
      if (newTracks.length === 0) {
        setHasMore(false);
        setLoading(false);
        return;
      }
      
      if (pageNumber === 1) {
        setTracks(newTracks);
      } else {
        // Evitar duplicados usando el ID como clave
        const trackIds = new Set(tracks.map(t => t.id));
        const filteredNewTracks = newTracks.filter(t => !trackIds.has(t.id));
        setTracks(prev => [...prev, ...filteredNewTracks]);
      }
      
      setLoading(false);
      setInitialLoading(false);
    } catch (error) {
      console.error('Error al cargar la biblioteca:', error);
      setError('No se pudieron cargar las canciones. Por favor, inténtalo de nuevo más tarde.');
      setLoading(false);
      setInitialLoading(false);
    }
  };
  
  // Efecto para cargar la primera página al montar
  useEffect(() => {
    loadTracks(1);
  }, []);
  
  // Efecto para cargar más canciones cuando cambia la página
  useEffect(() => {
    if (page > 1) {
      loadTracks(page);
    }
  }, [page]);
  
  // Control del botón para volver arriba
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const shouldShow = scrollY > 400;
      
      if (shouldShow !== showScrollTop) {
        setShowScrollTop(shouldShow);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showScrollTop]);
  
  // Función para volver arriba
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Cabecera */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center' }}>
        <Link href="/home" passHref>
          <IconButton color="primary" sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
        </Link>
        <Typography variant="h4" fontWeight="bold">
          Tu Biblioteca Personal
        </Typography>
      </Box>
      
      <Divider sx={{ mb: 4, opacity: 0.1 }} />
      
      {/* Descripción */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="body1" color="text.secondary">
          Esta selección está basada en tu historial de escucha y tus preferencias musicales.
          Descubre nuevas canciones y redescubre tus temas favoritos.
        </Typography>
      </Box>
      
      {/* Loading inicial */}
      {initialLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress color="secondary" size={60} thickness={4} />
        </Box>
      ) : error ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography color="error" variant="h6">{error}</Typography>
        </Box>
      ) : (
        <>
          {/* Grid de canciones */}
          <Grid container spacing={3}>
            {tracks.map((track, index) => (
              <Grid 
                item 
                xs={12} sm={6} md={4} lg={3} xl={2.4}
                key={`${track.id}-${index}`}
                // Referencia al último elemento para detección de scroll
                ref={tracks.length === index + 1 ? lastTrackElementRef : undefined}
              >
                <MusicCard>
                  <Box sx={{ position: 'relative', p: 2, pb: 1 }}>
                    <CoverImage
                      image={track.album?.images[0]?.url || '/placeholder-album.jpg'}
                      title={track.name}
                    />
                    
                    {/* Badge de favorito */}
                    {track.isTopTrack && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 16,
                          right: 16,
                          bgcolor: 'rgba(0,0,0,0.6)',
                          color: 'white',
                          fontSize: '0.7rem',
                          p: '4px 8px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <FavoriteRounded sx={{ fontSize: '0.85rem', mr: 0.5, color: theme.palette.secondary.main }} />
                        Favorito
                      </Box>
                    )}
                    
                    {/* Botón de reproducción */}
                    <Box 
                      sx={{ 
                        position: 'absolute',
                        bottom: 16,
                        right: 16,
                        opacity: 0,
                        transition: 'opacity 0.3s, transform 0.3s',
                        transform: 'translateY(10px)',
                        '.MuiCard-root:hover &': {
                          opacity: 1,
                          transform: 'translateY(0)'
                        }
                      }}
                    >
                      <IconButton 
                        size="medium"
                        sx={{ 
                          backgroundColor: theme.palette.secondary.main,
                          color: 'white',
                          '&:hover': { backgroundColor: theme.palette.secondary.dark }
                        }}
                      >
                        <PlayArrow />
                      </IconButton>
                    </Box>
                  </Box>
                  
                  <CardContent sx={{ pt: 1, flexGrow: 1 }}>
                    <Typography variant="body1" fontWeight="medium" noWrap>
                      {track.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {track.artists?.map((a) => a.name).join(', ')}
                    </Typography>
                    
                    {track.duration_ms && (
                      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
                        {formatDuration(track.duration_ms)}
                      </Typography>
                    )}
                  </CardContent>
                </MusicCard>
              </Grid>
            ))}
          </Grid>
          
          {/* Indicador de carga para más elementos */}
          {loading && !initialLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress color="secondary" />
            </Box>
          )}
          
          {/* Mensaje de fin de lista */}
          {!hasMore && !loading && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">
                ¡Has llegado al final de tu biblioteca personal!
              </Typography>
            </Box>
          )}
          
          {/* Botón para volver arriba */}
          {showScrollTop && (
            <Box
              sx={{
                position: 'fixed',
                bottom: 20,
                right: 20,
                zIndex: 1000,
              }}
            >
              <IconButton
                onClick={scrollToTop}
                sx={{
                  backgroundColor: theme.palette.secondary.main,
                  color: 'white',
                  boxShadow: 3,
                  '&:hover': {
                    backgroundColor: theme.palette.secondary.dark,
                  },
                }}
                size="large"
              >
                <ArrowBack sx={{ transform: 'rotate(90deg)' }} />
              </IconButton>
            </Box>
          )}
        </>
      )}
    </Container>
  );
} 