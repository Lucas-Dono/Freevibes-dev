'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { getPlaylistDetail } from '@/services/spotify';

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
  
  useEffect(() => {
    const fetchPlaylistData = async () => {
      if (!playlistId) return;
      
      try {
        setLoading(true);
        
        // Obtener detalles de la playlist
        const playlistData = await getPlaylistDetail(playlistId);
        setPlaylist(playlistData);
        
        setError(null);
      } catch (err) {
        console.error('Error al cargar datos de la playlist:', err);
        setError('Error al cargar información de la playlist. Por favor, intenta de nuevo más tarde.');
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-60vh">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="text-center py-10">
        <p className="text-red-500">{error || 'No se encontró la playlist'}</p>
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
                    className="grid grid-cols-[16px_1fr_1fr_1fr_auto] md:grid-cols-[16px_4fr_3fr_2fr_auto] gap-4 px-4 py-2 rounded-md hover:bg-white/5"
                  >
                    <div className="flex items-center justify-center text-gray-400">{index + 1}</div>
                    
                    <div className="flex items-center min-w-0">
                      <div className="w-10 h-10 relative mr-3 flex-shrink-0">
                        <Image 
                          src={item.track.album.images[0]?.url || '/img/default-album.jpg'} 
                          alt={item.track.album.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-white truncate">{item.track.name}</h3>
                        <p className="text-gray-400 text-sm truncate">
                          {item.track.artists.map((artist, i) => (
                            <span key={artist.id}>
                              {i > 0 && ', '}
                              <Link href={`/artist/${artist.id}`} className="hover:underline">
                                {artist.name}
                            </Link>
                              </span>
                          ))}
                        </p>
                        </div>
                      </div>
                      
                    <div className="hidden md:flex items-center text-gray-400 min-w-0">
                      <Link href={`/album/${item.track.album.id}`} className="truncate hover:underline">
                        {item.track.album.name}
                        </Link>
                      </div>
                      
                    <div className="hidden md:flex items-center text-gray-400">
                      {formatDate(item.added_at)}
                      </div>
                      
                    <div className="flex items-center justify-end text-gray-400">
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