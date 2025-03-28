'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// Datos de ejemplo para demostración
const albumData = {
  id: '1',
  title: 'After Hours',
  artist: {
    id: '1',
    name: 'The Weeknd'
  },
  releaseDate: '20 de marzo, 2020',
  coverUrl: 'https://picsum.photos/500/500?random=50',
  genre: 'R&B, Pop',
  duration: '56 min 20 seg',
  description: 'After Hours es el cuarto álbum de estudio del cantante canadiense The Weeknd, lanzado el 20 de marzo de 2020. Cuenta con los exitosos sencillos "Blinding Lights" y "Save Your Tears".',
  label: 'XO / Republic Records',
  popularity: 92,
  tracks: [
    { id: 1, number: 1, title: 'Alone Again', duration: 240, plays: '141M' },
    { id: 2, number: 2, title: 'Too Late', duration: 234, plays: '138M' },
    { id: 3, number: 3, title: 'Hardest To Love', duration: 193, plays: '211M' },
    { id: 4, number: 4, title: 'Scared To Live', duration: 226, plays: '159M' },
    { id: 5, number: 5, title: 'Snowchild', duration: 242, plays: '157M' },
    { id: 6, number: 6, title: 'Escape From LA', duration: 352, plays: '192M' },
    { id: 7, number: 7, title: 'Heartless', duration: 206, plays: '623M', isExplicit: true },
    { id: 8, number: 8, title: 'Faith', duration: 282, plays: '231M' },
    { id: 9, number: 9, title: 'Blinding Lights', duration: 200, plays: '3.2B' },
    { id: 10, number: 10, title: 'In Your Eyes', duration: 237, plays: '845M' },
    { id: 11, number: 11, title: 'Save Your Tears', duration: 216, plays: '1.8B' },
    { id: 12, number: 12, title: 'Repeat After Me (Interlude)', duration: 183, plays: '169M' },
    { id: 13, number: 13, title: 'After Hours', duration: 360, plays: '575M' },
    { id: 14, number: 14, title: 'Until I Bleed Out', duration: 201, plays: '117M' },
  ],
  relatedAlbums: [
    { id: 2, title: 'Dawn FM', artist: 'The Weeknd', coverUrl: 'https://picsum.photos/200/200?random=51' },
    { id: 3, title: 'Starboy', artist: 'The Weeknd', coverUrl: 'https://picsum.photos/200/200?random=52' },
    { id: 4, title: 'Beauty Behind the Madness', artist: 'The Weeknd', coverUrl: 'https://picsum.photos/200/200?random=53' },
    { id: 5, title: 'My Dear Melancholy,', artist: 'The Weeknd', coverUrl: 'https://picsum.photos/200/200?random=54' },
  ]
};

// Auxiliar para formatear duración
const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
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
  const albumId = params.id as string;
  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  
  // En una aplicación real, usaríamos el ID para obtener los datos del álbum
  console.log(`Mostrando el álbum con ID: ${albumId}`);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Calcular la duración total
  const totalTracks = albumData.tracks.length;
  const totalDuration = albumData.tracks.reduce((acc, track) => acc + track.duration, 0);
  const totalMinutes = Math.floor(totalDuration / 60);
  
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
                  onClick={() => setPlaying(!playing)}
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
                  <div className="grid grid-cols-12 text-sm text-gray-400 px-4">
                    <div className="col-span-1">#</div>
                    <div className="col-span-6">Título</div>
                    <div className="col-span-3 text-right hidden md:block">Reproducciones</div>
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
                      className="grid grid-cols-12 items-center py-2 px-4 rounded-md hover:bg-card-bg transition-colors group"
                    >
                      <div className="col-span-1 flex items-center">
                        <span className="text-gray-400 group-hover:hidden">{track.number}</span>
                        <button className="text-white hidden group-hover:block">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"></path>
                          </svg>
                        </button>
                      </div>
                      <div className="col-span-6">
                        <div className="font-medium truncate">{track.title}</div>
                        {track.isExplicit && (
                          <span className="inline-block bg-gray-700 text-white text-[10px] px-1.5 py-0.5 rounded mr-2">
                            E
                          </span>
                        )}
                      </div>
                      <div className="col-span-3 text-right text-gray-400 hidden md:block">
                        {track.plays}
                      </div>
                      <div className="col-span-2 text-right text-gray-400 flex items-center justify-end">
                        <div className="mr-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="text-white/70 hover:text-white">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                            </svg>
                          </button>
                        </div>
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
                  <div className="flex justify-between">
                    <span className="text-gray-400">Género:</span>
                    <span>{albumData.genre}</span>
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
              <div>
                <h3 className="text-lg font-semibold mb-4">Más de {albumData.artist.name}</h3>
                <div className="grid grid-cols-2 gap-4">
                  {albumData.relatedAlbums.map((album, index) => (
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
            </div>
          </div>
        </div>
      </section>
    </div>
  );
} 