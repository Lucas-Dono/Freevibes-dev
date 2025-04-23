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
import UnifiedMusicCard from '@/components/UnifiedMusicCard';
import { usePlayer, Track as PlayerTrack } from '@/contexts/PlayerContext';
import type { Track } from '@/types/types';
import Image from 'next/image';
import { Tab } from '@headlessui/react';
import { motion } from 'framer-motion';
import { FaMusic, FaRandom } from 'react-icons/fa';
import { MdPlaylistAdd } from 'react-icons/md';
import { useTranslation } from '@/hooks/useTranslation';
import { homePlayTrack } from '@/services/player/homePlayService';

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

// Estilo para las tarjetas de música
const StyledMusicCard = styled('div')(() => ({
  transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
  '&:hover': {
    transform: 'translateY(-5px)',
    boxShadow: '0 10px 20px rgba(0, 0, 0, 0.2)',
  },
  borderRadius: '4px',
}));

// Definir una interfaz para las pistas de Spotify
interface SpotifyTrack {
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
  const { t, language } = useTranslation();
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const { playTrack } = usePlayer();

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
      const newTracks = await getUserPersonalRotation(count);

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

  // Manejar clic en pestaña
  const handleTabClick = (index: number) => {
    setActiveTab(index);
  };

  // Función para reproducir una canción desde la biblioteca
  const handlePlayTrack = async (track: SpotifyTrack) => {
    try {
      console.log('[Library] Reproduciendo track:', track);

      // Convertir el formato SpotifyTrack al formato Track esperado por playTrack
      // con todos los campos necesarios explícitamente mapeados
      const convertedTrack = {
        id: track.id,
        title: track.name,
        name: track.name, // Incluir ambos para compatibilidad
        artist: track.artists.map(a => a.name).join(', '),
        artists: track.artists, // Incluir el array original por si se necesita
        album: track.album?.name || '',
        cover: track.album?.images?.[0]?.url || '/placeholder-album.jpg',
        albumCover: track.album?.images?.[0]?.url || '/placeholder-album.jpg',
        duration: track.duration_ms ? track.duration_ms / 1000 : 0,
        duration_ms: track.duration_ms || 0,
        source: 'spotify',
        spotifyId: track.id, // Incluir spotifyId explícitamente
        uri: track.id // Proporcionar uri como alternativa
      };

      console.log('[Library] Track convertido:', convertedTrack);

      // Usar explícitamente homePlayTrack para evitar confusiones
      await homePlayTrack(convertedTrack);
    } catch (error) {
      console.error('[Library] Error al reproducir:', error);
      // Mostrar un mensaje al usuario
      alert('No se pudo reproducir la canción. Por favor, intenta con otra.');
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Cabecera */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center' }}>
        <Link href="/home" passHref>
          <IconButton color="primary" sx={{ mr: 2 }} aria-label={t('library.backToHome')}>
            <ArrowBack />
          </IconButton>
        </Link>
        <Typography variant="h4" fontWeight="bold">
          {t('library.personalLibrary')}
        </Typography>
      </Box>

      <Divider sx={{ mb: 4, opacity: 0.1 }} />

      {/* Descripción */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="body1" color="text.secondary">
          {t('library.libraryDescription')}
        </Typography>
      </Box>

      {/* Interfaz de pestañas */}
      <div className="mb-8">
        <div className="flex space-x-4 border-b border-gray-700">
          <button
            className={`py-2 px-4 font-medium ${activeTab === 0 ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}
            onClick={() => handleTabClick(0)}
          >
            {t('library.songs')}
          </button>
          <button
            className={`py-2 px-4 font-medium ${activeTab === 1 ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}
            onClick={() => handleTabClick(1)}
          >
            {t('library.playlists')}
          </button>
        </div>
      </div>

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
          {/* Pestaña de Canciones */}
          {activeTab === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 px-4">
              {tracks.map((track, index) => (
                <div
                  key={track.id}
                  className="mb-6"
                  // Referencia al último elemento para detección de scroll
                  ref={tracks.length === index + 1 ? lastTrackElementRef : undefined}
                >
                  <UnifiedMusicCard
                    key={track.id}
                    id={track.id}
                    title={track.name}
                    subtitle={track.artists?.map((a) => a.name).join(', ')}
                    coverUrl={track.album?.images[0]?.url || '/placeholder-album.jpg'}
                    duration={track.duration_ms ? track.duration_ms / 1000 : undefined}
                    badge={track.isTopTrack ? { text: t('library.favorite'), color: 'bg-pink-600' } : undefined}
                    isPlayable={true}
                    onPlay={() => handlePlayTrack(track)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Pestaña de Playlists */}
          {activeTab === 1 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {playlists.map((playlist) => (
                <StyledMusicCard key={playlist.id} className="bg-gray-800 rounded-lg overflow-hidden">
                  <div className="relative aspect-square">
                    <img
                      src={playlist.images[0]?.url || '/placeholder-playlist.jpg'}
                      alt={playlist.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-white truncate">{playlist.name}</h3>
                    <p className="text-sm text-gray-400 truncate">{playlist.tracks.total} {t('library.tracksCount')}</p>
                  </div>
                </StyledMusicCard>
              ))}
            </div>
          )}

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
                {t('library.endOfLibrary')}
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
