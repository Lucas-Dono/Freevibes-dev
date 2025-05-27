'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Container,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Button,
  Tab,
  Tabs,
  Paper,
  styled,
  useTheme,
  alpha,
  Divider,
  CircularProgress,
  IconButton,
  Avatar,
  Alert
} from '@mui/material';
import { PlayArrow, Search, Refresh, FavoriteRounded, ChevronLeft, ChevronRight, AccessTime, Login } from '@mui/icons-material';
import { getUserPersonalRotation, getFeaturedPlaylists, getSavedTracks, getNewReleases, searchArtists, searchMultiType, getTopTracks } from '@/services/spotify';
import { youtubeMusicAPI } from '@/services/youtube';
import Slider from "react-slick";
// Importar estilos para el carrusel
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RecentTracksService, EnrichedTrack } from '@/services/history/recentTracksService';
import { ClockIcon, SpotifyIcon, DeezerIcon, LastFmIcon, YoutubeIcon, RefreshIcon, MusicNoteIcon } from '@/components/icons/MusicIcons';
import useSpotify from '@/hooks/useSpotify';
import { signIn } from 'next-auth/react';
import Cookies from 'js-cookie';
import UnifiedMusicCard, { createTrackCard } from '@/components/UnifiedMusicCard';
import Image from 'next/image';
import { useAuth } from '@/components/providers/AuthProvider';
import demoDataService from '@/services/demo/demo-data-service';
import Star from '@/components/icons/Star';
import { useArtistNavigation } from '@/hooks/useArtistNavigation';
import axios from 'axios';
import { getApiBaseUrl } from '@/lib/api-config';
import { useTranslation } from '@/hooks/useTranslation';
import FeaturedPlaylists from '@/components/FeaturedPlaylists';
import { useCustomNotifications } from '@/hooks/useCustomNotifications';
import { useIsMobile } from '@/hooks/useIsMobile';
import MobileHomePage from '@/components/mobile/MobileHomePage';

const StyledCard = styled(Card)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.background.paper, 0.5),
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.03))',
  boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)',
  borderRadius: '12px',
  overflow: 'hidden',
  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 12px 20px rgba(0, 0, 0, 0.3)',
  }
}));

const PlatformTag = styled(Box)(({ theme, platform }: { theme: any, platform: 'spotify' | 'lastfm' | 'deezer' | 'youtube' }) => {
  const platformColors = {
    spotify: '#1DB954',
    deezer: '#FF0092',
    lastfm: '#D51007',
    youtube: '#FF0000'
  };

  return {
    backgroundColor: platformColors[platform] || theme.palette.primary.main,
    color: '#fff',
    fontSize: '0.625rem',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };
});

const StyledCardMedia = styled(CardMedia)(({ theme }) => ({
  height: 180,
  transition: 'transform 0.5s ease',
  '&:hover': {
    transform: 'scale(1.05)',
  }
}));

const CategoryButton = styled(Button)(({ theme, selected }: { theme: any, selected?: boolean }) => ({
  borderRadius: '20px',
  margin: '0 8px 16px 0',
  backgroundColor: selected ? theme.palette.primary.main : alpha(theme.palette.background.paper, 0.7),
  color: selected ? theme.palette.primary.contrastText : theme.palette.text.primary,
  textTransform: 'none',
  fontSize: '0.875rem',
  padding: '6px 16px',
  fontWeight: selected ? 'bold' : 'normal',
  '&:hover': {
    backgroundColor: selected ? theme.palette.primary.dark : alpha(theme.palette.background.paper, 0.9),
  }
}));

const TimeLabel = styled(Typography)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  fontSize: '0.75rem',
  color: theme.palette.text.secondary,
}));

// Helper para formatear fechas relativas
function formatRelativeTime(timestamp: number): string {
  const now = new Date().getTime();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'justo ahora';
  if (minutes < 60) return `hace ${minutes} minutos`;
  if (hours < 24) return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  if (days < 7) return `hace ${days} ${days === 1 ? 'día' : 'días'}`;

  const date = new Date(timestamp);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

// Componentes personalizados para las flechas del carrusel
const SlickArrow = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  zIndex: 1,
  top: '50%',
  transform: 'translateY(-50%)',
  backgroundColor: alpha(theme.palette.secondary.main, 0.8),
  color: 'white',
  '&:hover': {
    backgroundColor: theme.palette.secondary.main,
  },
  '&.slick-disabled': {
    display: 'none',
  },
}));

const NextArrow = (props: any) => {
  const { onClick } = props;
  return (
    <SlickArrow
      onClick={onClick}
      sx={{ right: 0 }}
      size="medium"
    >
      <ChevronRight />
    </SlickArrow>
  );
};

const PrevArrow = (props: any) => {
  const { onClick } = props;
  return (
    <SlickArrow
      onClick={onClick}
      sx={{ left: 0 }}
      size="medium"
    >
      <ChevronLeft />
    </SlickArrow>
  );
};

// Componente para mostrar alerta de login cuando se requiere autenticación
const LoginAlert = ({ onLogin }: { onLogin: () => void }) => {
  const { t } = useTranslation();

  return (
    <Alert
      severity="warning"
      sx={{ mb: 3, '& .MuiAlert-message': { width: '100%' } }}
      action={
        <Button
          color="warning"
          variant="outlined"
          size="small"
          onClick={onLogin}
        >
          {t('auth.login')}
        </Button>
      }
    >
      {t('auth.spotifyAuthRequired')}
    </Alert>
  );
};

// Zona de descubrimiento
const recommendedArtist = {
  name: 'Arctic Monkeys',
  description: 'Banda de rock',
  image: '/img/arctic-monkeys.webp', // Cambiado a imagen local
};

// Datos para Géneros destacados
const featuredGenre = {
  name: 'Indie Rock',
  image: '/img/indie-rock.webp', // Cambiado a imagen local
  artistCount: 4200,
};

  // Definir un tipo para las pistas personales
  interface PersonalTrack {
    id: string;
    name: string;
    album?: {
      images: Array<{ url: string }>;
      name: string;
    };
    artists: Array<{ name: string; id: string }>;
    isTopTrack?: boolean;
    duration_ms?: number;
    uri?: string;
  }

  // Definir un tipo para unificar diferentes elementos en la rotación personal
  interface MixedContentItem {
    id: string;
    name: string;
    type: 'track' | 'artist' | 'playlist' | 'album';
    images?: Array<{ url: string }>;
    image?: string;
    coverUrl?: string;
    artists?: Array<{ name: string; id: string }>;
    album?: {
      name: string;
      images: Array<{ url: string }>;
    };
    owner?: {
      display_name: string;
    };
    description?: string;
    uri?: string;
  }

  // Función de utilidad para eliminar duplicados basados en título y artista
  const removeDuplicateTracks = <T extends {
    name?: string;
    title?: string;
    artists?: Array<{name: string}>;
    artist?: string;
  }>(tracks: T[]): T[] => {
    const seen = new Map<string, boolean>();

    return tracks.filter((track) => {
      // Obtener título normalizado
      const title = (track.title || track.name || '').toLowerCase().trim();

      // Obtener artista normalizado
      let artist = '';
      if (track.artists && track.artists.length > 0) {
        artist = track.artists.map(a => a.name).join(',').toLowerCase().trim();
      } else if (track.artist) {
        artist = track.artist.toLowerCase().trim();
      }

      // Crear clave única basada en título y artista
      const key = `${title}:${artist}`;

      // Si ya hemos visto esta combinación, filtrar el elemento
      if (seen.has(key)) {
        return false;
      }

      // Caso contrario, marcar como visto y mantener el elemento
      seen.set(key, true);
      return true;
    });
  };

// Función de utilidad para obtener la URL de imagen de un artista
function getArtistImageUrl(artist: any) {
  // Si tiene propiedad images y hay al menos una imagen
  if (artist.images && artist.images.length > 0 && artist.images[0].url) {
    console.log(`[ArtistCard] Usando imagen de images[0].url para ${artist.name}`);
    return artist.images[0].url;
  }

  // Si tiene una imagen directa en la propiedad image
  if (artist.image) {
    console.log(`[ArtistCard] Usando imagen de image para ${artist.name}`);
    return artist.image;
  }

  // Si hay una imagen en image_url
  if (artist.image_url) {
    console.log(`[ArtistCard] Usando imagen de image_url para ${artist.name}`);
    return artist.image_url;
  }

  // Usar placeholder si no hay imagen
  console.warn(`[ArtistCard] No se encontró imagen para ${artist.name}, usando placeholder`);
  return "https://placehold.co/400x400/purple/white?text=Artista";
}

export default function HomePage() {
  const { isAuthenticated, isDemo, preferredLanguage } = useAuth();
  const { t, language } = useTranslation();
  const { session: spotifySession, isAuthenticated: spotifyAuth } = useSpotify();
  const router = useRouter();
  const theme = useTheme();
  const userId = spotifySession?.user?.id || '';
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados unificados
  const [personalTracks, setPersonalTracks] = useState<PersonalTrack[]>([]);
  // Reemplazar por un estado para contenido mixto
  const [personalContent, setPersonalContent] = useState<MixedContentItem[]>([]);
  const [recentTracks, setRecentTracks] = useState<EnrichedTrack[]>([]);
  const [featuredPlaylists, setFeaturedPlaylists] = useState<any[]>([]);
  const [newReleases, setNewReleases] = useState<any[]>([]);
  const [recommendedArtists, setRecommendedArtists] = useState<any[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [recentlyPlayed, setRecentlyPlayed] = useState<EnrichedTrack[]>([]);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [exploreError, setExploreError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);

  // Estados de carga y error
  const [loading, setLoading] = useState({
    personal: false,
    recent: false,
    featured: false,
    newReleases: false,
    artists: false
  });
  const [isTabLoading, setIsTabLoading] = useState(false);
  const [error, setError] = useState<{ personal: string | null; recent: string | null; featured: string | null; newReleases: string | null; artists: string | null; }>({
    personal: null,
    recent: null,
    featured: null,
    newReleases: null,
    artists: null
  });

  // Lista de géneros predefinidos con nombres amigables
  const genres = [
    { id: 'pop', name: 'Pop' },
    { id: 'rock', name: 'Rock' },
    { id: 'hiphop', name: 'Hip Hop' },
    { id: 'electronic', name: 'Electrónica' },
    { id: 'jazz', name: 'Jazz' },
    { id: 'classical', name: 'Clásica' },
    { id: 'latin', name: 'Latina' },
    { id: 'metal', name: 'Metal' },
    { id: 'indie', name: 'Indie' },
    { id: 'r&b', name: 'R&B' }
  ];

  // Memo de tracks recientes filtrados
  const filteredRecentTracks = useMemo(() => {
    if (!recentlyPlayed || !recentlyPlayed.length) return [];
    // Primero filtramos las canciones sin portada, luego eliminamos duplicados
    const withCover = recentlyPlayed.filter((item: EnrichedTrack) => item && item.cover);
    return removeDuplicateTracks(withCover);
  }, [recentlyPlayed]);

  // Añadir estado para el tiempo de carga mínimo
  const [recentTracksMinLoadingTime, setRecentTracksMinLoadingTime] = useState(true);
  const [recentTracksTimer, setRecentTracksTimer] = useState<any>(null);

  const [cookieData, setCookieData] = useState<any>({});

  const { musicNotifications } = useCustomNotifications();

  useEffect(() => {
    console.log('[HomePage] Cargando página Home');
    console.log('[HomePage] Estado de autenticación:', { isAuthenticated, isLoading: !!spotifyAuth });

    // Verificar cookies disponibles
    const cookies = {
      hasRefreshToken: !!Cookies.get('spotify_refresh_token'),
      hasAuthToken: !!Cookies.get('auth_token'),
      hasUser: !!Cookies.get('spotify_user'),
      hasExpiration: !!Cookies.get('spotify_token_expiration'),
    };

    setCookieData(cookies);
    console.log('[HomePage] Cookies disponibles:', cookies);

    // Forzar una carga inicial de la rotación personal
    fetchPersonalRotation();
    fetchRecentlyPlayedTracks();
  }, [isAuthenticated, spotifyAuth]);

  // Si estamos en modo demo, configura el idioma en el servicio de datos demo
  useEffect(() => {
    if (isDemo && preferredLanguage) {
      demoDataService.setLanguage(preferredLanguage);
      console.log(`[Home] Modo demo activo con idioma: ${preferredLanguage}`);

      // Asegurarnos de cargar datos demo para la rotación personal
      setTimeout(() => {
        if (personalContent.length === 0 && !loading.personal) {
          console.log('[Home] Forzando carga de datos en modo demo');
          fetchPersonalRotation();
        }
      }, 1000);
    }
  }, [isDemo, preferredLanguage]);

  // Efecto para cargar datos según la pestaña activa
  useEffect(() => {
    loadTabContent(activeTab);
  }, [activeTab]);

  // Efecto para cargar playlists destacadas
  useEffect(() => {
    const loadFeaturedPlaylists = async () => {
      try {
        const playlists = await fetchFeaturedPlaylists(preferredLanguage || 'es');
        setFeaturedPlaylists(playlists);
      } catch (error) {
        console.error('Error cargando playlists destacadas:', error);
      }
    };

    loadFeaturedPlaylists();
  }, [preferredLanguage]);

  const loadTabContent = async (tabIndex: number) => {
    try {
      console.log(`Cargando contenido para pestaña ${tabIndex}`);
      setExploreLoading(true);
      setExploreError('');

      // Dar un breve tiempo para que otras operaciones (como la verificación de disponibilidad) se completen
      await new Promise(resolve => setTimeout(resolve, 1000));

      switch (tabIndex) {
        case 0: // Canciones populares
          if (newReleases.length === 0) {
            console.log('Cargando canciones populares...');
            try {
              // Utilizamos getTopTracks en lugar de getNewReleases
              const spotifyData = await getTopTracks(20);
              console.log('Datos de canciones populares recibidos:', spotifyData);

              if (spotifyData && spotifyData.items && spotifyData.items.length > 0) {
                // Marcar todas las canciones como tipo 'track'
                const tracks = spotifyData.items.map((track: any) => ({
                  ...track,
                  type: 'track'  // Aseguramos que todos sean tipo track
                }));

                setNewReleases(tracks);
                console.log('Canciones populares cargadas:', tracks.length);
                  } else {
                console.warn('No se obtuvieron canciones populares válidas');
              }
            } catch (error) {
              console.error('Error al cargar canciones populares:', error);
              // No establecer error para permitir que los datos de fallback se muestren
            }
          }
          break;

        case 1: // Escuchado recientemente
          if (recentlyPlayed.length === 0) {
            console.log('Cargando canciones escuchadas recientemente...');
            // Configurar un tiempo máximo para el indicador de carga
            setRecentTracksMinLoadingTime(true);

            // Establecer un temporizador de seguridad para desactivar el loading después de 10 segundos
            if (recentTracksTimer) {
              clearTimeout(recentTracksTimer);
            }

            const timer = setTimeout(() => {
              setRecentTracksMinLoadingTime(false);
            }, 10000);

            setRecentTracksTimer(timer);

            fetchRecentlyPlayedTracks();
          } else {
            // Si ya tenemos datos, asegurarse de que no se muestre el indicador de loading
            setRecentTracksMinLoadingTime(false);
          }
          break;

        case 2: // Playlists destacadas
          if (featuredPlaylists.length === 0) {
            console.log('Cargando playlists destacadas...');
            try {
              const playlistsData = await getFeaturedPlaylists(20);
              if (playlistsData && playlistsData.playlists && playlistsData.playlists.items) {
                setFeaturedPlaylists(playlistsData.playlists.items);
                console.log('Playlists destacadas cargadas:', playlistsData.playlists.items.length);
                } else {
                console.warn('No se obtuvieron playlists destacadas válidas');
              }
            } catch (error) {
              console.error('Error al cargar playlists destacadas:', error);
              // No establecer error para permitir que los datos de fallback se muestren
            }
          }
          break;

        case 3: // Artistas recomendados
          if (recommendedArtists.length === 0) {
            console.log('Cargando artistas recomendados...');
            try {
              // Intentar obtener artistas basados en géneros
              const userGenres = ['pop', 'rock', 'hiphop', 'electronic', 'latin'];
              let artists: any[] = [];

              // Seleccionar un género aleatorio
              const mainGenre = userGenres[Math.floor(Math.random() * userGenres.length)];

              // Verificar si estamos en modo demo
              if (isDemo) {
                console.log(`[Home] Modo demo: Cargando artistas desde datos demo para ${mainGenre}`);
                try {
                  // Usar directamente los datos demo para artistas
                  const demoArtistsData = await demoDataService.getSearchResults('artist');
                  artists = demoArtistsData?.artists?.items || [];
                  console.log(`[Home] Artistas demo cargados:`, artists.length);
                } catch (error) {
                  console.error(`[Home] Error al cargar artistas demo:`, error);
                }
              } else {
                // Modo normal: usar la API de Spotify
                try {
                  console.log(`Buscando artistas para género: ${mainGenre}`);
                  const artistsData = await searchArtists(mainGenre);

                  if (artistsData && artistsData.artists && artistsData.artists.items) {
                    artists = artistsData.artists.items;
                    console.log(`Artistas encontrados para ${mainGenre}:`, artists.length);
                  }
                } catch (error) {
                  console.error(`Error al buscar artistas para ${mainGenre}:`, error);
                }
              }

              setRecommendedArtists(artists);
            } catch (error) {
              console.error('Error al cargar artistas recomendados:', error);
              // No establecer error para permitir que los datos de fallback se muestren
            }
          }
          break;

        default:
          break;
      }

      setExploreLoading(false);
    } catch (error) {
      console.error('Cargando contenido de pestaña:', error);

      // Verificar si es un error de autenticación
      if (error instanceof Error && error.message.includes('No autenticado')) {
        console.warn('Error de autenticación detectado en carga de contenido');
        setAuthError(true);
        setExploreError('Se requiere iniciar sesión con Spotify para acceder a este contenido.');
      } else {
      setExploreError('Ocurrió un error al cargar el contenido. Por favor intenta de nuevo.');
      }

      setExploreLoading(false);
      setRecentTracksMinLoadingTime(false); // Asegurar que se detenga el loading mínimo en caso de error
    }
  };

  const fetchPersonalRotation = async () => {
    setLoading(prev => ({ ...prev, personal: true }));
    try {
      console.log('[Home] Cargando rotación personal mixta');
      let tracks: any[] = [];
      let artists: any[] = [];
      let playlists: any[] = [];
      let albums: any[] = [];

      if (isDemo) {
        // En modo demo, obtener datos de archivos JSON
        console.log('[Home] Cargando datos demo para rotación personal mixta');
        try {
          // Cargar tracks
          const demoTopTracks = await demoDataService.getTopTracks();
          console.log('[Home] Estructura de demoTopTracks:', JSON.stringify(demoTopTracks).substring(0, 150));

          // Extraer correctamente las canciones - verificando la estructura
          if (demoTopTracks && demoTopTracks.items && Array.isArray(demoTopTracks.items)) {
            tracks = demoTopTracks.items;
          } else if (Array.isArray(demoTopTracks)) {
            tracks = demoTopTracks;
          } else {
            console.warn('[Home] Estructura inesperada de demoTopTracks:', demoTopTracks);
            tracks = [];
          }

          // Cargar artistas (utilizando las funciones disponibles en el servicio demo)
          try {
            // El servicio demo no tiene getTopArtists, usamos los resultados de búsqueda de artistas
            const demoArtistsData = await demoDataService.getSearchResults('artist');
            artists = demoArtistsData?.artists?.items || [];
          } catch (e) {
            console.warn('[Home] Error al cargar artistas demo:', e);
            artists = [];
          }

          // Cargar álbumes (usando new_releases como fuente de álbumes)
          try {
            const demoAlbums = await demoDataService.getNewReleases();
            albums = demoAlbums && demoAlbums.albums && demoAlbums.albums.items
              ? demoAlbums.albums.items
              : [];
        } catch (e) {
            console.warn('[Home] Error al cargar álbumes demo:', e);
            albums = [];
          }

        } catch (e) {
          console.warn('[Home] Error al cargar contenido demo para rotación personal:', e);
        }
      } else {
        // Obtener datos reales de las APIs
        try {
          // Cargar tracks de forma paralela
          const [personalRotation, userSavedTracks] = await Promise.all([
            getUserPersonalRotation(8),
            getSavedTracks(8)
          ]);

          tracks = [...(Array.isArray(personalRotation) ? personalRotation : []),
                    ...(Array.isArray(userSavedTracks) ? userSavedTracks : [])];
          tracks = removeDuplicateTracks(tracks);

          // Obtener playlists destacadas
          try {
            const playlists_data = await getFeaturedPlaylists(5);
            if (playlists_data && playlists_data.playlists && playlists_data.playlists.items) {
              playlists = playlists_data.playlists.items;
            }
        } catch (e) {
            console.warn('[Home] Error al cargar playlists destacadas:', e);
          }

          // Obtener nuevos lanzamientos como álbumes
          try {
            const newAlbums = await getNewReleases(5);
            if (newAlbums && newAlbums.albums && newAlbums.albums.items) {
              albums = newAlbums.albums.items;
            }
          } catch (e) {
            console.warn('[Home] Error al cargar nuevos lanzamientos:', e);
          }

          // Obtener artistas recomendados basados en géneros populares
          const userGenres = ['pop', 'rock', 'latin', 'indie', 'electronic'];
          const randomGenre = userGenres[Math.floor(Math.random() * userGenres.length)];

          try {
            // Corregimos la llamada a searchArtists: no acepta un objeto como segundo parámetro
            const artistsData = await searchArtists(randomGenre, 5);
            if (artistsData && artistsData.artists && artistsData.artists.items) {
              artists = artistsData.artists.items;
            }
          } catch (e) {
            console.warn('[Home] Error al cargar artistas recomendados:', e);
          }
        } catch (e) {
          console.error('[Home] Error al obtener datos para rotación personal:', e);
        }
      }

      console.log('[Home] Datos obtenidos para rotación personal mixta:', {
        tracks: tracks.length,
        artists: artists.length,
        playlists: playlists.length,
        albums: albums.length
      });

      // Convertir todo a formato MixedContentItem
      const mixedItems: MixedContentItem[] = [
        // Convertir tracks - con mejor manejo de propiedades
        ...tracks.map(track => {
          // Depurar el objeto track
          console.log('[Home] Estructura de track:', JSON.stringify(track).substring(0, 150));

          return {
            id: track.id || `track-${Math.random()}`,
            name: track.name || track.title || 'Canción sin título',
            type: 'track' as const,
            images: track.album?.images || [],
            coverUrl: track.album?.images?.[0]?.url || '/placeholder-album.jpg',
            artists: track.artists || [{ name: track.artist || 'Artista desconocido', id: '' }],
            album: track.album,
            uri: track.uri || `spotify:track:${track.id}`
          };
        }),

        // Convertir artistas
        ...artists.map(artist => ({
          id: artist.id,
          name: artist.name || 'Artista desconocido',
          type: 'artist' as const,
          images: artist.images || [],
          image: artist.images?.[0]?.url || '/placeholder-artist.jpg',
          description: artist.description || `Artista de ${artist.genres?.[0] || 'música'}`
        })),

        // Convertir playlists
        ...playlists.map(playlist => ({
          id: playlist.id,
          name: playlist.name || 'Playlist sin título',
          type: 'playlist' as const,
          images: playlist.images || [],
          coverUrl: playlist.images?.[0]?.url || '/placeholder-playlist.jpg',
          owner: playlist.owner,
          description: playlist.description || 'Playlist'
        })),

        // Convertir álbumes
        ...albums.map(album => ({
          id: album.id,
          name: album.name || 'Álbum sin título',
          type: 'album' as const,
          images: album.images || [],
          coverUrl: album.images?.[0]?.url || '/placeholder-album.jpg',
          artists: album.artists || []
        }))
      ];

      // Mezclar aleatoriamente los elementos
      const shuffledItems = mixedItems.sort(() => 0.5 - Math.random());

      // Seleccionar hasta 20 elementos para mostrar
      setPersonalContent(shuffledItems.slice(0, 20));

      // Mantener el estado anterior para compatibilidad
      setPersonalTracks(tracks.slice(0, 20));

      setError(prev => ({ ...prev, personal: null }));
      setAuthError(false); // Resetear error de autenticación si la petición fue exitosa
    } catch (error) {
      console.error('[Home] Error al cargar rotación personal mixta:', error);
      setError(prev => ({ ...prev, personal: 'No se pudo cargar tu rotación personal. Por favor, inténtalo de nuevo más tarde.' }));
      setPersonalContent([]); // Asegurarse de que el estado tenga un array vacío
      setPersonalTracks([]); // Mantener el estado anterior vacío para compatibilidad
    } finally {
      setLoading(prev => ({ ...prev, personal: false }));
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Configuración del carrusel
  const sliderSettings = {
    dots: false,
    infinite: personalTracks.length > 4,
    speed: 500,
    slidesToShow: 5,
    slidesToScroll: 2,
    nextArrow: <NextArrow />,
    prevArrow: <PrevArrow />,
    responsive: [
      {
        breakpoint: 1400,
        settings: {
          slidesToShow: 4,
          slidesToScroll: 2,
        }
      },
      {
        breakpoint: 1200,
        settings: {
          slidesToShow: 3,
          slidesToScroll: 2,
        }
      },
      {
        breakpoint: 900,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1,
        }
      },
      {
        breakpoint: 600,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
        }
      }
    ]
  };

  // Renderizar loading skeletons si está cargando
  const renderLoadingSkeletons = () => (
    <Slider {...sliderSettings}>
      {Array.from(new Array(6)).map((_: any, index: number) => (
        <div key={`skeleton-${index}`}>
          <Card sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            margin: '0 8px',
            height: '100%'
          }}>
            <Box sx={{ height: 160, backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
            <CardContent sx={{ py: 1, px: 1 }}>
              <Box sx={{ height: 20, width: '80%', backgroundColor: 'rgba(255, 255, 255, 0.1)', mb: 1 }} />
              <Box sx={{ height: 16, width: '50%', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
            </CardContent>
          </Card>
        </div>
      ))}
    </Slider>
  );

  // Componente para mostrar un artista
  const ArtistCard = ({ artist }: { artist: any }) => {
    const { navigateToArtist } = useArtistNavigation();

    const artistImage = getArtistImageUrl(artist);

    console.log(`[ArtistCard] Renderizando artista:`, {
      name: artist.name,
      id: artist.id,
      imageUrl: artistImage,
      popularity: artist.popularity
    });

    // Convertir la popularidad a una escala de 1-5 estrellas (3 estrellas por defecto si no hay info)
    const starRating = artist.popularity ? Math.round(artist.popularity / 20) : 3;

    // Identificar la fuente del artista (YouTube, Spotify o fallback) - mantener para compatibilidad
    const artistSource = artist.source || (artist.id?.startsWith('spotify:') ? 'spotify' : 'unknown');
    const isFallback = artist.isFallback || artist.id?.startsWith('fallback-') || artistSource === 'fallback';

    const handleArtistClick = (e: React.MouseEvent) => {
      e.preventDefault();
      console.log(`[ArtistCard] Clic en tarjeta de artista: ${artist.name} (${artist.id})`);

      navigateToArtist(artist.id, artist.name, {
        redirigirABusqueda: true,
        mostrarDetalles: true,
        usarNavegacionDirecta: true,
        urlFallback: '/home'
      }).then(result => {
        console.log(`[ArtistCard] Resultado de navegación:`, result);
      }).catch(err => {
        console.error(`[ArtistCard] Error en navegación:`, err);
      });
    };

    return (
      <div
        className="artist-card group bg-zinc-800/70 hover:bg-zinc-700/70 transition-all duration-300 rounded-xl overflow-hidden cursor-pointer shadow-xl hover:shadow-2xl hover:translate-y-[-5px] transform h-full"
        onClick={handleArtistClick}
      >
          <div className="aspect-square relative overflow-hidden">
            <Image
              src={artistImage}
              alt={artist.name}
              width={300}
              height={300}
              className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500 rounded-t-xl"
              onError={(e) => {
                console.error(`[ArtistCard] Error al cargar imagen para ${artist.name}:`, artistImage);
                // Reemplazar con imagen de placeholder
                const target = e.target as HTMLImageElement;
                target.src = "https://placehold.co/400x400/purple/white?text=Artista";
              }}
            />

            {/* Gradiente de superposición */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex items-end">
              <div className="p-4 w-full">
                <h3 className="text-white font-bold line-clamp-1">
                  {artist.name}
                </h3>
                <div className="flex items-center mt-1">
                  {/* Mostrar estrellas basadas en popularidad */}
                  {Array.from({ length: starRating }).map((_, index) => (
                    <Star key={index} className="h-4 w-4 text-yellow-400" />
                  ))}
                  {Array.from({ length: 5 - starRating }).map((_, index) => (
                    <Star key={index} className="h-4 w-4 text-gray-600" />
                  ))}
                </div>
              </div>
            </div>
          </div>
      </div>
    );
  };

  // Función para cargar el historial de canciones escuchadas
  const fetchRecentlyPlayedTracks = async () => {
    setLoading(prev => ({ ...prev, recent: true }));
    try {
      // Verificar si estamos en modo demo
      if (isDemo) {
        console.log('[Home] Modo demo: Generando historial de canciones');
        try {
          // Intentar obtener datos demo de múltiples fuentes
          let demoTracks = [];

          // 1. Intentar obtener datos del servicio demo
          try {
            // Usar datos de canciones populares del servicio demo
            const topTracksData = await demoDataService.getTopTracks();
            if (topTracksData && topTracksData.items && topTracksData.items.length > 0) {
              demoTracks = topTracksData.items.slice(0, 15);
              console.log('[Home] Obtenidas canciones populares del servicio demo:', demoTracks.length);
            }
          } catch (error) {
            console.warn('[Home] Error al obtener canciones populares del servicio demo:', error);
          }

          // 2. Si no hay suficientes tracks, añadir datos de búsqueda
          if (demoTracks.length < 15) {
            try {
              const searchResults = await demoDataService.getSearchResults('track');
              if (searchResults && searchResults.tracks && searchResults.tracks.items) {
                const searchTracks = searchResults.tracks.items.slice(0, 15 - demoTracks.length);
                demoTracks = [...demoTracks, ...searchTracks];
                console.log('[Home] Añadidos tracks de búsqueda:', searchTracks.length);
              }
            } catch (error) {
              console.warn('[Home] Error al obtener resultados de búsqueda:', error);
            }
          }

          // 3. Si aún no hay suficientes, usar getTopTracks como último recurso
          if (demoTracks.length < 5) {
            try {
              console.log('[Home] Usando getTopTracks como último recurso');
              const spotifyData = await getTopTracks(25);
              if (spotifyData && spotifyData.items && spotifyData.items.length > 0) {
                demoTracks = spotifyData.items;
              }
            } catch (error) {
              console.warn('[Home] Error al obtener tracks con getTopTracks:', error);
            }
          }

          // Transformar canciones populares en formato de historial reciente
          if (demoTracks.length > 0) {
            const recentTracksData = demoTracks.map((track: any, index: number) => {
              // Generar tiempo aleatorio en las últimas 24 horas
              const hoursAgo = Math.random() * 24;
              const timestamp = Date.now() - (hoursAgo * 60 * 60 * 1000);

              // Enriquecer track con información adicional
              return {
                id: track.id || `track-${Math.random().toString(36).substr(2, 9)}`,
                trackId: track.id,
                trackName: track.name || track.title || 'Track Demo',
                artistName: track.artists?.[0]?.name || track.artist || 'Artista Demo',
                artistId: track.artists?.[0]?.id || 'artist-demo',
                albumName: track.album?.name || 'Álbum Demo',
                albumId: track.album?.id || 'album-demo',
                albumCover: track.album?.images?.[0]?.url || '/placeholder-album.jpg',
                cover: track.album?.images?.[0]?.url || '/placeholder-album.jpg',
                duration: track.duration_ms || 180000,
                uri: track.uri || `spotify:track:${track.id}`,
                spotifyId: track.uri?.split(':')[2] || track.id,
                // Tiempo aleatorio en las últimas 24 horas
                playedAt: timestamp,
                // Fuente aleatoria entre estas opciones
                source: ['spotify', 'youtube', 'deezer'][Math.floor(Math.random() * 3)],
                // Indicar que es un track de demo
                isDemo: true,
                // Para ordenar aleatoriamente
                sortIndex: Math.random()
              };
            });

            // Ordenar los tracks por tiempo de reproducción (más recientes primero)
            recentTracksData.sort((a: any, b: any) => b.playedAt - a.playedAt);

            // Limitar a 20 tracks y actualizar estado
            setRecentlyPlayed(removeDuplicateTracks(recentTracksData as EnrichedTrack[]).slice(0, 20));
            console.log('[Home] Historial demo generado con', recentTracksData.length, 'canciones');
          } else {
            console.warn('[Home] No se pudieron obtener canciones para el historial demo');
            setRecentlyPlayed([]);
          }
        } catch (error) {
          console.error('[Home] Error al generar historial demo:', error);
          setRecentlyPlayed([]);
        } finally {
          setLoading(prev => ({ ...prev, recent: false }));
          // Asegurarse de desactivar el tiempo mínimo de carga
          setTimeout(() => {
            setRecentTracksMinLoadingTime(false);
          }, 500);
        }
        return;
      }

      // Para modo normal, mantener la implementación original
      // Agregar un timeout local adicional como respaldo
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Timeout local al obtener historial'));
        }, 12000); // 12 segundos (un poco más que el timeout del servicio)
      });

      // Competir entre la petición al servicio y el timeout local
      const tracks = await Promise.race([
        RecentTracksService.getHistory(20),
        timeoutPromise
      ]);

      // Aplicar filtro de duplicados antes de actualizar el estado
      setRecentlyPlayed(removeDuplicateTracks(tracks));
    } catch (error) {
      console.error('Error al cargar historial de escucha:', error);
      // Usar un array vacío en caso de error para evitar que la UI se rompa
      setRecentlyPlayed([]);
      // Opcional: mostrar un mensaje de error al usuario
      setExploreError('No se pudo cargar el historial. Inténtalo de nuevo más tarde.');
    } finally {
      setLoading(prev => ({ ...prev, recent: false }));
      // Asegurar que el indicador de tiempo mínimo de carga se desactive
      setTimeout(() => {
        setRecentTracksMinLoadingTime(false);
      }, 1000);
    }
  };

  // Función para manejar la reproducción de canciones y registrarlas en el historial
  const handlePlayTrack = async (uri: string | undefined, e: React.MouseEvent, trackInfo?: any) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!uri) {
      console.error('URI de canción no disponible');
      return;
    }

    try {
      // Si es la misma canción, pausar/reanudar
      if (currentTrack === uri) {
        setIsPlaying(!isPlaying);
        // Aquí se podría implementar la pausa/reanudación con el SDK de Spotify
        console.log(isPlaying ? 'Pausando' : 'Reanudando', uri);
      } else {
        // Reproducir nueva canción
        setCurrentTrack(uri);
        setIsPlaying(true);
        console.log('Reproduciendo:', uri);

        // Verificar si tenemos información de la pista para enviar
        let trackName, artistName, trackData;

        if (trackInfo) {
          // Si se proporciona información directamente como parámetro
          trackName = trackInfo.title || (trackInfo as any).name || '';
          artistName = trackInfo.artist || ((trackInfo as any).artists?.[0]?.name) || '';
          trackData = {
            trackId: uri,
            name: trackName,
            artist: artistName
          };
        } else {
          // Intentar extraer del evento a partir del DOM (para casos donde no se pasa trackInfo)
          // Buscar información del track en el DOM cercano al botón de reproducción
          const card = e?.currentTarget ? (e.currentTarget as HTMLElement).closest('.MuiCard-root') : null;

          if (card) {
            const nameElement = card.querySelector('[data-track-name]');
            const artistElement = card.querySelector('[data-track-artist]');

            trackName = nameElement?.getAttribute('data-track-name') || '';
            artistName = artistElement?.getAttribute('data-track-artist') || '';

            // Si no encontramos datos en atributos, intentar obtener del texto
            if (!trackName || !artistName) {
              // Extraer del texto visible en el card
              const titleElement = card.querySelector('h3, .MuiTypography-body2');
              const subtitleElement = card.querySelector('.MuiTypography-caption');

              trackName = titleElement?.textContent || '';
              artistName = subtitleElement?.textContent || '';
            }
          }

          trackData = {
            trackId: uri,
            name: trackName,
            artist: artistName
          };
        }

        console.log(`Intentando reproducir: "${trackData.name}" de "${trackData.artist}"`);

        // Llamar a la API para obtener el ID de YouTube
        try {
          const response = await fetch('/api/spotify/play', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(trackData),
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al reproducir');
          }

          // Obtener la respuesta con el ID de YouTube
          const youtubeData = await response.json();

          if (youtubeData.videoId) {
            // Aquí es donde necesitamos conectarnos con el PlayerContext para reproducir el video

            // Crear un objeto Track con la información necesaria para el reproductor
            const track = {
              id: uri,
              title: youtubeData.title || trackName,
              artist: youtubeData.artist || artistName,
              album: typeof trackInfo.album === 'string' ? trackInfo.album : ((trackInfo as any).album?.name || ''),
              cover: youtubeData.thumbnail || trackInfo.cover || ((trackInfo as any).album?.images?.[0]?.url) || '',
              duration: youtubeData.duration || 0,
              spotifyId: uri,
              youtubeId: youtubeData.videoId
            };

            console.log('Enviando evento de reproducción con track:', JSON.stringify(track));

            try {
              // Usar el evento personalizado para comunicar con otros componentes
              const event = new CustomEvent('playTrack', { detail: track });
              window.dispatchEvent(event);
              console.log('Evento playTrack disparado correctamente');
              musicNotifications.onTrackPlay(trackName, artistName);
            } catch (error) {
              console.error('Error al disparar evento playTrack:', error);
            }

            console.log(`Reproduciendo YouTube video: ${youtubeData.videoTitle} (ID: ${youtubeData.videoId})`);
          } else {
            console.error('No se recibió ID de YouTube válido');
          }
        } catch (error) {
          console.error('Error al iniciar reproducción:', error);
          // Falló la reproducción remota, pero mantenemos la UI actualizada
        }
      }

      // Si tenemos información de la pista, la registramos en el historial
      if (trackInfo && userId) {
        try {
          const sourceType = trackInfo.source || 'spotify';
          const trackData = {
            userId: userId,
            trackId: trackInfo.id || 'unknown',
            trackName: trackInfo.title || (trackInfo as any).name || '',
            artistName: trackInfo.artist || ((trackInfo as any).artists?.[0]?.name) || 'Unknown Artist',
            albumName: typeof trackInfo.album === 'string' ? trackInfo.album : ((trackInfo as any).album?.name || ''),
            albumCover: trackInfo.cover || ((trackInfo as any).album?.images?.[0]?.url) || '',
            source: sourceType as 'spotify' | 'deezer' | 'lastfm' | 'youtube' | 'local',
            sourceData: {
              uri: (trackInfo as any).uri || '',
              duration_ms: trackInfo.duration || (trackInfo as any).duration_ms || 0
            }
          };

          // Registramos la canción en el historial
          await RecentTracksService.addTrackToHistory(trackData);
        } catch (error) {
          console.error("Error al registrar canción en historial:", error);
        }
      }
    } catch (error) {
      console.error('Error al manejar reproducción:', error);
    }
  };

  // Componente para mostrar una playlist
  const PlaylistCard = ({ playlist }: { playlist: any }) => {
    const cardData = {
      id: playlist.id,
      title: playlist.name,
      subtitle: playlist.artist || playlist.owner?.display_name || '',
      coverUrl: playlist.images?.[0]?.url || '/placeholder-playlist.jpg',
      isPlayable: false,
      linkTo: `/playlist/${playlist.id}`
    };

    return <UnifiedMusicCard {...cardData} />;
  };

  // Componente para mostrar un álbum/track
  const AlbumCard = ({ album }: { album: any }) => {
    const cardData = {
      id: album.id,
      title: album.name,
      subtitle: album.artists?.[0]?.name || 'Artista desconocido',
      coverUrl: album.images?.[0]?.url || '/placeholder-album.jpg',
      isPlayable: true,
      linkTo: `/album/${album.id}`,
      onPlay: (e: React.MouseEvent) => {
        e.stopPropagation();
        // Logic to play the album
      }
    };

    return <UnifiedMusicCard {...cardData} />;
  };

  // Componente mejorado para la tarjeta de canción escuchada recientemente
  const RecentTrackCard = ({ item }: { item: EnrichedTrack }) => {
    // Usar las propiedades correctas según EnrichedTrack
    const { id, title, artist, album, cover, playedAt, source = 'default', spotifyId, sourceData } = item;

    // Intentar obtener uri de forma más estructurada:
    // 1. Primero desde sourceData (que está en el modelo IRecentTrack)
    // 2. Luego desde el spotifyId (construyendo un URI de Spotify)
    // 3. Finalmente como fallback desde la propiedad directa (para datos demo)
    const uri = sourceData?.uri ||
                (spotifyId ? `spotify:track:${spotifyId}` : (item as any).uri);

    // Determinar color de la insignia según la fuente
    const getBadgeColor = (source: string) => {
      switch (source.toLowerCase()) {
        case 'spotify': return 'bg-green-600';
        case 'youtube': return 'bg-red-600';
        case 'lastfm': return 'bg-red-800';
        case 'deezer': return 'bg-pink-600';
        default: return 'bg-purple-600';
      }
    };

    // Convertir playedAt a número de forma segura
    const getTimestamp = (played: number | Date | string | undefined): number => {
      if (typeof played === 'undefined') return Date.now();
      if (typeof played === 'number') return played;
      if (played instanceof Date) return played.getTime();
      // Si es un string o cualquier otro tipo, intentamos parsear a Date
      try {
        return new Date(played).getTime();
      } catch {
        return Date.now(); // Fallback a la hora actual
      }
    };

    // Obtener el timestamp
    const timestamp = getTimestamp(playedAt);

    // Crear datos para la tarjeta unificada
    const cardData = {
      id: `recent-${id || timestamp}`,
      title: title || 'Canción desconocida',
      subtitle: artist || 'Artista desconocido',
      coverUrl: cover || '/placeholder-album.jpg',
      badge: {
        text: source.charAt(0).toUpperCase() + source.slice(1).toLowerCase(),
        color: getBadgeColor(source)
      },
      isPlayable: true,
      onClick: (e: React.MouseEvent) => handlePlayTrack(spotifyId || uri, e, {
        name: title,
        artist: artist,
        album: album,
        cover: cover,
        uri: uri || (spotifyId ? `spotify:track:${spotifyId}` : undefined),
        spotifyId: spotifyId
      })
    };

    return (
      <div className="flex flex-col">
        <UnifiedMusicCard {...cardData} />
        <TimeLabel variant="caption" className="mt-1">
          <ClockIcon className="inline-block mr-1 w-3 h-3" /> {formatRelativeTime(timestamp)}
        </TimeLabel>
      </div>
    );
  };

  // Renderizar contenido según la pestaña activa
  const renderTabContent = () => {
    if (exploreLoading || (activeTab === 1 && recentTracksMinLoadingTime)) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
          <CircularProgress color="secondary" />
        </Box>
      );
    }

    if (exploreError) {
      return (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography color="error" variant="body1">{exploreError}</Typography>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<Refresh />}
            sx={{ mt: 2 }}
            onClick={() => loadTabContent(activeTab)}
          >
            {t('common.tryAgain')}
          </Button>
        </Box>
      );
    }

    switch (activeTab) {
      case 0: // Canciones populares
        return newReleases.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {newReleases.map((track: any) => (
              <div key={track.id} className="mb-4">
                <UnifiedMusicCard
                  id={track.id}
                  title={track.name}
                  subtitle={track.artists?.[0]?.name || 'Artista desconocido'}
                  coverUrl={track.album?.images?.[0]?.url || '/placeholder-album.jpg'}
                  isPlayable={true}
                  linkTo={`/track/${track.id}`}
                  itemType="track"
                  onPlay={(e) => {
                    e.stopPropagation();
                    if (track.uri) {
                      handlePlayTrack(track.uri, e, track);
                    }
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">No hay canciones populares disponibles</Typography>
          </Box>
        );

      case 1: // Escuchado recientemente
        return filteredRecentTracks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredRecentTracks.map((item: any, index: number) => (
              <div key={`${item.id}-${index}`} className="mb-4">
                <RecentTrackCard item={item} />
              </div>
            ))}
          </div>
        ) : (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">No hay canciones escuchadas recientemente</Typography>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<Refresh />}
              sx={{ mt: 2 }}
              onClick={() => {
                setRecentTracksMinLoadingTime(true);

                // Limpiar temporizador anterior si existe
                if (recentTracksTimer) {
                  clearTimeout(recentTracksTimer);
                }

                // Crear un nuevo temporizador y guardarlo
                const newTimer = setTimeout(() => {
                  setRecentTracksMinLoadingTime(false);
                }, 10000);

                setRecentTracksTimer(newTimer);

                // Cargar los datos
                fetchRecentlyPlayedTracks();
              }}
            >
              {t('common.tryAgain')}
            </Button>
          </Box>
        );

      case 2: // Playlists destacadas
        return featuredPlaylists.length > 0 ? (
          // Usar el componente FeaturedPlaylists que ahora puede manejar tanto playlists como álbumes
          <FeaturedPlaylists
            playlists={featuredPlaylists}
            title={t('home.featuredPlaylists')}
          />
        ) : (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">
              {t('home.noFeaturedPlaylists')}
            </Typography>
          </Box>
        );

      case 3: // Artistas recomendados
        return recommendedArtists.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {recommendedArtists.map((artist: any) => (
              <div key={artist.id} className="mb-4">
                <ArtistCard artist={artist} />
              </div>
            ))}
          </div>
        ) : (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">
              {t('home.noRecommendedArtists')}
            </Typography>
          </Box>
        );

      default:
        return (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">
              {t('home.selectCategory')}
            </Typography>
          </Box>
        );
    }
  };

  // Enlace a búsqueda
  const handleSearchNavigate = () => {
    router.push('/search');
  };

  // Determinar si mostrar sección personal basado en autenticación y datos
  const showPersonalSection = isAuthenticated || isDemo;

  // Limpiar temporizador al desmontar el componente
  useEffect(() => {
    return () => {
      if (recentTracksTimer) {
        clearTimeout(recentTracksTimer);
      }
    };
  }, [recentTracksTimer]);

  // Función para manejar el inicio de sesión
  const handleLogin = () => {
    console.log('[HomePage] Redirigiendo a login');
    signIn('spotify', { callbackUrl: '/home' });
  };

  // Función para recargar los datos y reintentar
  const handleRetry = () => {
    setAuthError(false);
    setPersonalTracks([]);
    setNewReleases([]);
    setFeaturedPlaylists([]);
    fetchPersonalRotation();
    loadTabContent(activeTab);
  };

  // Componente para mostrar un elemento de contenido mixto
  const MixedContentCard = ({ item }: { item: MixedContentItem }) => {
    const getImageUrl = () => {
      // Orden de prioridad para obtener la imagen
      if (item.coverUrl) return item.coverUrl;
      if (item.images && item.images[0] && item.images[0].url) return item.images[0].url;
      if (item.image) return item.image;

      // Por tipo de elemento
      switch (item.type) {
        case 'track': return '/placeholder-album.jpg';
        case 'artist': return '/placeholder-artist.jpg';
        case 'playlist': return '/placeholder-playlist.jpg';
        case 'album': return '/placeholder-album.jpg';
        default: return '/placeholder-album.jpg';
      }
    };

    const getSubtitle = () => {
      switch (item.type) {
        case 'track':
          if (item.artists && item.artists.length > 0) {
            return item.artists.map(a => a.name).join(', ');
          }
          return 'Artista desconocido';
        case 'artist':
          return 'Artista';
        case 'playlist':
          return item.owner?.display_name || 'Playlist';
        case 'album':
          if (item.artists && item.artists.length > 0) {
            return item.artists.map(a => a.name).join(', ');
          }
          return 'Artista desconocido';
        default:
          return '';
      }
    };

    const getLinkTo = () => {
      switch (item.type) {
        case 'track':
          return `/track/${item.id}`;
        case 'artist':
          return `/artist/${item.id}`;
        case 'playlist':
          return `/playlist/${item.id}`;
        case 'album':
          return `/album/${item.id}`;
      }
    };

    const handleItemPlay = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (item.type === 'track' && item.uri) {
        handlePlayTrack(item.uri, e, item);
      }
    };

    return (
      <UnifiedMusicCard
        id={item.id}
        title={item.name}
        subtitle={getSubtitle()}
        coverUrl={getImageUrl()}
        isPlayable={item.type === 'track'}
        linkTo={getLinkTo()}
        itemType={item.type}
        onPlay={handleItemPlay}
      />
    );
  };

  // Función actualizada para obtener playlists destacadas de nuestra nueva API
  const fetchFeaturedPlaylists = async (language = 'es', limit = 10) => {
    try {
      console.log(`[HomePage] Obteniendo playlists destacadas (idioma: ${language}, límite: ${limit})`);
      setLoading(prev => ({ ...prev, featured: true }));

      // Obtener la URL base de la API
      const apiBaseUrl = getApiBaseUrl();

      // Llamar a nuestro nuevo endpoint de playlists
      const response = await axios.get(`${apiBaseUrl}/api/playlists`, {
        params: { language, limit },
        timeout: 10000
      });

      if (response.data && Array.isArray(response.data)) {
        console.log(`[HomePage] Se encontraron ${response.data.length} playlists destacadas`);
        return response.data;
      } else {
        console.warn('[HomePage] La respuesta de playlists no contiene un array', response.data);
        return [];
      }
    } catch (error) {
      console.error('Error obteniendo playlists destacadas:', error);
      setError(prev => ({ ...prev, featured: 'Error al obtener playlists destacadas' }));
      return [];
    } finally {
      setLoading(prev => ({ ...prev, featured: false }));
    }
  };

  // Si es mobile, usar el componente mobile específico
  if (isMobile) {
    return (
      <MobileHomePage 
        personalContent={personalContent}
        recentlyPlayed={filteredRecentTracks}
        featuredPlaylists={featuredPlaylists}
        newReleases={newReleases}
        recommendedArtists={recommendedArtists}
        loading={loading}
        error={error}
        onPlayTrack={handlePlayTrack}
        onArtistClick={(artistId) => router.push(`/artist/${artistId}`)}
        onPlaylistClick={(playlistId) => router.push(`/playlist/${playlistId}`)}
      />
    );
  }

  return (
    <Container maxWidth="xl">
      {/* Mostrar alerta de autenticación si es necesario */}
      {authError && <LoginAlert onLogin={handleLogin} />}

      <Grid container spacing={3}>
      {/* Primera sección - Banner y rotación personal */}
        <Grid item xs={12}>
          {!isMobile ? (
            <Box sx={{ mb: 6 }}>
              {/* Banner principal */}
              <Box
                sx={{
                  position: 'relative',
                  height: '250px',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  mb: 4,
                  background: 'rgba(0,0,0,0.1)',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 0,
                    opacity: 1,
                    background: 'url(https://images.unsplash.com/photo-1511379938547-c1f69419868d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1170&q=80)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'linear-gradient(to right, rgba(0,0,0,0.5), rgba(0,0,0,0.2))'
                    }
                  }}
                />

                <Box sx={{ position: 'relative', zIndex: 1, px: 4 }}>
                  <Typography variant="h3" fontWeight="bold" color="white">
                    {t('home.welcome')}
                  </Typography>
                  <Typography variant="h6" color="rgba(255,255,255,0.8)" sx={{ mb: 2 }}>
                    {t('home.description')}
                  </Typography>
                  {/* Formulario de búsqueda para escritorio */}
                  <Box
                    component="form"
                    onSubmit={(e) => { e.preventDefault(); if (searchTerm?.trim()) { router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}`); } }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '30px',
                      p: 1,
                      pl: 2,
                      width: '400px',
                      maxWidth: '100%',
                      position: 'relative'
                    }}
                  >
                    <Search sx={{ color: 'rgba(255,255,255,0.7)', mr: 1 }} />
                    <input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder={t('search.searchPlaceholder')}
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: 'white',
                        outline: 'none',
                        width: '100%',
                        fontSize: '1rem'
                      }}
                    />
                    {searchTerm && (
                      <IconButton
                        type="submit"
                        size="small"
                        sx={{ color: 'white', position: 'absolute', right: '8px', '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' } }}
                      >
                        <Search fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Box>
              </Box>
            </Box>
          ) : (
            <Box sx={{ px: 2, py: 1, mb: 4 }}>
              <Box
                component="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (searchTerm?.trim()) {
                    router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
                  }
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderRadius: '30px',
                  p: 1,
                  pl: 2
                }}
              >
                <Search sx={{ color: 'rgba(255,255,255,0.7)', mr: 1 }} />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t('search.searchPlaceholder')}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'white',
                    outline: 'none',
                    width: '100%',
                    fontSize: '1rem'
                  }}
                />
                {searchTerm && (
                  <IconButton
                    type="submit"
                    size="small"
                    sx={{
                      color: 'white',
                      position: 'absolute',
                      right: '8px',
                      '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
                    }}
                  >
                    <Search fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Box>
          )}

            {/* Sección rotación personal */}
            {showPersonalSection && (
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  mb: 4,
                  borderRadius: 4,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
                    {isDemo
                      ? t('demo.demoModeRotation')
                      : t('home.personalRotation')}
                  </Typography>
                  {!isDemo && !isAuthenticated && (
                    <Button
                      variant="outlined"
                      color="secondary"
                      startIcon={<Login />}
                      onClick={handleLogin}
                    >
                      {t('auth.login')}
                    </Button>
                  )}
                </Box>

          {loading.personal ? (
            renderLoadingSkeletons()
          ) : error.personal ? (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={handleRetry}>
                  {t('common.retry')}
                </Button>
              }
            >
              {error.personal}
            </Alert>
          ) : personalContent.length > 0 ? (
            <div
              onContextMenu={(e: React.MouseEvent) => {
                // Permitir que el evento se propague normalmente
                // para que lo capturen los elementos hijos
                e.stopPropagation();
                return true;
              }}
            >
              <Slider {...sliderSettings}>
                {personalContent.map((item, index) => (
                  <div key={`${item.id}-${index}`} className="px-2">
                    <MixedContentCard item={item} />
                  </div>
                ))}
              </Slider>
            </div>
          ) : (
            <Alert severity="info">
              {isDemo
                ? t('home.demoModeContent')
                : t('home.emptyContent')
              }
            </Alert>
          )}
        </Paper>
      )}
        </Grid>

      {/* Segunda sección - Explora Música */}
        <Grid item xs={12}>
        <Typography variant="h4" component="h1" fontWeight="bold" sx={{ mb: 2 }}>
          {t('home.exploreMusic')}
        </Typography>

        {/* Pestañas de navegación */}
        <Box sx={{ mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '.MuiTab-root': {
                borderRadius: '20px',
                mx: 0.5,
                color: 'text.primary',
                '&.Mui-selected': {
                  backgroundColor: theme.palette.secondary.main,
                  color: 'white'
                }
              }
            }}
          >
            <Tab label={t('home.popularSongs')} />
            <Tab label={t('home.recentlyPlayed')} />
            <Tab label={t('home.featuredPlaylists')} />
            <Tab label={t('home.recommendedArtist')} />
          </Tabs>
        </Box>

        {/* Contenido de las pestañas */}
        <Box sx={{ minHeight: '400px' }}>
          {renderTabContent()}
        </Box>
        </Grid>

      {/* Zona de descubrimiento */}
        <Grid item xs={12}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
        {t('home.discoveryZone')}
      </Typography>

      <Grid container spacing={3}>
        {/* Artista recomendado */}
        <Grid item xs={12} md={6}>
          <Typography variant="h6" fontWeight="medium" sx={{ mb: 2 }}>
            {t('home.recommendedArtist')}
          </Typography>
          <Paper sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: '12px'
          }}>
            <Box
              component="img"
              src={recommendedArtist.image}
              alt={recommendedArtist.name}
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                mr: 2
              }}
            />
            <Box>
              <Typography variant="h6">{recommendedArtist.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {language === 'es' ? 'Banda de rock' : 'Rock band'}
              </Typography>
              <Button
                variant="text"
                color="secondary"
                sx={{ mt: 1, pl: 0, textTransform: 'none' }}
              >
                {t('home.listenNow')}
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Género destacado */}
        <Grid item xs={12} md={6}>
          <Typography variant="h6" fontWeight="medium" sx={{ mb: 2 }}>
            {t('home.featuredGenre')}
          </Typography>
          <Paper sx={{
            position: 'relative',
            height: 120,
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundImage: `url(${featuredGenre.image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  backgroundColor: 'rgba(0,0,0,0.5)'
                }
              }}
            />
            <Box
              sx={{
                position: 'relative',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1
              }}
            >
              <Typography variant="h5" color="white" fontWeight="bold">
                {featuredGenre.name}
              </Typography>
              <Typography variant="body2" color="white">
                {featuredGenre.artistCount} {t('home.artistsToDiscover')}
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Información basada en el historial */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="body2" color="text.secondary">
          {t('home.listeningHistory')}
        </Typography>
      </Box>
        </Grid>
      </Grid>
    </Container>
  );
}

// Función global auxiliar para obtener playlists destacadas (para uso externo)
async function getFeaturedPlaylistsGlobal(language: string) {
  try {
    const apiBaseUrl = getApiBaseUrl();

    const response = await axios.get(`${apiBaseUrl}/api/playlists`, {
      params: {
        language,
        limit: 6
      }
    });

    return response.data || [];
  } catch (error) {
    console.error('Error obteniendo playlists destacadas:', error);
    return [];
  }
}
