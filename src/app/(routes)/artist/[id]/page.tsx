'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { getArtist, getArtistTopTracks, getArtistAlbums, getRelatedArtists } from '@/services/spotify';

interface Artist {
  id: string;
  name: string;
  images: Array<{ url: string }>;
  followers: { total: number };
  genres: string[];
  popularity: number;
}

interface Track {
  id: string;
  name: string;
  album: {
    name: string;
    images: Array<{ url: string }>;
    release_date: string;
  };
  duration_ms: number;
  popularity: number;
  artists: Array<{ id: string; name: string }>;
}

interface Album {
  id: string;
  name: string;
  images: Array<{ url: string }>;
  release_date: string;
  album_type: string;
  total_tracks: number;
}

export default function ArtistPage() {
  const params = useParams();
  const artistId = params ? (params.id as string) : '';
  
  const [artist, setArtist] = useState<Artist | null>(null);
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [relatedArtists, setRelatedArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchArtistData = async () => {
      if (!artistId) return;
      
      setLoading(true);
      
      try {
        // Obtener información del artista
        const artistData = await getArtist(artistId);
        setArtist(artistData);
        
        // Obtener canciones populares
        const tracksData = await getArtistTopTracks(artistId);
        setTopTracks(tracksData);
        
        // Obtener álbumes
        const albumsData = await getArtistAlbums(artistId, 10);
        setAlbums(albumsData);
        
        // Obtener artistas relacionados
        const relatedData = await getRelatedArtists(artistId);
        setRelatedArtists(relatedData);
        
        setError(null);
      } catch (err) {
        console.error('Error al cargar datos del artista:', err);
        setError('Error al cargar información del artista. Por favor, intenta de nuevo más tarde.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchArtistData();
  }, [artistId]);
  
  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
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

  if (error || !artist) {
    return (
      <div className="text-center py-10">
        <p className="text-red-500">{error || 'No se encontró el artista'}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Cabecera del artista */}
      <div className="relative">
        {/* Imagen de fondo */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-background z-0">
          {artist.images[0] && (
            <div className="w-full h-full relative opacity-30">
              <Image
                src={artist.images[0].url}
                alt={artist.name}
                fill
                className="object-cover"
                quality={70}
              />
            </div>
          )}
          </div>
          
        {/* Información del artista */}
        <div className="container mx-auto px-4 py-16 relative z-10">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-8">
            <div className="w-48 h-48 md:w-56 md:h-56 relative rounded-full overflow-hidden shadow-2xl">
              <Image
                src={artist.images[0]?.url || '/img/default-artist.jpg'}
                alt={artist.name}
                fill
                className="object-cover"
              />
            </div>
            <div className="text-center md:text-left">
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">{artist.name}</h1>
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 text-gray-300">
                <div>
                  <span className="font-bold text-white">{formatNumber(artist.followers.total)}</span> seguidores
                </div>
                {artist.genres.length > 0 && (
                  <div className="flex gap-2 flex-wrap justify-center md:justify-start">
                    {artist.genres.slice(0, 3).map(genre => (
                      <span 
                        key={genre} 
                        className="px-2 py-1 rounded-full text-xs bg-white/10"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>
      
      <div className="container mx-auto px-4 py-8">
        {/* Canciones populares */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Canciones populares</h2>
          {topTracks.length === 0 ? (
            <p className="text-gray-400">No se encontraron canciones populares para este artista.</p>
          ) : (
                <div className="space-y-1">
              {topTracks.map((track, index) => (
                    <motion.div
                      key={track.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="group flex items-center py-2 px-3 rounded-md hover:bg-white/5"
                >
                  <div className="text-gray-400 w-8 text-right pr-4">{index + 1}</div>
                  <div className="w-12 h-12 relative mr-4">
                    <Image 
                      src={track.album.images[0]?.url || '/img/default-album.jpg'} 
                      alt={track.album.name}
                      fill
                      className="object-cover rounded"
                    />
                          </div>
                  <div className="flex-grow min-w-0">
                    <h3 className="text-white truncate">{track.name}</h3>
                    <p className="text-gray-400 text-sm">
                      {track.album.name}
                    </p>
                        </div>
                  <div className="text-gray-500 text-sm px-4">
                    {formatDuration(track.duration_ms)}
                      </div>
                    </motion.div>
                  ))}
                </div>
          )}
        </section>
        
        {/* Álbumes */}
        <section className="mb-12">
                <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Álbumes</h2>
            {albums.length > 6 && (
              <Link href={`/artist/${artistId}/albums`} className="text-gray-400 hover:text-white transition-colors">
                    Ver todos
                  </Link>
            )}
                </div>
                
          {albums.length === 0 ? (
            <p className="text-gray-400">No se encontraron álbumes para este artista.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {albums.slice(0, 6).map((album, index) => (
                    <motion.div
                      key={album.id}
                  initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="bg-card-bg rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-300"
                    >
                      <Link href={`/album/${album.id}`}>
                    <div className="p-4">
                      <div className="aspect-square relative mb-3">
                        <Image 
                          src={album.images[0]?.url || '/img/default-album.jpg'} 
                          alt={album.name}
                          fill
                          className="object-cover rounded"
                        />
                      </div>
                      <h3 className="text-white font-medium truncate">{album.name}</h3>
                      <p className="text-gray-400 text-sm truncate">
                        {album.release_date.split('-')[0]} • {album.total_tracks} pistas
                      </p>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
            </div>
          )}
        </section>
        
        {/* Artistas similares */}
        {relatedArtists.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">Fans también les gusta</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {relatedArtists.slice(0, 6).map((relatedArtist, index) => (
                  <motion.div
                  key={relatedArtist.id}
                  initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="bg-card-bg rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all duration-300"
                >
                  <Link href={`/artist/${relatedArtist.id}`}>
                    <div className="p-4">
                      <div className="aspect-square relative mb-3 rounded-full overflow-hidden">
                        <Image 
                          src={relatedArtist.images[0]?.url || '/img/default-artist.jpg'} 
                          alt={relatedArtist.name}
                          fill
                          className="object-cover"
                          />
                        </div>
                      <h3 className="text-white font-medium truncate text-center">{relatedArtist.name}</h3>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
          </section>
          )}
        </div>
    </div>
  );
} 