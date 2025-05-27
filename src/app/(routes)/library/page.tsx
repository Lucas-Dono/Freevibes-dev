'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getUserPersonalRotation } from '@/services/spotify';
import Link from 'next/link';
import UnifiedMusicCard from '@/components/UnifiedMusicCard';
import { usePlayer, Track as PlayerTrack } from '@/contexts/PlayerContext';
import type { Track } from '@/types/types';
import { motion } from 'framer-motion';
import { FaMusic, FaRandom, FaArrowLeft, FaArrowUp } from 'react-icons/fa';
import { MdPlaylistAdd } from 'react-icons/md';
import { useTranslation } from '@/hooks/useTranslation';
import { homePlayTrack } from '@/services/player/homePlayService';

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
    <div className="bg-gradient-to-b from-zinc-900 to-black min-h-screen">
      {/* Container responsive: padding reducido en móvil */}
      <div className="container mx-auto px-4 md:px-6 py-4 md:py-6">
        {/* Cabecera */}
        <motion.div 
          className="flex items-center mb-6 md:mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link href="/home" className="mr-3 md:mr-4">
            <button className="p-2 md:p-3 rounded-full bg-zinc-800/50 hover:bg-zinc-700/50 transition-colors duration-200 text-purple-400 hover:text-purple-300">
              <FaArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </Link>
          <h1 className="text-2xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            {t('library.personalLibrary')}
          </h1>
        </motion.div>

        {/* Descripción */}
        <motion.div 
          className="mb-6 md:mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <p className="text-zinc-300 text-sm md:text-base">
            {t('library.libraryDescription')}
          </p>
        </motion.div>

        {/* Interfaz de pestañas */}
        <motion.div 
          className="mb-6 md:mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="flex space-x-1 md:space-x-4 border-b border-zinc-700/50">
            <button
              className={`py-2 md:py-3 px-3 md:px-6 font-medium text-sm md:text-base transition-colors duration-200 ${
                activeTab === 0 
                  ? 'text-purple-400 border-b-2 border-purple-400' 
                  : 'text-zinc-400 hover:text-zinc-300'
              }`}
              onClick={() => handleTabClick(0)}
            >
              <div className="flex items-center gap-2">
                <FaMusic className="w-3 h-3 md:w-4 md:h-4" />
                {t('library.songs')}
              </div>
            </button>
            <button
              className={`py-2 md:py-3 px-3 md:px-6 font-medium text-sm md:text-base transition-colors duration-200 ${
                activeTab === 1 
                  ? 'text-purple-400 border-b-2 border-purple-400' 
                  : 'text-zinc-400 hover:text-zinc-300'
              }`}
              onClick={() => handleTabClick(1)}
            >
              <div className="flex items-center gap-2">
                <MdPlaylistAdd className="w-4 h-4 md:w-5 md:h-5" />
                {t('library.playlists')}
              </div>
            </button>
          </div>
        </motion.div>

        {/* Loading inicial */}
        {initialLoading ? (
          <div className="flex flex-col items-center justify-center py-16 md:py-20">
            <div className="w-12 h-12 md:w-16 md:h-16 border-4 border-purple-300 border-t-purple-600 rounded-full animate-spin mb-4 md:mb-6"></div>
            <p className="text-zinc-300 text-sm md:text-base">{t('library.loading')}</p>
          </div>
        ) : error ? (
          <div className="text-center py-12 md:py-16">
            <div className="bg-red-900/30 border border-red-500/50 text-red-200 px-4 md:px-6 py-3 md:py-4 rounded-xl backdrop-blur-sm inline-block">
              <p className="font-medium text-sm md:text-base">{error}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Pestaña de Canciones */}
            {activeTab === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                {/* Vista móvil: Lista vertical compacta */}
                <div className="md:hidden space-y-3">
                  {tracks.map((track, index) => (
                    <div
                      key={track.id}
                      className="flex items-center gap-3 p-3 bg-zinc-800/30 rounded-lg hover:bg-zinc-700/30 transition-colors duration-200"
                      ref={tracks.length === index + 1 ? lastTrackElementRef : undefined}
                      onClick={() => handlePlayTrack(track)}
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={track.album?.images[0]?.url || '/placeholder-album.jpg'}
                          alt={track.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white text-sm truncate">{track.name}</h3>
                        <p className="text-zinc-400 text-xs truncate">
                          {track.artists?.map((a) => a.name).join(', ')}
                        </p>
                      </div>
                      {track.isTopTrack && (
                        <div className="bg-pink-600 text-white text-xs px-2 py-1 rounded-full">
                          ♥
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Vista desktop: Grid de tarjetas */}
                <div className="hidden md:grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                  {tracks.map((track, index) => (
                    <div
                      key={track.id}
                      ref={tracks.length === index + 1 ? lastTrackElementRef : undefined}
                    >
                      <UnifiedMusicCard
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
              </motion.div>
            )}

            {/* Pestaña de Playlists */}
            {activeTab === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                {playlists.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
                    {playlists.map((playlist) => (
                      <div 
                        key={playlist.id} 
                        className="bg-zinc-800/50 rounded-xl overflow-hidden hover:bg-zinc-700/50 transition-all duration-300 hover:scale-105"
                      >
                        <div className="aspect-square relative">
                          <img
                            src={playlist.images[0]?.url || '/placeholder-playlist.jpg'}
                            alt={playlist.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-3 md:p-4">
                          <h3 className="font-semibold text-white text-sm md:text-base truncate">{playlist.name}</h3>
                          <p className="text-xs md:text-sm text-zinc-400 truncate">
                            {playlist.tracks.total} {t('library.tracksCount')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 md:py-16">
                    <div className="bg-zinc-800/30 rounded-xl p-6 md:p-8 backdrop-blur-sm inline-block">
                      <MdPlaylistAdd className="w-12 h-12 md:w-16 md:h-16 text-zinc-500 mx-auto mb-4" />
                      <p className="text-zinc-300 text-sm md:text-base">{t('library.noPlaylists')}</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Indicador de carga para más elementos */}
            {loading && !initialLoading && (
              <div className="flex justify-center py-6 md:py-8">
                <div className="w-8 h-8 md:w-10 md:h-10 border-4 border-purple-300 border-t-purple-600 rounded-full animate-spin"></div>
              </div>
            )}

            {/* Mensaje de fin de lista */}
            {!hasMore && !loading && tracks.length > 0 && (
              <div className="text-center py-6 md:py-8">
                <p className="text-zinc-400 text-sm md:text-base">
                  {t('library.endOfLibrary')}
                </p>
              </div>
            )}

            {/* Botón para volver arriba */}
            {showScrollTop && (
              <button
                onClick={scrollToTop}
                className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 p-3 md:p-4 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg transition-all duration-300 hover:scale-110"
              >
                <FaArrowUp className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
