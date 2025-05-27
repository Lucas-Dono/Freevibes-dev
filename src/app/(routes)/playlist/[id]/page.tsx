'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import axios from 'axios';
import { getApiBaseUrl } from '@/lib/api-config';
import { usePlayer } from '@/contexts/PlayerContext';
import { playTrack as playTrackService } from '@/services/player/playService';
import { Track as AppTrack } from '@/types/types';
import { IconButton } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

interface Playlist {
  id: string;
  name: string;
  description: string;
  images: Array<{ url: string }>;
  owner: { display_name: string };
  followers: { total: number };
  tracks: {
    total: number;
    items: Array<{
      track: Track;
      added_at: string;
    }>;
  };
}

interface Track {
  id: string;
  name: string;
  artists: Array<{ id: string; name: string }>;
  album: {
    id: string;
    name: string;
    images: Array<{ url: string }>;
    release_date: string;
  };
  duration_ms: number;
  popularity: number;
}

export default function PlaylistPage() {
  const params = useParams();
  const playlistId = params ? (params.id as string) : '';

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { playTrack: _playTrackFromContext_ } = usePlayer();

  useEffect(() => {
    const fetchPlaylistData = async () => {
      if (!playlistId) return;

      try {
        setLoading(true);

        // Obtener la URL base de la API
        const apiBaseUrl = getApiBaseUrl();

        // Obtener detalles de la playlist usando nuestra nueva API
        const response = await axios.get(`${apiBaseUrl}/api/playlist/${playlistId}`, {
          params: {
            language: 'es' // Fallback a español si no hay idioma preferido
          }
        });

        if (response.data) {
          setPlaylist(response.data);
          setError(null);
        } else {
          throw new Error('No se obtuvo información de la playlist');
        }
      } catch (err: any) {
        console.error('Error al cargar datos de la playlist:', err);

        // Extraer mensaje de error
        let errorMessage = 'Error al cargar información de la playlist. Por favor, intenta de nuevo más tarde.';

        if (err.response) {
          if (err.response.status === 404) {
            errorMessage = 'No se encontró la playlist solicitada.';
          } else if (err.response.data && err.response.data.error) {
            errorMessage = err.response.data.error;
          }
        } else if (err.message) {
          errorMessage = err.message;
        }

        setError(errorMessage);
        setPlaylist(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPlaylistData();
  }, [playlistId]);

  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const handlePlay = (apiTrack: Track) => {
    if (!apiTrack) return;

    // Crear un objeto básico con la info necesaria para el servicio
    const trackInfoForService = {
        id: apiTrack.id, // Spotify ID
        title: apiTrack.name,
        artists: apiTrack.artists.map(a => ({ id: a.id, name: a.name })),
        album: apiTrack.album.name,
        cover: apiTrack.album.images[0]?.url || '/img/default-track.jpg',
        duration: apiTrack.duration_ms / 1000,
        uri: `spotify:track:${apiTrack.id}`, // Incluir URI por si el servicio lo necesita
        source: 'spotify'
        // El servicio se encargará de buscar youtubeId
    };

    console.log('[PlaylistPage] Llamando al SERVICIO playTrack con:', trackInfoForService);
    playTrackService(trackInfoForService); // <-- Llamada al servicio importado
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-b from-zinc-900 to-black min-h-screen">
        <div className="flex flex-col justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 md:h-16 md:w-16 border-t-2 border-b-2 border-purple-500 mb-4"></div>
          <p className="text-gray-300 text-sm md:text-base">Cargando playlist...</p>
        </div>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="bg-gradient-to-b from-zinc-900 to-black min-h-screen">
        <div className="container mx-auto px-4 md:px-6 py-8 md:py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="p-4 md:p-6 mb-6 bg-red-900/20 border border-red-800/30 text-red-300 rounded-lg">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg md:text-xl font-semibold">Error</h3>
              </div>
              <p className="mt-2 text-sm md:text-base">{error || 'No se encontró información de la playlist.'}</p>
            </div>

            <div className="mt-6 md:mt-8 p-4 md:p-6 bg-zinc-800/50 rounded-lg">
              <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-white">Modo Demo</h3>
              <p className="mb-2 text-gray-300 text-sm md:text-base">En el modo demo, puedes explorar playlists de diversos artistas.</p>
              <p className="mb-4 md:mb-6 text-gray-300 text-sm md:text-base">Prueba volver a la página principal para encontrar playlists disponibles.</p>

              <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                <Link href="/" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-center text-sm md:text-base">
                  Ir a Inicio
                </Link>
                <button
                  onClick={() => window.history.back()}
                  className="px-4 py-2 border border-zinc-600 text-gray-300 rounded-lg hover:bg-zinc-700 transition-colors text-sm md:text-base"
                >
                  Volver
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-b from-zinc-900 to-black min-h-screen">
      {/* Cabecera de la playlist */}
      <div className="relative">
        {/* Imagen de fondo */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-zinc-900 z-0">
          {playlist.images[0] && (
            <div className="w-full h-full relative opacity-30">
              <Image
                src={playlist.images[0].url}
                alt={playlist.name}
                fill
                className="object-cover"
                quality={70}
              />
            </div>
          )}
        </div>

        {/* Información de la playlist */}
        <motion.div 
          className="container mx-auto px-4 md:px-6 py-8 md:py-12 relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8">
            {/* Imagen de la playlist - más pequeña en móvil */}
            <motion.div 
              className="w-40 h-40 md:w-56 md:h-56 relative shadow-2xl rounded-lg overflow-hidden"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Image
                src={playlist.images[0]?.url || '/img/default-playlist.jpg'}
                alt={playlist.name}
                fill
                className="object-cover"
              />
            </motion.div>
            
            {/* Información de la playlist */}
            <motion.div 
              className="text-center md:text-left flex-1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <p className="text-white text-xs md:text-sm font-medium mb-1 md:mb-2">PLAYLIST</p>
              <h1 className="text-2xl md:text-4xl lg:text-6xl font-bold text-white mb-3 md:mb-4 leading-tight">
                {playlist.name}
              </h1>
              {playlist.description && (
                <p 
                  className="text-gray-300 mb-3 md:mb-4 text-sm md:text-base line-clamp-2 md:line-clamp-none" 
                  dangerouslySetInnerHTML={{ __html: playlist.description }} 
                />
              )}
              
              {/* Información compacta en móvil */}
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-gray-300 text-xs md:text-sm">
                <p>
                  <span className="font-medium text-white">
                    {playlist.owner.display_name}
                  </span>
                </p>
                <div className="hidden md:block text-gray-400">•</div>
                <div className="flex items-center gap-2 md:gap-4">
                  <p>{formatNumber(playlist.followers.total)} seguidores</p>
                  <div className="text-gray-400">•</div>
                  <p>{playlist.tracks.total} canciones</p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Lista de canciones */}
        <motion.div 
          className="mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {playlist.tracks.items.length === 0 ? (
            <motion.div 
              className="text-center py-8 md:py-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-block p-3 md:p-4 rounded-full bg-zinc-800/50 mb-3 md:mb-4">
                <svg className="w-8 h-8 md:w-10 md:h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 17H5a2 2 0 0 0-2 2 2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm12-2h-4a2 2 0 0 0-2 2 2 2 0 0 0 2 2h2a2 2 0 0 0 2-2z" />
                  <path d="M9 17V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8" />
                </svg>
              </div>
              <h3 className="text-lg md:text-xl font-medium text-gray-300 mb-2">Playlist vacía</h3>
              <p className="text-gray-400 text-sm md:text-base">Esta playlist no tiene canciones.</p>
            </motion.div>
          ) : (
            <div>
              {/* Vista móvil: Lista compacta */}
              <div className="md:hidden space-y-2">
                {playlist.tracks.items.map((item, index) => (
                  <motion.div
                    key={item.track.id || `track-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="flex items-center gap-3 p-3 bg-zinc-800/30 rounded-lg hover:bg-zinc-700/30 transition-colors duration-200"
                    onClick={() => handlePlay(item.track)}
                  >
                    {/* Número de track */}
                    <div className="w-6 text-center text-gray-400 text-sm font-medium">
                      {index + 1}
                    </div>
                    
                    {/* Imagen del álbum */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                      <Image
                        src={item.track.album.images[0]?.url || '/img/default-track.jpg'}
                        alt={item.track.name}
                        width={48}
                        height={48}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    
                    {/* Información de la canción */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white text-sm truncate">{item.track.name}</h3>
                      <p className="text-zinc-400 text-xs truncate">
                        {item.track.artists.map((artist, idx) => (
                          <span key={artist.id}>
                            {artist.name}
                            {idx < item.track.artists.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </p>
                    </div>
                    
                    {/* Duración */}
                    <div className="text-zinc-400 text-xs font-medium">
                      {formatDuration(item.track.duration_ms)}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Vista desktop: Tabla completa */}
              <div className="hidden md:block">
                {/* Cabecera de la tabla */}
                <div className="grid grid-cols-[40px_4fr_3fr_2fr_auto] gap-4 px-4 py-2 border-b border-white/10 text-gray-400 text-sm">
                  <div className="text-center">#</div>
                  <div>TÍTULO</div>
                  <div>ÁLBUM</div>
                  <div>AGREGADO EL</div>
                  <div className="flex justify-end">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>

                {/* Lista de canciones */}
                <div className="mt-2">
                  {playlist.tracks.items.map((item, index) => (
                    <motion.div
                      key={item.track.id || `track-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                      className="grid grid-cols-[40px_4fr_3fr_2fr_auto] gap-4 px-4 py-2 rounded-md hover:bg-white/5 group items-center"
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      <div className="flex items-center justify-center text-gray-400">
                        {hoveredIndex === index ? (
                          <IconButton
                            size="small"
                            onClick={() => handlePlay(item.track)}
                            className="text-white"
                          >
                            <PlayArrowIcon />
                          </IconButton>
                        ) : (
                          <span>{index + 1}</span>
                        )}
                      </div>

                      <div className="flex items-center min-w-0">
                        <div className="relative w-10 h-10 mr-3 flex-shrink-0">
                          <Image
                            src={item.track.album.images[0]?.url || '/img/default-track.jpg'}
                            alt={item.track.name}
                            fill
                            className="object-cover rounded"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-white truncate font-medium group-hover:text-primary">{item.track.name}</p>
                          <div className="text-gray-400 text-sm truncate">
                            {item.track.artists.map((artist, idx) => (
                              <span key={artist.id}>
                                <Link href={`/artist/${artist.id}`} className="hover:underline">
                                  {artist.name}
                                </Link>
                                {idx < item.track.artists.length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center min-w-0">
                        <Link href={`/album/${item.track.album.id}`} className="text-gray-300 hover:underline truncate">
                          {item.track.album.name}
                        </Link>
                      </div>

                      <div className="flex items-center text-gray-400 text-sm">
                        {formatDate(item.added_at)}
                      </div>

                      <div className="flex items-center justify-end text-gray-400 text-sm">
                        {formatDuration(item.track.duration_ms)}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
