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
      <div className="flex justify-center items-center h-60vh">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="p-4 mb-6 bg-red-100 border border-red-400 text-red-700 rounded">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-semibold">Error</h3>
          </div>
          <p className="mt-2">{error || 'No se encontró información de la playlist.'}</p>
        </div>

        <div className="mt-8 p-6 bg-gray-800 rounded-lg">
          <h3 className="text-xl font-bold mb-4">Modo Demo</h3>
          <p className="mb-2">En el modo demo, puedes explorar playlists de diversos artistas.</p>
          <p className="mb-4">Prueba volver a la página principal para encontrar playlists disponibles.</p>

          <div className="flex flex-wrap gap-4">
            <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Ir a Inicio
            </Link>
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 border border-gray-600 rounded hover:bg-gray-700"
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Cabecera de la playlist */}
      <div className="relative">
        {/* Imagen de fondo */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-background z-0">
          {playlist.images[0] && (
            <div className="w-full h-full relative opacity-20">
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
        <div className="container mx-auto px-4 py-12 relative z-10">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-8">
            <div className="w-48 h-48 md:w-56 md:h-56 relative shadow-2xl">
              <Image
                src={playlist.images[0]?.url || '/img/default-playlist.jpg'}
                alt={playlist.name}
                fill
                className="object-cover"
              />
            </div>
            <div className="text-center md:text-left">
              <p className="text-white text-sm font-medium mb-1">PLAYLIST</p>
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">{playlist.name}</h1>
              {playlist.description && (
                <p className="text-gray-300 mb-3" dangerouslySetInnerHTML={{ __html: playlist.description }} />
              )}
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-gray-300 text-sm">
                <p>
                  <span className="font-medium text-white">
                    {playlist.owner.display_name}
                  </span>
                </p>
                <div className="hidden md:block text-gray-400">•</div>
                <p>{formatNumber(playlist.followers.total)} seguidores</p>
                <div className="hidden md:block text-gray-400">•</div>
                <p>{playlist.tracks.total} canciones</p>
              </div>
              </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Lista de canciones */}
        <div className="mb-12">
          {playlist.tracks.items.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-400">Esta playlist no tiene canciones.</p>
            </div>
          ) : (
            <div>
              {/* Cabecera de la tabla */}
              <div className="grid grid-cols-[16px_1fr_1fr_1fr_auto] md:grid-cols-[16px_4fr_3fr_2fr_auto] gap-4 px-4 py-2 border-b border-white/10 text-gray-400 text-sm">
                <div className="text-center">#</div>
                <div>TÍTULO</div>
                <div className="hidden md:block">ÁLBUM</div>
                <div className="hidden md:block">AGREGADO EL</div>
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

                    <div className="hidden md:flex items-center min-w-0">
                      <Link href={`/album/${item.track.album.id}`} className="text-gray-300 hover:underline truncate">
                        {item.track.album.name}
                      </Link>
                    </div>

                    <div className="hidden md:flex items-center text-gray-400 text-sm">
                      {formatDate(item.added_at)}
                    </div>

                    <div className="flex items-center justify-end text-gray-400 text-sm">
                      {formatDuration(item.track.duration_ms)}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
