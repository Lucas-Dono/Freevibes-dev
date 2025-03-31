'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { PlayArrow, Search, Refresh, FavoriteRounded, ChevronLeft, ChevronRight, AccessTime } from '@mui/icons-material';
import { getUserPersonalRotation, getFeaturedPlaylists, getSavedTracks, getNewReleases } from '@/services/spotify';
import { youtubeMusicAPI } from '@/services/youtube';
import Slider from "react-slick";
// Importar estilos para el carrusel
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RecentTracksService, EnrichedTrack } from '@/services/history/recentTracksService';
import { ClockIcon, SpotifyIcon, DeezerIcon, LastFmIcon, YoutubeIcon, RefreshIcon, MusicNoteIcon } from '@/components/icons/MusicIcons';
import { useAuth } from '@/app/context/AuthContext';

const StyledCard = styled(Card)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.background.paper, 0.5),
  backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.03))',
  boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)',
  borderRadius: '12px',
  overflow: 'hidden',
  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  margin: '0 4px',
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

// Artista recomendado
const recommendedArtist = {
  name: 'Arctic Monkeys',
  description: 'Banda de rock',
  image: 'https://i.scdn.co/image/ab6761610000e5eb7da39dea0a72f581535fb11f',
};

// Datos para Géneros destacados
const featuredGenre = {
  name: 'Indie Rock',
  image: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?ixlib=rb-4.0.3',
  artistCount: 42,
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
  
export default function HomePage() {
  const theme = useTheme();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const userId = user?.id || '';
  
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados unificados
  const [personalTracks, setPersonalTracks] = useState<PersonalTrack[]>([]);
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

  // Estados de carga y error
  const [loading, setLoading] = useState({
    personal: false,
    recent: false,
    featured: false,
    newReleases: false,
    artists: false
  });
  const [error, setError] = useState({
    personal: null as string | null,
    recent: null as string | null,
    featured: null as string | null,
    newReleases: null as string | null,
    artists: null as string | null
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

  useEffect(() => {
    fetchPersonalRotation();
    fetchRecentlyPlayedTracks();

    // Agregar estilos personalizados para el carrusel
    const style = document.createElement('style');
    style.innerHTML = `
      .slick-slide {
        padding: 0 10px;
      }
      .slick-list {
        margin: 0 -10px;
      }
    `;
    document.head.appendChild(style);

    // Verificar que la ruta del navegador coincida con la ruta actual
    const checkPathAndRedirect = () => {
      const pathname = window.location.pathname;
      // Si estamos en la página home pero la URL muestra otra ruta
      if (pathname !== '/' && pathname !== '/home' && pathname.length > 1) {
        console.log('Redirigiendo a la ruta correcta:', pathname);
        router.push(pathname);
      }
    };
    
    // Ejecutar verificación después de que el componente se monte
    checkPathAndRedirect();

    return () => {
      document.head.removeChild(style);
      if (recentTracksTimer) {
        clearTimeout(recentTracksTimer);
      }
    };
  }, [router]);

  // Efecto para cargar datos según la pestaña activa
  useEffect(() => {
    loadTabContent(activeTab);
  }, [activeTab]);

  // Función para cargar el contenido de la pestaña seleccionada
  const loadTabContent = async (tabIndex: number) => {
    try {
      setExploreLoading(true);
      setExploreError('');

      switch (tabIndex) {
        case 0: // Nuevos lanzamientos
          if (newReleases.length === 0) {
            console.log('Cargando nuevos lanzamientos...');
            try {
              // Primero intentamos con Spotify para tener base de datos
              const spotifyData = await getNewReleases(20);
              let releases: any[] = [];
              
              if (spotifyData && spotifyData.albums && spotifyData.albums.items && spotifyData.albums.items.length > 0) {
                releases = [...spotifyData.albums.items];
                console.log('Nuevos lanzamientos de Spotify cargados:', releases.length);
              }
              
              // Obtenemos lanzamientos de YouTube Music también
              try {
                console.log('Intentando obtener nuevos lanzamientos de YouTube Music...');
                const ytMusicReleases = await youtubeMusicAPI.getNewReleases(20);
                if (ytMusicReleases && ytMusicReleases.length > 0) {
                  console.log('YouTube Music devolvió', ytMusicReleases.length, 'nuevos lanzamientos');
                  
                  // Filtrar solo aquellos con imágenes válidas
                  const validReleases = ytMusicReleases.filter(release => 
                    release.images && 
                    release.images.length > 0 && 
                    release.images[0].url && 
                    release.images[0].url.length > 0
                  );
                  
                  if (validReleases.length > 0) {
                    // Añadimos los lanzamientos de YouTube Music a los de Spotify
                    releases = [...releases, ...validReleases];
                    console.log('Nuevos lanzamientos de YouTube Music cargados:', validReleases.length);
                  } else {
                    console.warn('Filtradas todas las entradas de YouTube Music por falta de imágenes');
                  }
                } else {
                  console.warn('YouTube Music no devolvió nuevos lanzamientos');
                }
              } catch (ytError) {
                console.error('Error al cargar nuevos lanzamientos de YouTube Music:', ytError);
              }
              
              if (releases.length > 0) {
                // Aplicar filtro de duplicados antes de actualizar el estado
                setNewReleases(removeDuplicateTracks(releases));
                console.log('Total de nuevos lanzamientos cargados:', releases.length);
              } else {
                console.warn('No se obtuvieron nuevos lanzamientos válidos');
              }
            } catch (error) {
              console.error('Error al cargar nuevos lanzamientos:', error);
              // No establecer error para permitir que los datos de fallback se muestren
            }
          }
          break;
          
        case 1: // Escuchado recientemente
          if (recentlyPlayed.length === 0) {
            console.log('Cargando canciones escuchadas recientemente...');
            
            // Iniciar temporizador de carga mínima (10 segundos)
            setRecentTracksMinLoadingTime(true);
            const timer = setTimeout(() => {
              setRecentTracksMinLoadingTime(false);
            }, 10000);
            
            setRecentTracksTimer(timer);
            
            try {
              // Intentar primero con historial propio
              console.log('Intentando cargar historial local primero...');
              try {
                const tracks = await RecentTracksService.getHistory(20);
                if (tracks && tracks.length > 0) {
                  // Aplicar filtro de duplicados antes de actualizar el estado
                  setRecentlyPlayed(removeDuplicateTracks(tracks));
                  console.log('Canciones del historial local cargadas:', tracks.length);
                  
                  // Limpiar el temporizador ya que los datos se cargaron correctamente
                  clearTimeout(timer);
                  setRecentTracksMinLoadingTime(false);
                  break; // Salimos del case si tuvimos éxito
                }
              } catch (historyError) {
                console.error('Error al cargar historial local:', historyError);
              }
              
              // Si no hay datos en el historial, intentar con Spotify
              console.log('Intentando cargar historial de Spotify...');
              // Utilizar getSavedTracks como alternativa, ya que getRecentlyPlayedTracks no está disponible
              const tracks = await getSavedTracks(20);
              if (tracks && tracks.length > 0) {
                // Convertir a formato de historial
                const recentFormat = tracks.map((track: any) => ({
                  id: track.id,
                  title: track.name,
                  artist: track.artists?.[0]?.name || 'Desconocido',
                  album: track.album?.name || '',
                  cover: track.album?.images?.[0]?.url || '',
                  duration: track.duration_ms || 0,
                  playedAt: new Date().getTime(),
                  source: 'spotify'
                }));
                
                // Aplicar filtro de duplicados antes de actualizar el estado
                setRecentlyPlayed(removeDuplicateTracks(recentFormat));
                console.log('Canciones guardadas cargadas como fallback:', recentFormat.length);
                
                // Limpiar el temporizador ya que los datos se cargaron correctamente
                clearTimeout(timer);
                setRecentTracksMinLoadingTime(false);
              } else {
                console.warn('No se obtuvieron canciones recientes de Spotify');
              }
            } catch (error) {
              console.error('Error al cargar canciones recientes:', error);
              // Intentar con el historial local como último recurso
              try {
                const tracks = await RecentTracksService.getHistory(20);
                if (tracks && tracks.length > 0) {
                  // Aplicar filtro de duplicados antes de actualizar el estado
                  setRecentlyPlayed(removeDuplicateTracks(tracks));
                  console.log('Canciones del historial local cargadas como último recurso:', tracks.length);
                  
                  // Limpiar el temporizador ya que los datos se cargaron correctamente
                  clearTimeout(timer);
                  setRecentTracksMinLoadingTime(false);
                }
              } catch (historyError) {
                console.error('Error al cargar historial local:', historyError);
              }
            }
          }
          break;
          
        case 2: // Playlists destacadas
          if (featuredPlaylists.length === 0) {
            console.log('Cargando playlists destacadas...');
            try {
              let allPlaylists: any[] = [];
              
              // Obtener playlists de Spotify
              const spotifyData = await getFeaturedPlaylists(20);
              if (spotifyData && spotifyData.items && spotifyData.items.length > 0) {
                // Agregar el origen a cada playlist
                const spotifyPlaylists = spotifyData.items.map((playlist: any) => ({
                  ...playlist,
                  source: 'spotify'
                }));
                
                allPlaylists = [...spotifyPlaylists];
                console.log('Playlists destacadas de Spotify cargadas:', allPlaylists.length);
              }
              
              // Obtener playlists destacadas de YouTube Music
              try {
                console.log('Intentando obtener playlists destacadas de YouTube Music...');
                const ytMusicPlaylists = await youtubeMusicAPI.getFeaturedPlaylists(20);
                if (ytMusicPlaylists && ytMusicPlaylists.length > 0) {
                  console.log('YouTube Music devolvió', ytMusicPlaylists.length, 'playlists');
                  
                  // Convertir el formato de YouTube Music al formato esperado
                  const formattedYtPlaylists = ytMusicPlaylists
                    .filter((playlist: any) => playlist.thumbnails && playlist.thumbnails.length > 0)
                    .map((playlist: any) => ({
                      id: playlist.playlistId || `yt-${playlist.title.replace(/\s+/g, '_').toLowerCase()}`,
                      name: playlist.title,
                      description: playlist.description || `Playlist de YouTube Music`,
                      images: [{ url: playlist.thumbnails[0]?.url || '' }],
                      owner: { display_name: playlist.author || 'YouTube Music' },
                      tracks: { total: playlist.trackCount || 0 },
                      source: 'youtube'
                    }));
                  
                  if (formattedYtPlaylists.length > 0) {
                    allPlaylists = [...allPlaylists, ...formattedYtPlaylists];
                    console.log('Playlists destacadas de YouTube Music cargadas:', formattedYtPlaylists.length);
                  }
                }
              } catch (ytError) {
                console.error('Error al cargar playlists de YouTube Music:', ytError);
              }
              
              if (allPlaylists.length > 0) {
                setFeaturedPlaylists(removeDuplicateTracks(allPlaylists));
                console.log('Total de playlists destacadas cargadas:', allPlaylists.length);
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
              // Obtener los géneros favoritos del usuario primero (si es posible)
              let userGenres: string[] = [];
              try {
                const response = await fetch('/api/user/genres');
                if (response.ok) {
                  const genresData = await response.json();
                  userGenres = genresData.genres || [];
                  console.log('Géneros del usuario obtenidos:', userGenres);
                }
              } catch (genresError) {
                console.error('Error al obtener géneros del usuario:', genresError);
              }
              
              // Obtener artistas basados en géneros del usuario o preferencias
              let artists: any[] = [];
              
              if (userGenres.length > 0) {
                // Limitar a máximo 3 géneros para evitar demasiadas solicitudes
                const selectedGenres = userGenres.slice(0, 3);
                console.log('Obteniendo artistas por géneros del usuario (limitados):', selectedGenres);
                
                // Realizar una sola solicitud con todos los géneros juntos en lugar de múltiples
                try {
                  // Usar el primer género como principal para evitar demasiadas solicitudes
                  const mainGenre = selectedGenres[0];
                  const genreArtists = await youtubeMusicAPI.searchByGenre(mainGenre, 15);
                  
                  if (genreArtists && Array.isArray(genreArtists)) {
                    // Validar artistas con imágenes
                    const validGenreArtists = genreArtists.filter((artist: any) => 
                      artist && artist.images && artist.images.length > 0 && artist.images[0].url
                    );
                    
                    if (validGenreArtists.length > 0) {
                      artists = Array.from(new Set(
                        validGenreArtists.map((a: any) => JSON.stringify(a))
                      )).map((a: string) => JSON.parse(a));
                      
                      console.log('Artistas recomendados por género principal cargados:', artists.length);
                    }
              }
            } catch (error) {
                  console.error(`Error obteniendo artistas para género principal:`, error);
                }
              }
              
              // Si no hay suficientes artistas, complementar con artistas predefinidos
              const artistsNeeded = 16 - artists.length;
              if (artistsNeeded > 0) {
                console.log(`Necesitamos ${artistsNeeded} artistas más para completar.`);
                // Usar searchByGenre como alternativa a getTopArtists con género "popular"
                try {
                  const moreArtists = await youtubeMusicAPI.searchByGenre('popular', artistsNeeded);
                  
                  if (moreArtists && Array.isArray(moreArtists)) {
                    // Filtrar artistas con imágenes inválidas
                    const validMoreArtists = moreArtists.filter((artist: any) => 
                      artist && artist.images && artist.images.length > 0 && artist.images[0].url
                    );
                    
                    // Añadir solo artistas que no estén ya en la lista
                    if (validMoreArtists.length > 0) {
                      const existingIds = new Set(artists.map((a: any) => a.id));
                      for (const artist of validMoreArtists) {
                        if (!existingIds.has(artist.id)) {
                          artists.push(artist);
                          existingIds.add(artist.id);
                          
                          if (artists.length >= 16) break;
                        }
                      }
                      
                      console.log('Artistas adicionales cargados:', validMoreArtists.length);
                    }
                  }
                } catch (error) {
                  console.error("Error al obtener artistas adicionales:", error);
                }
              }
              
              if (artists.length > 0) {
                // Aplicar filtro de duplicados a artistas, usando el ID como identificador único
                const uniqueArtists = artists.filter((artist, index, self) => 
                  index === self.findIndex((a) => a.id === artist.id)
                );
                setRecommendedArtists(uniqueArtists);
                console.log('Total de artistas recomendados cargados:', uniqueArtists.length);
              } else {
                console.warn('No se obtuvieron artistas recomendados válidos');
              }
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
      setExploreError('Ocurrió un error al cargar el contenido. Por favor intenta de nuevo.');
      setExploreLoading(false);
      setRecentTracksMinLoadingTime(false); // Asegurar que se detenga el loading mínimo en caso de error
    }
  };

  const fetchPersonalRotation = async () => {
      try {
      setLoading(prev => ({ ...prev, personal: true }));
      // Obtener la rotación personal del usuario (mezcla de top tracks y recomendaciones)
      const tracks = await getUserPersonalRotation(12); // Aumentamos a 12 para tener más elementos en el carrusel
      // Aplicar filtro de duplicados antes de actualizar el estado
      setPersonalTracks(removeDuplicateTracks(tracks));
      setError(prev => ({ ...prev, personal: null }));
    } catch (err) {
      console.error('Error al cargar la rotación personal:', err);
      setError(prev => ({ ...prev, personal: 'No se pudieron cargar las canciones. Por favor, inténtalo de nuevo más tarde.' }));
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
    infinite: personalTracks.length > 6,
    speed: 500,
    slidesToShow: 6,
    slidesToScroll: 2,
    nextArrow: <NextArrow />,
    prevArrow: <PrevArrow />,
    centerMode: false,
    centerPadding: '20px',
    cssEase: 'ease-out',
    responsive: [
      {
        breakpoint: 1400,
        settings: {
          slidesToShow: 5,
          slidesToScroll: 2,
        }
      },
      {
        breakpoint: 1200,
        settings: {
          slidesToShow: 4,
          slidesToScroll: 2,
        }
      },
      {
        breakpoint: 900,
        settings: {
          slidesToShow: 3,
          slidesToScroll: 1,
        }
      },
      {
        breakpoint: 600,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1,
        }
      },
      {
        breakpoint: 480,
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
        <div key={`skeleton-${index}`} style={{ padding: '0 12px' }}>
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
  const ArtistCard = ({ artist }: { artist: any }) => (
    <Grid item xs={6} sm={4} md={3} lg={2}>
      <StyledCard>
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Box 
            component="img" 
            src={artist.images?.[0]?.url || '/placeholder-artist.jpg'} 
            alt={artist.name || 'Artista'}
            sx={{ 
              width: '100%',
              aspectRatio: '1/1',
              borderRadius: '50%',
              mb: 2,
              objectFit: 'cover'
            }}
          />
          <Typography variant="body1" fontWeight="medium" noWrap>
            {artist.name || 'Artista Desconocido'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {artist.genres?.[0] || 'Música'}
          </Typography>
        </Box>
      </StyledCard>
    </Grid>
  );

  // Función para cargar el historial de canciones escuchadas
  const fetchRecentlyPlayedTracks = async () => {
    setLoading(prev => ({ ...prev, recent: true }));
    try {
      const tracks = await RecentTracksService.getHistory(20); // Obtenemos las 20 más recientes
      // Aplicar filtro de duplicados antes de actualizar el estado
      setRecentlyPlayed(removeDuplicateTracks(tracks));
    } catch (error) {
      console.error('Error al cargar historial de escucha:', error);
    } finally {
      setLoading(prev => ({ ...prev, recent: false }));
    }
  };

  // Función para manejar la reproducción de canciones y registrarlas en el historial
  const handlePlayTrack = async (uri: string | undefined, e: React.MouseEvent, trackInfo?: any) => {
    e.preventDefault();
    e.stopPropagation();
    
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
          const card = (e.currentTarget as HTMLElement).closest('.MuiCard-root');
          
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
  const PlaylistCard = ({ playlist }: { playlist: any }) => (
    <Grid item xs={12} sm={6} md={4} lg={3}>
      <Card sx={{ 
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: '8px',
        display: 'flex',
        transition: 'transform 0.3s',
        '&:hover': {
          transform: 'translateY(-4px)',
          backgroundColor: 'rgba(255,255,255,0.08)',
        },
        height: '100%'
      }}>
        <Box sx={{ 
          width: 100, 
          height: 100,
          flexShrink: 0,
          m: 2
        }}>
          <img 
            src={playlist.images?.[0]?.url || '/placeholder-playlist.jpg'} 
            alt={playlist.name}
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover',
              borderRadius: '4px'
            }}
          />
        </Box>
        <Box sx={{ p: 2, flexGrow: 1 }}>
          <Typography variant="body1" fontWeight="medium" noWrap>
            {playlist.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {playlist.description || `Por ${playlist.owner?.display_name || 'Spotify'}`}
          </Typography>
          {playlist.tracks?.total && (
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
              {playlist.tracks.total} canciones
            </Typography>
          )}
        </Box>
      </Card>
    </Grid>
  );

  // Componente para mostrar un álbum/track
  const AlbumCard = ({ album }: { album: any }) => (
    <Grid item xs={6} sm={4} md={3} lg={2.4}>
      <StyledCard>
        <Box sx={{ position: 'relative' }}>
          <StyledCardMedia
            image={album.images?.[0]?.url || '/placeholder-album.jpg'}
            title={album.name}
          />
          <Box 
            sx={{ 
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.3)',
              opacity: 0,
              transition: 'opacity 0.3s',
              '&:hover': {
                opacity: 1
              }
            }}
          >
            <IconButton 
              size="medium"
              sx={{ 
                backgroundColor: theme.palette.secondary.main,
                color: 'white',
                transform: 'scale(0.9)',
                transition: 'transform 0.3s',
                '&:hover': { 
                  backgroundColor: theme.palette.secondary.dark,
                  transform: 'scale(1)'
                }
              }}
              onClick={(e) => handlePlayTrack(album.uri, e, album)}
            >
              <PlayArrow />
            </IconButton>
          </Box>
        </Box>
        <CardContent sx={{ px: 0, py: 1 }}>
          <Typography 
            variant="body2" 
            fontWeight="medium" 
            noWrap
            data-track-name={album.name}
          >
            {album.name}
          </Typography>
          <Typography 
            variant="caption" 
            color="text.secondary" 
            noWrap
            data-track-artist={album.artists?.map((a: any) => a.name).join(', ') || album.album?.artists?.map((a: any) => a.name).join(', ')}
          >
            {album.artists?.map((a: any) => a.name).join(', ') || album.album?.artists?.map((a: any) => a.name).join(', ')}
          </Typography>
        </CardContent>
      </StyledCard>
    </Grid>
  );

  // Componente mejorado para la tarjeta de canción escuchada recientemente
  const RecentTrackCard = ({ item }: { item: EnrichedTrack }) => {
    const formattedDate = new Date(item.playedAt).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return (
      <Grid item xs={12} sm={6} md={4} lg={3}>
        <Card
          sx={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            transition: 'all 0.3s', 
            '&:hover': { 
              transform: 'translateY(-4px)',
              boxShadow: 6 
            },
            borderRadius: 2,
            overflow: 'hidden',
            backgroundColor: 'background.paper',
          }}
        >
          <Box 
            sx={{ 
              position: 'relative', 
              paddingTop: '100%', // Ratio 1:1 para la imagen
              width: '100%',
              overflow: 'hidden'
            }}
          >
            <CardMedia
              component="img"
              image={item.cover || '/images/default-album.jpg'}
              alt={item.title} 
              sx={{ 
                position: 'absolute', 
                top: 0, 
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
            <Box 
              sx={{ 
                position: 'absolute', 
                top: 0, 
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(0, 0, 0, 0.3)',
                opacity: 0,
                transition: 'opacity 0.3s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '&:hover': { opacity: 1 }
              }}
            >
              <IconButton 
                size="large"
                sx={{ 
                  color: 'white',
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  transform: 'scale(0.9)',
                  transition: 'transform 0.3s',
                  '&:hover': { 
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    transform: 'scale(1)'
                  }
                }}
                onClick={(e) => handlePlayTrack(item.id, e, {
                  title: item.title,
                  artist: item.artist,
                  album: item.album,
                  cover: item.cover,
                  source: item.source,
                  id: item.id
                })}
              >
                <PlayArrow fontSize="large" />
              </IconButton>
            </Box>
          </Box>
          
          <CardContent sx={{ flexGrow: 1, p: 2 }}>
            <Typography 
              variant="body1" 
              fontWeight="bold" 
              gutterBottom
              noWrap
              title={item.title}
            >
              {item.title}
            </Typography>
            
            <Typography 
              variant="body2" 
              color="text.secondary" 
              noWrap
              title={item.artist}
            >
              {item.artist}
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
              <Box 
                sx={{ 
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                  mr: 1
                }}
              >
                <AccessTime fontSize="small" sx={{ mr: 0.5, fontSize: '0.875rem' }} />
                {formattedDate}
              </Box>
              
              <Box 
                sx={{ 
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                  ml: 'auto'
                }}
              >
                {item.source === 'spotify' && (
                  <img src="/image/spotify-icon.png" alt="Spotify" style={{ width: 16, height: 16, marginRight: 4 }} />
                )}
                {item.source === 'youtube' && (
                  <img src="/image/youtube-icon.png" alt="YouTube" style={{ width: 16, height: 16, marginRight: 4 }} />
                )}
                {item.source && <span style={{ textTransform: 'capitalize' }}>{item.source}</span>}
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
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
            Intentar de nuevo
          </Button>
        </Box>
      );
    }

    switch (activeTab) {
      case 0: // Nuevos lanzamientos
        return newReleases.length > 0 ? (
          <Grid container spacing={4}>
            {newReleases.map((album: any) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </Grid>
        ) : (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">No hay nuevos lanzamientos disponibles</Typography>
          </Box>
        );

      case 1: // Escuchado recientemente
        return filteredRecentTracks.length > 0 ? (
          <Grid container spacing={4}>
            {filteredRecentTracks.map((item: any, index: number) => (
              <RecentTrackCard key={`${item.id}-${index}`} item={item} />
            ))}
          </Grid>
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
                fetchRecentlyPlayedTracks();
                const loadingTimer = setTimeout(() => {
                  setRecentTracksMinLoadingTime(false);
                }, 10000);
              }}
            >
              Intentar de nuevo
            </Button>
          </Box>
        );

      case 2: // Playlists destacadas
        return featuredPlaylists.length > 0 ? (
          <Grid container spacing={4}>
            {featuredPlaylists.map((playlist: any) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </Grid>
        ) : (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">No hay playlists destacadas disponibles</Typography>
          </Box>
        );

      case 3: // Artistas recomendados
        return recommendedArtists.length > 0 ? (
          <Grid container spacing={4}>
            {recommendedArtists.map((artist: any) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </Grid>
        ) : (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">No hay artistas recomendados disponibles</Typography>
          </Box>
        );

      default:
        return (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">Selecciona una categoría para explorar más música</Typography>
          </Box>
        );
    }
  };

  // Enlace a búsqueda
  const handleSearchNavigate = () => {
    router.push('/search');
  };

  // Determinar si mostrar sección personal basado en autenticación y datos
  const showPersonalSection = isAuthenticated && personalTracks.length > 0;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      
      {/* Primera sección - Banner y rotación personal */}
      <Box sx={{ mb: 6 }}>
        {/* Banner principal */}
        <Box 
          sx={{ 
            position: 'relative',
            height: '250px',
            borderRadius: '16px',
            overflow: 'hidden',
            mb: 4,
            background: 'linear-gradient(to right, rgba(25,25,34,0.9), rgba(25,25,34,0.7))',
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
              opacity: 0.5,
              backgroundImage: 'url(https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=2070)',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
          
          <Box sx={{ position: 'relative', zIndex: 1, px: 4 }}>
            <Typography variant="h3" fontWeight="bold" color="white">
              Bienvenido a MusicVerse
            </Typography>
            <Typography variant="h6" color="rgba(255,255,255,0.8)" sx={{ mb: 2 }}>
              Descubre nueva música y disfruta de tus canciones favoritas
            </Typography>
            <Box 
              component="form"
              onSubmit={(e) => {
                e.preventDefault();
                if (searchTerm && searchTerm.trim()) {
                  router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
                }
              }}
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
                placeholder="Buscar músicos, canciones..." 
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
        </Box>
        
        {/* Tu Rotación Personal */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" fontWeight="bold">
            Tu Rotación Personal
            <Typography 
              component="span" 
              variant="body2" 
              sx={{ 
                ml: 1, 
                color: 'text.secondary',
                display: 'inline-block',
                verticalAlign: 'middle'
              }}
            >
              Basado en tu historial de escucha
            </Typography>
          </Typography>
          <Box>
            <IconButton 
              color="secondary" 
              onClick={fetchPersonalRotation} 
              disabled={loading.personal}
              sx={{ mr: 1 }}
              title="Refrescar recomendaciones"
            >
              <Refresh />
            </IconButton>
            <Link href="/library" passHref>
          <Button color="secondary" sx={{ textTransform: 'none' }}>
            Ver todo
          </Button>
            </Link>
          </Box>
        </Box>
        
        {/* Carrusel de Rotación Personal */}
        <Box sx={{ px: 1, position: 'relative', mx: -2 }}>
          {loading.personal ? (
            renderLoadingSkeletons()
          ) : error.personal ? (
            <Box sx={{ width: '100%', p: 3, textAlign: 'center' }}>
              <Typography color="error">{error.personal}</Typography>
              <Button 
                variant="outlined" 
                onClick={fetchPersonalRotation} 
                sx={{ mt: 2 }}
                startIcon={<Refresh />}
              >
                Intentar de nuevo
              </Button>
            </Box>
          ) : (
            <Slider {...sliderSettings}>
              {personalTracks.map((track) => (
                <div key={track.id} style={{ padding: '0 12px' }}>
                  <StyledCard>
                    <Box sx={{ position: 'relative' }}>
                      <StyledCardMedia
                        image={track.album?.images[0]?.url || '/placeholder-album.jpg'}
                        title={track.name}
                      />
                      {/* Badge de favorito */}
                      {track.isTopTrack && (
                        <Box 
                          sx={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            p: 1,
                            zIndex: 1
                          }}
                        >
                          <Box
                            sx={{
                              bgcolor: 'rgba(0,0,0,0.6)',
                              color: 'white',
                              fontSize: '0.7rem',
                              p: '4px 8px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <FavoriteRounded sx={{ fontSize: '0.85rem', mr: 0.5, color: theme.palette.secondary.main }} />
                            Favorito
                          </Box>
                        </Box>
                      )}
                      
                      {/* Overlay con botón play */}
                      <Box 
                        sx={{ 
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0, 0, 0, 0.3)',
                          opacity: 0,
                          transition: 'opacity 0.3s',
                          '&:hover': {
                            opacity: 1
                          }
                        }}
                      >
                        <IconButton 
                          size="medium"
                          sx={{ 
                            backgroundColor: theme.palette.secondary.main,
                            color: 'white',
                            transform: 'scale(0.9)',
                            transition: 'transform 0.3s',
                            '&:hover': { 
                              backgroundColor: theme.palette.secondary.dark,
                              transform: 'scale(1)'
                            }
                          }}
                          onClick={(e) => handlePlayTrack(track.uri, e, track)}
                        >
                          <PlayArrow />
                        </IconButton>
                      </Box>
                    </Box>
                    <CardContent sx={{ px: 0, py: 1 }}>
                      <Typography 
                        variant="body2" 
                        fontWeight="medium" 
                        noWrap
                        data-track-name={track.name}
                      >
                        {track.name}
                      </Typography>
                      <Typography 
                        variant="caption" 
                        color="text.secondary" 
                        noWrap
                        data-track-artist={track.artists?.map((a: any) => a.name).join(', ')}
                      >
                        {track.artists?.map((a: any) => a.name).join(', ')}
                      </Typography>
                    </CardContent>
                  </StyledCard>
                </div>
              ))}
            </Slider>
          )}
        </Box>
      </Box>
      
      {/* Segunda sección - Explora Música */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" fontWeight="bold" sx={{ mb: 2 }}>
          Explora Música
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
            <Tab label="Nuevos lanzamientos" />
            <Tab label="Escuchado recientemente" />
            <Tab label="Playlists destacadas" />
            <Tab label="Artistas recomendados" />
          </Tabs>
        </Box>
        
        {/* Contenido de las pestañas */}
        <Box sx={{ minHeight: '400px' }}>
          {renderTabContent()}
        </Box>
      </Box>
      
      {/* Zona de descubrimiento */}
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
        Zona de Descubrimiento
      </Typography>
      
      <Grid container spacing={3}>
        {/* Artista recomendado */}
        <Grid item xs={12} md={6}>
          <Typography variant="h6" fontWeight="medium" sx={{ mb: 2 }}>
            Artista Recomendado
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
              <Typography variant="body2" color="text.secondary">{recommendedArtist.description}</Typography>
              <Button 
                variant="text" 
                color="secondary" 
                sx={{ mt: 1, pl: 0, textTransform: 'none' }}
              >
                Escuchar ahora
              </Button>
            </Box>
          </Paper>
        </Grid>
        
        {/* Género destacado */}
        <Grid item xs={12} md={6}>
          <Typography variant="h6" fontWeight="medium" sx={{ mb: 2 }}>
            Género Destacado
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
                {featuredGenre.artistCount} artistas para descubrir
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Información basada en el historial */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="body2" color="text.secondary">
          Basado en tu historial de escucha, creemos que te gustaría explorar más música de este estilo.
        </Typography>
      </Box>
    </Container>
  );
} 