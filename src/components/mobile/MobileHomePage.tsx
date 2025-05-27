import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import MobileBanner from './MobileBanner';
import MobileSection, { MobileCard } from './MobileSection';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTranslation } from '@/hooks/useTranslation';
import { usePlayer } from '@/contexts/PlayerContext';

interface MobileHomePageProps {
  // Props que vienen del componente padre (HomePage)
  personalContent?: any[];
  recentlyPlayed?: any[];
  featuredPlaylists?: any[];
  newReleases?: any[];
  recommendedArtists?: any[];
  loading?: {
    personal: boolean;
    recent: boolean;
    featured: boolean;
    newReleases: boolean;
    artists: boolean;
  };
  error?: {
    personal: string | null;
    recent: string | null;
    featured: string | null;
    newReleases: string | null;
    artists: string | null;
  };
  onPlayTrack?: (uri: string | undefined, e: React.MouseEvent, trackInfo?: any) => void;
  onArtistClick?: (artistId: string) => void;
  onPlaylistClick?: (playlistId: string) => void;
}

const MobileHomePage: React.FC<MobileHomePageProps> = ({
  personalContent = [],
  recentlyPlayed = [],
  featuredPlaylists = [],
  newReleases = [],
  recommendedArtists = [],
  loading = {
    personal: false,
    recent: false,
    featured: false,
    newReleases: false,
    artists: false
  },
  error = {
    personal: null,
    recent: null,
    featured: null,
    newReleases: null,
    artists: null
  },
  onPlayTrack,
  onArtistClick,
  onPlaylistClick
}) => {
  const router = useRouter();
  const { t, language } = useTranslation();
  const { isAuthenticated, isDemo, preferredLanguage } = useAuth();
  const { playTrack } = usePlayer();

  // Estados locales
  const [searchTerm, setSearchTerm] = useState('');

  // Función para obtener imagen de artista
  const getArtistImageUrl = (artist: any) => {
    if (artist?.images && artist.images.length > 0) {
      return artist.images[0].url;
    }
    if (artist?.image) return artist.image;
    return null;
  };

  // Función para obtener imagen de track/album
  const getTrackImageUrl = (item: any) => {
    if (item?.album?.images && item.album.images.length > 0) {
      return item.album.images[0].url;
    }
    if (item?.images && item.images.length > 0) {
      return item.images[0].url;
    }
    if (item?.cover) return item.cover;
    if (item?.coverUrl) return item.coverUrl;
    return null;
  };

  // Función para manejar reproducción de tracks
  const handleTrackPlay = (item: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (onPlayTrack && item.uri) {
      // Crear un evento mock si no se proporciona uno
      const mockEvent = e || {
        preventDefault: () => {},
        stopPropagation: () => {},
        currentTarget: null,
        target: null,
        type: 'click',
        bubbles: false,
        cancelable: true,
        defaultPrevented: false,
        eventPhase: 2,
        isTrusted: false,
        timeStamp: Date.now(),
        nativeEvent: {} as MouseEvent,
        detail: 1,
        view: window,
        altKey: false,
        button: 0,
        buttons: 1,
        clientX: 0,
        clientY: 0,
        ctrlKey: false,
        metaKey: false,
        movementX: 0,
        movementY: 0,
        pageX: 0,
        pageY: 0,
        relatedTarget: null,
        screenX: 0,
        screenY: 0,
        shiftKey: false,
        getModifierState: () => false,
        isDefaultPrevented: () => false,
        isPropagationStopped: () => false,
        persist: () => {}
      } as unknown as React.MouseEvent;
      
      onPlayTrack(item.uri, mockEvent, item);
    } else if (playTrack) {
      // Usar el player context como fallback
      const trackInfo = {
        id: item.id,
        title: item.name || item.title,
        artist: item.artists?.[0]?.name || item.artist || 'Artista Desconocido',
        cover: getTrackImageUrl(item),
        uri: item.uri,
        album: item.album?.name || '',
        duration: item.duration_ms ? Math.floor(item.duration_ms / 1000) : 0
      };
      playTrack(trackInfo);
    }
  };

  // Función para manejar click en artista
  const handleArtistView = (artist: any) => {
    if (onArtistClick) {
      onArtistClick(artist.id);
    } else {
      router.push(`/artist/${artist.id}`);
    }
  };

  // Función para manejar click en playlist
  const handlePlaylistView = (playlist: any) => {
    if (onPlaylistClick) {
      onPlaylistClick(playlist.id);
    } else {
      router.push(`/playlist/${playlist.id}`);
    }
  };

  // Función para navegar a explorar
  const handleExplore = () => {
    router.push('/explore');
  };

  // Función para buscar
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  // Determinar qué datos mostrar
  const displayFeaturedTracks = newReleases.slice(0, 8);
  const displayRecentTracks = recentlyPlayed.slice(0, 4);
  const displayFeaturedPlaylists = featuredPlaylists.slice(0, 6);
  const displayPopularArtists = recommendedArtists.slice(0, 6);
  const displayPersonalContent = personalContent.slice(0, 4);

  // Mostrar loading si cualquier dato importante está cargando
  const isLoading = loading.personal || loading.featured || loading.newReleases;

  if (isLoading && displayFeaturedTracks.length === 0 && displayPersonalContent.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pb-20">
      {/* Barra de búsqueda móvil mejorada */}
      <div className="mobile-search-container">
        <form onSubmit={handleSearch} className="mobile-search-form">
          <div className="mobile-search-input-container">
            <svg className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('search.searchPlaceholder')}
              className="mobile-search-input"
            />
            {searchTerm && (
              <button type="submit" className="mobile-search-button">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Banner principal */}
      <MobileBanner
        title={isDemo ? t('demo.demoMode') : t('home.welcome')}
        subtitle={isDemo ? t('demo.demoDescription') : t('home.description')}
        onAction={handleExplore}
        actionText={t('home.exploreMusic')}
        type="welcome"
      />

      {/* Rotación Personal / Contenido Personalizado */}
      {displayPersonalContent.length > 0 && (
        <MobileSection
          title={isDemo ? t('demo.demoModeRotation') : t('home.personalRotation')}
          layout="carousel"
          showViewAll={true}
          onViewAll={() => router.push('/library')}
        >
          {displayPersonalContent.map((item, index) => (
            <MobileCard
              key={`${item.id}-${index}`}
              title={item.name || item.title || 'Sin título'}
              subtitle={
                item.type === 'artist' 
                  ? item.genres?.[0] || 'Artista'
                  : item.artists?.[0]?.name || item.artist || item.owner?.display_name || 'Desconocido'
              }
              imageUrl={
                item.type === 'artist' 
                  ? getArtistImageUrl(item)
                  : getTrackImageUrl(item)
              }
              onClick={() => {
                if (item.type === 'artist') {
                  handleArtistView(item);
                } else if (item.type === 'playlist') {
                  handlePlaylistView(item);
                } else {
                  handleTrackPlay(item);
                }
              }}
              size="medium"
              type={item.type || 'track'}
            />
          ))}
        </MobileSection>
      )}

      {/* Reproducido Recientemente - Solo mostrar si NO estamos en modo demo */}
      {!isDemo && displayRecentTracks.length > 0 && (
        <MobileSection
          title={t('home.recentlyPlayed')}
          layout="carousel"
          showViewAll={true}
          onViewAll={() => router.push('/library?tab=recent')}
        >
          {displayRecentTracks.map((item, index) => (
            <MobileCard
              key={`recent-${item.id || index}`}
              title={item.track?.name || item.name || item.title || 'Sin título'}
              subtitle={
                item.track?.artists?.[0]?.name || 
                item.artists?.[0]?.name || 
                item.artist || 
                'Artista Desconocido'
              }
              imageUrl={getTrackImageUrl(item.track || item)}
              onClick={() => handleTrackPlay(item.track || item)}
              size="medium"
              type="track"
            />
          ))}
        </MobileSection>
      )}

      {/* Canciones Destacadas */}
      {displayFeaturedTracks.length > 0 && (
        <MobileSection
          title={t('home.popularSongs')}
          layout="grid"
          gridCols={2}
          onViewAll={() => router.push('/explore?tab=tracks')}
        >
          {displayFeaturedTracks.slice(0, 4).map((track, index) => (
            <MobileCard
              key={`featured-${track.id || index}`}
              title={track.name || track.title || 'Sin título'}
              subtitle={
                track.artists?.[0]?.name || 
                track.artist || 
                'Artista Desconocido'
              }
              imageUrl={getTrackImageUrl(track)}
              onClick={() => handleTrackPlay(track)}
              size="medium"
              type="track"
            />
          ))}
        </MobileSection>
      )}

      {/* Playlists Destacadas */}
      {displayFeaturedPlaylists.length > 0 && (
        <MobileSection
          title={t('home.featuredPlaylists')}
          layout="carousel"
          onViewAll={() => router.push('/explore?tab=playlists')}
        >
          {displayFeaturedPlaylists.map((playlist, index) => (
            <MobileCard
              key={`playlist-${playlist.id || index}`}
              title={playlist.name || 'Sin título'}
              subtitle={playlist.owner?.display_name || playlist.description?.slice(0, 30) || 'Playlist'}
              imageUrl={getTrackImageUrl(playlist)}
              onClick={() => handlePlaylistView(playlist)}
              size="medium"
              type="playlist"
            />
          ))}
        </MobileSection>
      )}

      {/* Artistas Populares */}
      {displayPopularArtists.length > 0 && (
        <MobileSection
          title={t('home.recommendedArtist')}
          layout="carousel"
          onViewAll={() => router.push('/explore?tab=artists')}
        >
          {displayPopularArtists.map((artist, index) => (
            <MobileCard
              key={`artist-${artist.id || index}`}
              title={artist.name || 'Sin nombre'}
              subtitle={artist.genres?.[0] || artist.genre || 'Artista'}
              imageUrl={getArtistImageUrl(artist)}
              onClick={() => handleArtistView(artist)}
              size="medium"
              type="artist"
            />
          ))}
        </MobileSection>
      )}

      {/* Banner de descubrimiento */}
      <div className="mt-8">
        <MobileBanner
          title={t('home.discoveryZone')}
          subtitle={t('home.exploreGenresAndArtists')}
          onAction={() => router.push('/explore?tab=genres')}
          actionText={t('home.discover')}
          type="discovery"
        />
      </div>

      {/* Géneros Populares */}
      <MobileSection
        title={t('home.popularGenres')}
        layout="grid"
        gridCols={3}
        showViewAll={false}
      >
        {[
          { name: 'Pop', icon: '🎵', color: 'from-pink-500 to-rose-500' },
          { name: 'Rock', icon: '🎸', color: 'from-red-500 to-orange-500' },
          { name: 'Hip Hop', icon: '🎤', color: 'from-yellow-500 to-amber-500' },
          { name: 'Electronic', icon: '🎛️', color: 'from-blue-500 to-cyan-500' },
          { name: 'Jazz', icon: '🎺', color: 'from-indigo-500 to-purple-500' },
          { name: 'Classical', icon: '🎼', color: 'from-violet-500 to-purple-500' }
        ].map((genre, index) => (
          <motion.div
            key={genre.name}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push(`/explore?genre=${genre.name.toLowerCase()}`)}
            className={`bg-gradient-to-br ${genre.color} rounded-xl p-4 text-center cursor-pointer shadow-lg`}
          >
            <div className="text-2xl mb-2">{genre.icon}</div>
            <h3 className="text-sm font-semibold text-white">{genre.name}</h3>
          </motion.div>
        ))}
      </MobileSection>

      {/* Mensaje de estado si no hay contenido */}
      {!isLoading && 
       displayPersonalContent.length === 0 && 
       displayFeaturedTracks.length === 0 && 
       displayFeaturedPlaylists.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            {isDemo ? t('demo.demoModeContent') : t('home.emptyContent')}
          </h3>
          <p className="text-gray-400 mb-4">
            {isDemo 
              ? 'Explora la música disponible en modo demo'
              : 'Conecta tu cuenta de Spotify para ver contenido personalizado'
            }
          </p>
          <button
            onClick={handleExplore}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-white font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-200"
          >
            {t('home.exploreMusic')}
          </button>
        </div>
      )}
    </div>
  );
};

export default MobileHomePage; 