'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import axios from 'axios';

// Importamos los servicios necesarios
import { playTrack } from '@/services/player/playService';
import { getApiBaseUrl } from '@/lib/api-config';

// Interfaces para tipar correctamente los datos
interface TrackType {
  id: string | number;
  number: number;
  title: string;
  duration: number;
  plays: string;
  isExplicit?: boolean;
  artists: { name: string }[];
  uri: string;
}

interface RelatedAlbumType {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
}

interface AlbumDataType {
  id: string;
  title: string;
  artist: {
    id: string;
    name: string;
  };
  releaseDate: string;
  coverUrl: string;
  duration: string;
  description: string;
  label: string;
  popularity: number;
  tracks: TrackType[];
  relatedAlbums: RelatedAlbumType[];
}

// Datos de ejemplo como fallback en caso de error
const fallbackAlbumData: AlbumDataType = {
  id: '1',
  title: 'After Hours',
  artist: {
    id: '1',
    name: 'The Weeknd'
  },
  releaseDate: '20 de marzo, 2020',
  coverUrl: '/placeholder-album.jpg',
  duration: '56 min 20 seg',
  description: 'After Hours es el cuarto álbum de estudio del cantante canadiense The Weeknd, lanzado el 20 de marzo de 2020. Cuenta con los exitosos sencillos "Blinding Lights" y "Save Your Tears".',
  label: 'XO / Republic Records',
  popularity: 92,
  tracks: [
    { id: 1, number: 1, title: 'Alone Again', duration: 240, plays: '141M', artists: [{ name: 'The Weeknd' }], uri: 'spotify:track:1' },
    { id: 2, number: 2, title: 'Too Late', duration: 234, plays: '138M', artists: [{ name: 'The Weeknd' }], uri: 'spotify:track:2' },
    { id: 3, number: 3, title: 'Hardest To Love', duration: 193, plays: '211M', artists: [{ name: 'The Weeknd' }], uri: 'spotify:track:3' },
    { id: 4, number: 4, title: 'Scared To Live', duration: 226, plays: '159M', artists: [{ name: 'The Weeknd' }], uri: 'spotify:track:4' },
    { id: 5, number: 5, title: 'Snowchild', duration: 242, plays: '157M', artists: [{ name: 'The Weeknd' }], uri: 'spotify:track:5' },
    { id: 6, number: 6, title: 'Escape From LA', duration: 352, plays: '192M', artists: [{ name: 'The Weeknd' }], uri: 'spotify:track:6' },
    { id: 7, number: 7, title: 'Heartless', duration: 206, plays: '623M', isExplicit: true, artists: [{ name: 'The Weeknd' }], uri: 'spotify:track:7' },
    { id: 8, number: 8, title: 'Faith', duration: 282, plays: '231M', artists: [{ name: 'The Weeknd' }], uri: 'spotify:track:8' },
    { id: 9, number: 9, title: 'Blinding Lights', duration: 200, plays: '3.2B', artists: [{ name: 'The Weeknd' }], uri: 'spotify:track:9' },
    { id: 10, number: 10, title: 'In Your Eyes', duration: 237, plays: '845M', artists: [{ name: 'The Weeknd' }], uri: 'spotify:track:10' },
    { id: 11, number: 11, title: 'Save Your Tears', duration: 216, plays: '1.8B', artists: [{ name: 'The Weeknd' }], uri: 'spotify:track:11' },
    { id: 12, number: 12, title: 'Repeat After Me (Interlude)', duration: 183, plays: '169M', artists: [{ name: 'The Weeknd' }], uri: 'spotify:track:12' },
    { id: 13, number: 13, title: 'After Hours', duration: 360, plays: '575M', artists: [{ name: 'The Weeknd' }], uri: 'spotify:track:13' },
    { id: 14, number: 14, title: 'Until I Bleed Out', duration: 201, plays: '117M', artists: [{ name: 'The Weeknd' }], uri: 'spotify:track:14' },
  ],
  relatedAlbums: [] // Inicializar vacío, se llenará si hay datos disponibles
};

// Auxiliar para formatear duración
const formatDuration = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return '0:00'; // Handle invalid input
  const totalSeconds = Math.floor(seconds); // Asegurarse de que trabajamos con segundos enteros
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60; // Ahora sí dará un entero
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
};

// Función para calcular el color del gradiente basado en la popularidad
const getPopularityGradient = (popularity: number) => {
  if (popularity >= 80) return 'from-green-500 to-green-600';
  if (popularity >= 60) return 'from-green-400 to-yellow-500';
  if (popularity >= 40) return 'from-yellow-400 to-yellow-600';
  return 'from-yellow-500 to-red-500';
};

export default function AlbumPage() {
  const params = useParams();
  const albumId = params?.id as string || '';
  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Estado para seguir qué canción está sonando
  const [currentTrackId, setCurrentTrackId] = useState<string | number | null>(null);
  
  // Estado para almacenar los datos del álbum
  const [albumData, setAlbumData] = useState<AlbumDataType>(fallbackAlbumData);
  
  // Obtener datos del álbum cuando cambia el ID
  useEffect(() => {
    const fetchAlbumData = async () => {
      if (!albumId) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Obtener la URL base de la API
        const apiBaseUrl = getApiBaseUrl();
        
        // Obtener detalles del álbum usando nuestra API
        const response = await axios.get(`${apiBaseUrl}/api/album/${albumId}`, {
          params: {
            language: 'es' // Fallback a español si no hay idioma preferido
          }
        });
        
        if (!response.data || !response.data.details) {
          throw new Error('No se obtuvo información detallada del álbum');
        }
        
        const apiResponse = response.data;
        const albumDetails = apiResponse.details;
        const albumTracks = apiResponse.tracks;
        
        // Transformar los datos al formato esperado por la UI
        const formattedAlbum: AlbumDataType = {
          id: albumDetails.id,
          title: albumDetails.name,
          artist: {
            id: albumDetails.artists?.[0]?.id || 'unknown-artist',
            name: albumDetails.artists?.[0]?.name || 'Artista desconocido'
          },
          releaseDate: albumDetails.release_date || 'Fecha desconocida',
          coverUrl: albumDetails.images?.[0]?.url || '/placeholder-album.jpg',
          duration: `${Math.floor(albumTracks.reduce((acc: number, track: any) => acc + (track.duration || 0), 0) / 60)} min`,
          description: `Álbum de ${albumDetails.artists?.[0]?.name || 'Artista desconocido'}, lanzado el ${albumDetails.release_date || 'fecha desconocida'}.`,
          label: albumDetails.label || 'Sello desconocido',
          popularity: albumDetails.popularity || 50,
          tracks: albumTracks.map((track: any, index: number) => {
            return {
              id: track.id || track.spotifyId || `${albumDetails.id}-track-${index}`,
              number: index + 1,
              title: track.title || 'Título desconocido',
              duration: track.duration || 180,
              plays: `${Math.floor(Math.random() * 100) + 10}M`,
              isExplicit: track.explicit === true,
              artists: track.artist ? [{ name: track.artist }] : [{ name: 'Artista desconocido' }],
              uri: track.uri || `spotify:track:${track.spotifyId || track.id}`
            };
          }),
          relatedAlbums: []
        };
        
        setAlbumData(formattedAlbum);
      } catch (err: any) {
        console.error('Error al cargar datos del álbum:', err);
        
        // Extraer mensaje de error
        let errorMessage = 'Error al cargar información del álbum. Por favor, intenta de nuevo más tarde.';
        
        if (axios.isAxiosError(err)) {
          if (err.response?.status === 404) {
            errorMessage = 'No se encontró el álbum solicitado.';
          } else if (err.response?.data?.error) {
            errorMessage = err.response.data.error;
          }
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        setError(errorMessage);
        // Mantener los datos de fallback en caso de error
        setAlbumData(fallbackAlbumData);
      } finally {
        setLoading(false);
      }
    };
    
    if (mounted) {
      fetchAlbumData();
    }
  }, [albumId, mounted]);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Mostrar un indicador de carga mientras se obtienen los datos
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4">Cargando álbum...</p>
        </div>
      </div>
    );
  }

  // Si hay un error, mostrar una página de error amigable
  if (error) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="p-4 mb-6 bg-red-100 border border-red-400 text-red-700 rounded">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-semibold">Error</h3>
          </div>
          <p className="mt-2">{error}</p>
        </div>
        
        <div className="mt-8 p-6 bg-gray-800 rounded-lg">
          <h3 className="text-xl font-bold mb-4">Modo Demo</h3>
          <p className="mb-2">En el modo demo, puedes explorar álbumes de diversos artistas.</p>
          <p className="mb-4">Prueba volver a la página principal para encontrar álbumes disponibles.</p>
          
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

  // Calcular la duración total
  const totalTracks = albumData.tracks.length;
  const totalDuration = albumData.tracks.reduce((acc, track) => acc + track.duration, 0);
  const totalMinutes = Math.floor(totalDuration / 60);
  
  // Función para reproducir una canción del álbum
  const handlePlayTrack = async (track: TrackType) => {
    try {
      // Si se hace clic en la misma canción que está sonando, alternar reproducción/pausa
      if (playing && track.id === currentTrackId) {
        // Aquí se podría implementar la lógica para pausar la canción actual
        setPlaying(false);
        return;
      }
      
      setPlaying(true);
      
      // ---> Log para depuración
      console.log('[AlbumPage] Llamando a playTrack con:', JSON.stringify(track, null, 2));
      
      // Llamar al servicio de reproducción
      await playTrack(track);
      
      // Actualizar el ID de la canción actual
      setCurrentTrackId(track.id);
    } catch (error) {
      console.error('Error al reproducir la canción:', error);
      // Aquí se podría mostrar un mensaje de error al usuario
    }
  };

  // Función para reproducir todo el álbum
  const handlePlayAlbum = () => {
    if (albumData.tracks.length === 0) return;
    
    // Si ya está reproduciendo, pausar
    if (playing) {
      setPlaying(false);
      // Aquí se podría implementar la pausa mediante un servicio de reproducción
      return;
    }
    
    // Reproducir la primera canción del álbum
    handlePlayTrack(albumData.tracks[0]);
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Hero section con portada y detalles del álbum */}
      <section className="relative">
        <div className="h-64 md:h-80 lg:h-96 w-full relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background"></div>
          <div 
            className="absolute inset-0 bg-center bg-cover" 
            style={{ 
              backgroundImage: `url(${albumData.coverUrl})`,
              filter: 'blur(40px)',
              opacity: 0.4
            }}>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative -mt-32 md:-mt-48 lg:-mt-56 flex flex-col md:flex-row items-end md:items-center gap-6 md:gap-10">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="w-48 h-48 md:w-64 md:h-64 shadow-2xl rounded-lg overflow-hidden"
            >
              <img 
                src={albumData.coverUrl} 
                alt={albumData.title}
                className="w-full h-full object-cover"
              />
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex-1"
            >
              <div className="text-sm font-medium uppercase tracking-wide">Álbum</div>
              <h1 className="text-3xl md:text-5xl font-bold mt-1">{albumData.title}</h1>
              
              <div className="flex items-center mt-3 space-x-2">
                <img 
                  src={albumData.coverUrl} // En un caso real, usaríamos la imagen del artista
                  alt={albumData.artist.name}
                  className="w-6 h-6 rounded-full object-cover"
                />
                <Link href={`/artist/${albumData.artist.id}`} className="text-lg font-medium hover:text-primary transition-colors">
                  {albumData.artist.name}
                </Link>
                <span className="text-gray-400 mx-1">•</span>
                <span className="text-gray-400">{albumData.releaseDate}</span>
                <span className="text-gray-400 mx-1">•</span>
                <span className="text-gray-400">{totalTracks} canciones, {totalMinutes} min</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
      
      {/* Sección principal del álbum */}
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              {/* Acciones del álbum */}
              <div className="flex items-center space-x-4 mb-6">
                <button 
                  className="bg-primary hover:bg-primary-dark text-white py-2 px-6 rounded-full font-medium transition-colors focus:outline-none flex items-center"
                  onClick={handlePlayAlbum}
                >
                  {playing ? (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path>
                      </svg>
                      Pausar
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"></path>
                      </svg>
                      Reproducir
                    </>
                  )}
                </button>
                
                <button 
                  className="text-white/80 hover:text-white p-2 focus:outline-none"
                  onClick={() => setIsLiked(!isLiked)}
                >
                  <svg className="w-8 h-8" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                </button>
                
                <button className="text-white/80 hover:text-white p-2 focus:outline-none">
                  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path>
                  </svg>
                </button>
              </div>
              
              {/* Lista de canciones */}
              <div className="mt-6">
                <div className="border-b border-gray-800 pb-2 mb-2">
                  <div className="grid grid-cols-12 text-sm text-gray-400 px-4 gap-4">
                    <div className="col-span-1">#</div>
                    <div className="col-span-5">Título</div>
                    <div className="col-span-4 hidden md:block">Artista</div>
                    <div className="col-span-2 text-right">Duración</div>
                  </div>
                </div>
                
                <div className="space-y-1">
                  {albumData.tracks.map((track, index) => (
                    <motion.div
                      key={track.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.03 }}
                      className={`grid grid-cols-12 items-center py-2 px-4 rounded-md hover:bg-card-bg transition-colors group ${currentTrackId === track.id ? 'bg-card-bg' : ''} gap-4`}
                    >
                      <div className="col-span-1 flex items-center">
                        <span className="text-gray-400 group-hover:hidden">{track.number}</span>
                        <button 
                          className="text-white hidden group-hover:block"
                          onClick={() => handlePlayTrack(track)}
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"></path>
                          </svg>
                        </button>
                      </div>
                      <div className="col-span-5 cursor-pointer" onClick={() => handlePlayTrack(track)}>
                        <div className={`font-medium truncate ${currentTrackId === track.id ? 'text-primary' : ''}`}>
                          {track.title}
                        </div>
                      </div>
                      <div className="col-span-4 text-gray-400 truncate hidden md:block">
                        {track.artists?.[0]?.name || 'Artista desconocido'}
                      </div>
                      <div className="col-span-2 text-right text-gray-400 flex items-center justify-end">
                        <span>{formatDuration(track.duration)}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Información complementaria y álbumes relacionados */}
            <div>
              {/* Datos del álbum */}
              <div className="bg-card-bg rounded-xl p-6 mb-8">
                <h3 className="text-lg font-semibold mb-4">Acerca de</h3>
                
                <p className="text-gray-300 mb-6">{albumData.description}</p>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Lanzamiento:</span>
                    <span>{albumData.releaseDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Sello:</span>
                    <span>{albumData.label}</span>
                  </div>
                </div>
                
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400 text-sm">Popularidad:</span>
                    <span className="text-sm font-medium">{albumData.popularity}%</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-gradient-to-r ${getPopularityGradient(albumData.popularity)}`}
                      style={{ width: `${albumData.popularity}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              {/* Álbumes relacionados */}
              {albumData.relatedAlbums.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Más de {albumData.artist.name}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {albumData.relatedAlbums.map((album: RelatedAlbumType, index: number) => (
                      <motion.div
                        key={album.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                      >
                        <Link href={`/album/${album.id}`}>
                          <div className="bg-card-bg rounded-lg p-3 hover:bg-card-bg/80 transition-colors group">
                            <div className="relative aspect-square rounded-md overflow-hidden mb-2">
                              <img 
                                src={album.coverUrl} 
                                alt={album.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                            <h4 className="font-medium text-sm truncate">{album.title}</h4>
                            <p className="text-gray-400 text-xs truncate">{album.artist}</p>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
} 