'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCustomNotifications } from '@/hooks/useCustomNotifications';
import useProfile, { UserProfile, Playlist, Track, Artist } from '@/hooks/useProfile';
import { CircularProgress, Box } from '@mui/material';

// Formateador de números para mostrar de forma amigable
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

export default function UserProfilePage(): JSX.Element {
  const params = useParams();
  const userId = params?.id ? String(params.id) : 'default';
  const [mounted, setMounted] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const { showNotification, addSystemNotification } = useCustomNotifications();
  const { profile, loading, error } = useProfile();

  // En una aplicación real, usaríamos el ID para obtener los datos del usuario

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleFollowToggle = (): void => {
    setIsFollowing(prev => !prev);

    if (!isFollowing) {
      // Si vamos a seguir al usuario
      showNotification(`Ahora sigues a ${profile?.name || 'Usuario'}`, 'success');
    } else {
      // Si dejamos de seguir al usuario
      showNotification(`Has dejado de seguir a ${profile?.name || 'Usuario'}`, 'info');
    }

    // Aquí iría la llamada a la API para seguir/dejar de seguir al usuario
  };

  if (!mounted) return <></>;

  if (loading) {
    return (
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <CircularProgress color="secondary" />
      </Box>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-card-bg p-8 rounded-lg text-center">
          <h2 className="text-xl font-bold mb-4">Error al cargar el perfil</h2>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  // Si no hay perfil, usar datos de ejemplo
  const fallbackPlaylists: Playlist[] = [
    { id: '501', name: 'Mis Favoritos 2023', imageUrl: 'https://picsum.photos/200/200?random=82', trackCount: 42, owner: 'musiclover' },
    { id: '502', name: 'Para Trabajar', imageUrl: 'https://picsum.photos/200/200?random=83', trackCount: 65, owner: 'musiclover' },
    { id: '503', name: 'Clásicos del Rock', imageUrl: 'https://picsum.photos/200/200?random=84', trackCount: 28, owner: 'musiclover' },
    { id: '504', name: 'Noche de Jazz', imageUrl: 'https://picsum.photos/200/200?random=85', trackCount: 18, owner: 'musiclover' },
  ];

  const fallbackTracks: Track[] = [
    { id: '601', title: 'Bohemian Rhapsody', artist: 'Queen', albumCover: 'https://picsum.photos/200/200?random=86', playedAt: 'Hace 2 horas' },
    { id: '602', title: 'Imagine', artist: 'John Lennon', albumCover: 'https://picsum.photos/200/200?random=87', playedAt: 'Hace 5 horas' },
    { id: '603', title: 'Billie Jean', artist: 'Michael Jackson', albumCover: 'https://picsum.photos/200/200?random=88', playedAt: 'Ayer' },
    { id: '604', title: 'Hotel California', artist: 'Eagles', albumCover: 'https://picsum.photos/200/200?random=89', playedAt: 'Ayer' },
    { id: '605', title: 'Stairway to Heaven', artist: 'Led Zeppelin', albumCover: 'https://picsum.photos/200/200?random=90', playedAt: 'Hace 2 días' },
  ];

  const fallbackArtists: Artist[] = [
    { id: '701', name: 'Queen', imageUrl: 'https://picsum.photos/200/200?random=91' },
    { id: '702', name: 'The Beatles', imageUrl: 'https://picsum.photos/200/200?random=92' },
    { id: '703', name: 'Pink Floyd', imageUrl: 'https://picsum.photos/200/200?random=93' },
    { id: '704', name: 'Radiohead', imageUrl: 'https://picsum.photos/200/200?random=94' },
    { id: '705', name: 'Daft Punk', imageUrl: 'https://picsum.photos/200/200?random=95' },
    { id: '706', name: 'Miles Davis', imageUrl: 'https://picsum.photos/200/200?random=96' },
  ];

  const fallbackUser: UserProfile = {
    id: userId || 'default',
    username: 'musiclover',
    name: 'Carlos Mendoza',
    email: 'carlos@example.com',
    bio: 'Amante de la música en todas sus formas. Coleccionista de vinilos y asistente frecuente a conciertos.',
    profileImage: 'https://picsum.photos/200/200?random=80',
    coverImage: 'https://picsum.photos/1200/400?random=81',
    followers: 238,
    following: 412,
    favoriteGenres: [
      { name: 'Rock', color: '#e74c3c' },
      { name: 'Indie', color: '#3498db' },
      { name: 'Jazz', color: '#f1c40f' },
      { name: 'Electrónica', color: '#1abc9c' }
    ],
    playlists: fallbackPlaylists,
    recentlyPlayed: fallbackTracks,
    topArtists: fallbackArtists,
    statistics: {
      totalListeningTime: 4850,
      totalTracks: 12450,
      favoriteGenre: 'Rock',
      averageDailyTime: 145
    }
  };

  const userData = profile || fallbackUser;
  const userPlaylists = userData.playlists || fallbackPlaylists;
  const userRecentlyPlayed = userData.recentlyPlayed || fallbackTracks;
  const userTopArtists = userData.topArtists || fallbackArtists;

  // Función para renderizar el contenido según la tab activa
  const renderContent = (): JSX.Element => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              {/* Playlists del usuario */}
              <div className="mb-10">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">Playlists</h3>
                  {userPlaylists.length > 4 && (
                    <Link href={`/user/${userData.id}/playlists`} className="text-primary hover:text-primary-light transition-colors text-sm">
                      Ver todo
                    </Link>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {userPlaylists.map((playlist: Playlist, index: number) => (
                    <motion.div
                      key={playlist.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                    >
                      <Link href={`/playlist/${playlist.id}`}>
                        <div className="bg-card-bg rounded-lg p-3 hover:bg-card-bg/80 transition-colors h-full flex flex-col group">
                          <div className="relative aspect-square rounded-md overflow-hidden mb-2">
                            <img
                              src={playlist.imageUrl}
                              alt={playlist.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button className="bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z"></path>
                                </svg>
                              </button>
                            </div>
                          </div>
                          <h4 className="font-medium text-sm line-clamp-1">{playlist.name}</h4>
                          <p className="text-gray-400 text-xs mt-1">{playlist.trackCount} canciones</p>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Reproducidos recientemente */}
              <div className="mb-10">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">Reproducidos recientemente</h3>
                  {userRecentlyPlayed.length > 5 && (
                    <Link href={`/user/${userData.id}/recent`} className="text-primary hover:text-primary-light transition-colors text-sm">
                      Ver todo
                    </Link>
                  )}
                </div>

                <div className="bg-card-bg rounded-xl overflow-hidden">
                  {userRecentlyPlayed.map((track: Track, index: number) => (
                    <motion.div
                      key={track.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className={`flex items-center p-3 hover:bg-white/5 transition-colors group ${
                        index !== userRecentlyPlayed.length - 1 ? 'border-b border-gray-800' : ''
                      }`}
                    >
                      <div className="w-10 h-10 rounded overflow-hidden">
                        <img
                          src={track.albumCover}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="ml-3 flex-grow">
                        <div className="font-medium text-sm">{track.title}</div>
                        <div className="text-gray-400 text-xs flex items-center">
                          <span>{track.artist}</span>
                          <span className="inline-block mx-1">•</span>
                          <span>{track.playedAt}</span>
                        </div>
                      </div>
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-white">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"></path>
                        </svg>
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top artistas */}
            <div>
              <div className="mb-4">
                <h3 className="text-xl font-semibold">Artistas favoritos</h3>
              </div>

              <div className="bg-card-bg rounded-xl p-4">
                {userTopArtists.map((artist: Artist, index: number) => (
                  <motion.div
                    key={artist.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className={`flex items-center py-2 ${
                      index !== userTopArtists.length - 1 ? 'border-b border-gray-800' : ''
                    }`}
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden">
                      <img
                        src={artist.imageUrl}
                        alt={artist.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="ml-3">
                      <Link href={`/artist/${artist.id}`} className="font-medium hover:text-primary transition-colors">
                        {artist.name}
                      </Link>
                      {artist.followers && (
                        <div className="text-gray-400 text-xs">
                          {formatNumber(artist.followers)} seguidores
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Estadísticas del usuario */}
              {userData.statistics && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="mt-6 bg-card-bg rounded-xl p-4"
                >
                  <h3 className="text-lg font-semibold mb-3">Estadísticas</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Tiempo total escuchado</span>
                      <span className="font-medium">{Math.floor(userData.statistics.totalListeningTime / 60)} horas</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Canciones reproducidas</span>
                      <span className="font-medium">{formatNumber(userData.statistics.totalTracks)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Género favorito</span>
                      <span className="font-medium">{userData.statistics.favoriteGenre}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Promedio diario</span>
                      <span className="font-medium">{Math.floor(userData.statistics.averageDailyTime / 60)} horas</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        );

      case 'playlists':
        return (
          <div>
            <h3 className="text-xl font-semibold mb-6">Todas las playlists</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {userPlaylists.map((playlist: Playlist, index: number) => (
                <motion.div
                  key={playlist.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                >
                  <Link href={`/playlist/${playlist.id}`}>
                    <div className="bg-card-bg rounded-lg p-3 hover:bg-card-bg/80 transition-colors h-full flex flex-col group">
                      <div className="relative aspect-square rounded-md overflow-hidden mb-2">
                        <img
                          src={playlist.imageUrl}
                          alt={playlist.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button className="bg-primary text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"></path>
                            </svg>
                          </button>
                        </div>
                      </div>
                      <h4 className="font-medium text-sm line-clamp-1">{playlist.name}</h4>
                      <p className="text-gray-400 text-xs mt-1">{playlist.trackCount} canciones</p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        );

      case 'artists':
        return (
          <div>
            <h3 className="text-xl font-semibold mb-6">Artistas favoritos</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {userTopArtists.map((artist: Artist, index: number) => (
                <motion.div
                  key={artist.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                >
                  <Link href={`/artist/${artist.id}`}>
                    <div className="bg-card-bg rounded-lg p-3 hover:bg-card-bg/80 transition-colors h-full flex flex-col group">
                      <div className="relative aspect-square rounded-full overflow-hidden mb-3">
                        <img
                          src={artist.imageUrl}
                          alt={artist.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <h4 className="font-medium text-sm text-center line-clamp-1">{artist.name}</h4>
                      {artist.followers && (
                        <p className="text-gray-400 text-xs mt-1 text-center">
                          {formatNumber(artist.followers)} seguidores
                        </p>
                      )}
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        );

      case 'recent':
        return (
          <div>
            <h3 className="text-xl font-semibold mb-6">Historial de reproducción</h3>
            <div className="bg-card-bg rounded-xl overflow-hidden">
              {userRecentlyPlayed.map((track: Track, index: number) => (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="flex items-center p-4 hover:bg-white/5 transition-colors group border-b border-gray-800"
                >
                  <div className="w-12 h-12 rounded overflow-hidden">
                    <img
                      src={track.albumCover}
                      alt={track.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="ml-4 flex-grow">
                    <div className="font-medium">{track.title}</div>
                    <div className="text-gray-400 text-sm">
                      {track.artist}
                    </div>
                  </div>
                  <div className="text-gray-400 text-sm">
                    {track.playedAt}
                  </div>
                  <button className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity p-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"></path>
                    </svg>
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        );

      default:
        return <div>Selecciona una pestaña</div>;
    }
  };

  return (
    <div className="min-h-screen pt-6 pb-20">
      {/* Banner y perfil */}
      <div className="relative mb-10">
        <div className="h-60 md:h-80 relative overflow-hidden rounded-xl">
          <div
            className="absolute inset-0 bg-center bg-cover"
            style={{
              backgroundImage: `url(${profile?.coverImage || userData.coverImage})`,
              filter: 'brightness(0.7)'
            }}>
          </div>

          {/* Gradiente de overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-end -mt-20 md:-mt-24 relative z-10">
            <div className="w-36 h-36 rounded-full border-4 border-background overflow-hidden flex-shrink-0 mb-4 md:mb-0">
              <img
                src={profile?.profileImage || userData.profileImage}
                alt={profile?.name || userData.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="md:ml-6 flex-grow">
              <div className="flex flex-col md:flex-row items-start md:items-end justify-between">
                <div>
                  <h1 className="text-3xl font-bold">{profile?.name || userData.name}</h1>
                  <p className="text-gray-400 mt-1">@{profile?.username || userData.username}</p>
                </div>
                <div className="flex mt-4 md:mt-0">
                  <button
                    className={`${isFollowing ? 'bg-card-bg text-white' : 'bg-primary hover:bg-primary-dark text-white'} py-2 px-6 rounded-full font-medium transition-colors focus:outline-none`}
                    onClick={handleFollowToggle}
                  >
                    {isFollowing ? 'Siguiendo' : 'Seguir'}
                  </button>
                </div>
              </div>

              <div className="flex items-center mt-4 space-x-4">
                <div>
                  <span className="font-semibold">{formatNumber(userData.followers)}</span>
                  <span className="text-gray-400 ml-1">seguidores</span>
                </div>
                <div>
                  <span className="font-semibold">{formatNumber(userData.following)}</span>
                  <span className="text-gray-400 ml-1">seguidos</span>
                </div>
                {userPlaylists.length > 0 && (
                  <div>
                    <span className="font-semibold">{userPlaylists.length}</span>
                    <span className="text-gray-400 ml-1">playlists</span>
                  </div>
                )}
              </div>

              {userData.bio && (
                <p className="text-gray-300 mt-4 max-w-3xl">
                  {userData.bio}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Tabs de navegación */}
        <div className="border-b border-gray-800 mb-6 overflow-x-auto flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-1 font-medium transition-colors relative ${
              activeTab === 'overview' ? 'text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Inicio
            {activeTab === 'overview' && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab('playlists')}
            className={`pb-3 px-1 font-medium transition-colors relative ${
              activeTab === 'playlists' ? 'text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Playlists
            {activeTab === 'playlists' && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab('artists')}
            className={`pb-3 px-1 font-medium transition-colors relative ${
              activeTab === 'artists' ? 'text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Artistas
            {activeTab === 'artists' && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
              />
            )}
          </button>

          <button
            onClick={() => setActiveTab('recent')}
            className={`pb-3 px-1 font-medium transition-colors relative ${
              activeTab === 'recent' ? 'text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Recientes
            {activeTab === 'recent' && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
              />
            )}
          </button>
        </div>

        {/* Contenido principal */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {renderContent()}
        </motion.div>
      </div>
    </div>
  );
}
