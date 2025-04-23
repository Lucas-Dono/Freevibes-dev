'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { getYouTubeArtistInfo, YTArtistInfo } from '@/services/youtube/artist-service';
import axios from 'axios';
import {
  Box,
  Typography,
  Container,
  Grid,
  Paper,
  Button,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Skeleton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  PlayArrow,
  Album,
  MusicNote,
  VideoLibrary,
  PeopleAlt,
  VerifiedUser,
  Refresh,
  Info,
  Search,
  Explore,
  Home,
  ArrowBack
} from '@mui/icons-material';
import { formatNumber } from '@/lib/utils';
import UnifiedMusicCard from '@/components/UnifiedMusicCard';
import { useAuth } from '@/components/providers/AuthProvider';
import { useArtistNavigation } from '@/hooks/useArtistNavigation';
import { toast } from 'react-hot-toast';
import { TrackList } from '@/components/TrackList';
import { Track } from '@/types/types';

// Interfaces para los datos
interface Artist {
  id: string;
  name: string;
  images: Array<{ url: string }>;
  followers?: { total: number };
  genres?: string[];
  popularity?: number;
}

interface Album {
  id: string;
  name?: string;
  title?: string;
  images?: Array<{ url: string }>;
  thumbnails?: Array<{ url: string }>;
  release_date?: string;
  year?: string;
  album_type?: string;
  total_tracks?: number;
  browseId?: string;
}

interface EnhancedTrack extends Track {
  videoId?: string;
  thumbnails?: Array<{url: string}>;
  views?: string;
}

export default function ArtistPage() {
  const params = useParams();
  const router = useRouter();
  const artistId = params ? (params.id as string) : '';
  const { isDemo } = useAuth();
  const { findArtistByName } = useArtistNavigation();

  // Estado principal
  const [artist, setArtist] = useState<Artist | null>(null);
  const [originalSpotifyTopTracks, setOriginalSpotifyTopTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [relatedArtists, setRelatedArtists] = useState<Artist[]>([]);
  const [youtubeArtist, setYoutubeArtist] = useState<YTArtistInfo | null>(null);

  // Estados de control generales
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [dataSource, setDataSource] = useState<'spotify' | 'youtube'>('spotify');
  const [spotifyArtistName, setSpotifyArtistName] = useState<string | null>(null);

  // Estados para carga diferida de Artistas Relacionados
  const [relatedArtistsLoading, setRelatedArtistsLoading] = useState<boolean>(false);
  const [relatedArtistsLoaded, setRelatedArtistsLoaded] = useState<boolean>(false);
  const [relatedArtistsError, setRelatedArtistsError] = useState<string | null>(null);

  const fetchArtistData = useCallback(async (source: 'spotify' | 'youtube') => {
    if (!artistId) return;

    console.log(`[ArtistPage] fetchArtistData llamado para ${artistId}, source: ${source}`);
    setLoading(true);
    setError(null);
    setRelatedArtistsLoaded(false); // Resetear estado de carga de relacionados
    setRelatedArtists([]); // Limpiar relacionados previos
    setRelatedArtistsLoading(false);
    setRelatedArtistsError(null);
    setOriginalSpotifyTopTracks([]);
    setAlbums([]);
    setYoutubeArtist(null);
    setArtist(null);
    setSpotifyArtistName(null);

    try {
      if (source === 'youtube') {
        // Llamar a la función existente para cargar datos de YouTube
        await fetchYouTubeMusicArtist(artistId);
      } else {
        // Llamar a la nueva función para cargar datos primarios de Spotify
        await fetchSpotifyPrimaryData();
      }
    } catch (err) {
      console.error('[ArtistPage] Error al cargar datos primarios del artista:', err);
      const message = err instanceof Error ? err.message : 'Error desconocido.';
      setError(`Error al cargar información del artista: ${message}`);
      // Limpiar todo en caso de error
      setArtist(null);
      setOriginalSpotifyTopTracks([]);
      setAlbums([]);
      setRelatedArtists([]);
    } finally {
      setLoading(false);
    }
  }, [artistId]); // Dependencia principal es artistId

  useEffect(() => {
    if (artistId) {
      console.log(`[ArtistPage] Determinando fuente para ID: ${artistId}`);
      const isYouTubeId = artistId.startsWith('UC') || artistId.includes('youtube');
      const initialSource = isYouTubeId ? 'youtube' : 'spotify';
      console.log(`[ArtistPage] Fuente inicial determinada: ${initialSource}`);
      setDataSource(initialSource);
      fetchArtistData(initialSource);
    }
  }, [artistId, fetchArtistData]); // fetchArtistData ahora es una dependencia estable

  // Función para cargar solo los datos primarios de Spotify
  const fetchSpotifyPrimaryData = async () => {
    if (!artistId || artistId.startsWith('UC')) return;

    console.log(`[ArtistPage] Iniciando fetch primario Spotify para ID: ${artistId}`);
    let currentSpotifyArtistName: string | null = null;

    try {
      console.log('[ArtistPage] Fetching Spotify (Details, Tracks, Albums) via API...');

      const detailsPromise = axios.get(`/api/spotify/artist-details/${artistId}`);
      const topTracksPromise = axios.get(`/api/spotify/top-tracks/${artistId}`);
      const albumsPromise = axios.get(`/api/spotify/artist-albums/${artistId}?limit=20`);

      const [detailsResponse, topTracksResponse, albumsResponse] = await Promise.all([
        detailsPromise,
        topTracksPromise,
        albumsPromise
      ]);

      const artistData = detailsResponse.data;
      if (!artistData || !artistData.name) {
        throw new Error('No se pudieron obtener los detalles del artista desde Spotify API.');
      }
      currentSpotifyArtistName = artistData.name;
      console.log(`[ArtistPage] Detalles Spotify obtenidos: ${currentSpotifyArtistName}`);
      setArtist(artistData);
      setSpotifyArtistName(currentSpotifyArtistName); // Guardar nombre en estado

      const tracks: Track[] = topTracksResponse.data.topTracks || [];
      console.log(`[ArtistPage] Top tracks Spotify obtenidos: ${tracks.length}`);
      setOriginalSpotifyTopTracks(tracks);

      const albumsData = albumsResponse.data.albums || [];
      console.log(`[ArtistPage] Álbumes Spotify obtenidos: ${albumsData.length}`);
      setAlbums(albumsData);

      console.log('[ArtistPage] Fetch primario Spotify completado.');

    } catch (err) {
      console.error('[ArtistPage] Error durante el fetch primario de Spotify:', err);
      throw err; // Relanzar para que lo capture el catch de fetchArtistData
    }
  };

  // Función para cargar los artistas relacionados (lógica híbrida)
  const loadRelatedArtists = useCallback(async () => {
    if (!spotifyArtistName) {
      console.warn('[ArtistPage] No se puede cargar relacionados sin nombre de artista Spotify.');
      setRelatedArtistsError('No se pudo obtener el nombre del artista principal.');
      setRelatedArtistsLoaded(true);
      return;
    }

    console.log(`[ArtistPage] Iniciando carga diferida de relacionados vía YouTube para "${spotifyArtistName}"...`);
    setRelatedArtistsLoading(true);
    setRelatedArtistsError(null);
    setRelatedArtists([]);

    let youtubeArtistId: string | null = null;

    try {
      // 1. Buscar el artista equivalente en YouTube Music
      try {
        console.log(`[ArtistPage] Buscando ID de YouTube para "${spotifyArtistName}" via /api/youtube/search`);
        const searchResponse = await axios.get('/api/youtube/search', {
          params: { query: spotifyArtistName, filter: 'artists', limit: 5 },
          timeout: 10000
        });

        const youtubeSearchResults = searchResponse.data;
        if (Array.isArray(youtubeSearchResults) && youtubeSearchResults.length > 0) {
          const exactMatch = youtubeSearchResults.find(artist =>
            artist.name?.toLowerCase() === spotifyArtistName?.toLowerCase() ||
            artist.title?.toLowerCase() === spotifyArtistName?.toLowerCase()
          );

          if (exactMatch && exactMatch.browseId) {
            youtubeArtistId = exactMatch.browseId;
            console.log(`[ArtistPage] ID de YouTube encontrado (coincidencia exacta): ${youtubeArtistId}`);
          } else {
            youtubeArtistId = youtubeSearchResults[0].browseId;
            console.warn(`[ArtistPage] No se encontró coincidencia exacta para "${spotifyArtistName}". Usando fallback: ${youtubeArtistId}`);
          }
        } else {
          console.warn(`[ArtistPage] No se encontró ningún artista en YouTube Music para "${spotifyArtistName}".`);
          throw new Error ('No se encontró el artista en YouTube Music.');
        }
      } catch (ytSearchError) {
        console.error('[ArtistPage] Error buscando artista en YouTube Music:', ytSearchError);
        throw new Error ('Error buscando artista equivalente en YouTube.');
      }

      // 2. Obtener detalles/relacionados de YouTube Music con el ID encontrado
      let relatedFromYouTube: any[] = [];
      if (youtubeArtistId) {
        try {
          console.log(`[ArtistPage] Fetching YouTube artist details (for related) via API: /api/youtube-artist?artistId=${youtubeArtistId}`);
          const ytDetailsResponse = await fetch(`/api/youtube-artist?artistId=${youtubeArtistId}`, {
              cache: 'no-store'
            });
          const responseText = await ytDetailsResponse.text();
          console.log(`[ArtistPage] YouTube API Response Status: ${ytDetailsResponse.status}`);

          if (!ytDetailsResponse.ok) {
            console.error(`[ArtistPage] Error ${ytDetailsResponse.status} al obtener detalles de YT para ${youtubeArtistId}. Body: ${responseText.substring(0,500)}`);
            throw new Error ('Error obteniendo detalles de YouTube Music.');
          } else {
            let ytData;
            try {
              ytData = JSON.parse(responseText);
            } catch (parseError) {
              console.error('[ArtistPage] Failed to parse YouTube API response as JSON.', parseError);
              throw new Error ('Error procesando respuesta de YouTube Music.');
            }

            const rawRelatedResults = ytData?.related?.results;
            if (rawRelatedResults && Array.isArray(rawRelatedResults)) {
              relatedFromYouTube = rawRelatedResults.map((related: any) => ({
                id: related.browseId || related.artistId || `unknown_${Math.random()}`,
                name: related.title || related.name || 'Artista Desconocido',
                images: [{ url: related.thumbnails?.[0]?.url || '/placeholder-artist.jpg' }],
                youtubeId: related.browseId || related.artistId
              }));
              console.log(`[ArtistPage] Mapeo inicial de relacionados YT: ${relatedFromYouTube.length} artistas`);
            } else {
              console.log('[ArtistPage] No se encontraron artistas relacionados en la respuesta de YouTube Music.');
            }
          }
        } catch (ytDetailsError) {
          console.error(`[ArtistPage] Error obteniendo detalles/relacionados de YT para ${youtubeArtistId}:`, ytDetailsError);
          throw new Error ('Error obteniendo relacionados de YouTube Music.');
        }
      } else {
         throw new Error ('No se obtuvo ID de YouTube para buscar relacionados.');
      }

      // 3. Buscar IDs de Spotify para los relacionados obtenidos de YouTube
      if (relatedFromYouTube.length > 0) {
          console.log('[ArtistPage] Iniciando búsqueda de IDs de Spotify para artistas relacionados...');
          const relatedPromises = relatedFromYouTube.map(async (artist) => {
            if (!artist.name || artist.name === 'Artista Desconocido') return artist;
            try {
              const findResponse = await axios.get(`/api/spotify/find-artist?name=${encodeURIComponent(artist.name)}`, { timeout: 5000 });
              if (findResponse.data && findResponse.data.artistId) {
                return { ...artist, id: findResponse.data.artistId };
              }
            } catch (findError: any) {
              if (!(axios.isAxiosError(findError) && findError.response?.status === 404)) {
                 console.error(`[ArtistPage] Error buscando Spotify ID para "${artist.name}":`, findError.message);
              }
            }
            return artist; // Conservar ID de YouTube si no se encuentra o hay error
          });

          const relatedArtistsWithSpotifyIds = await Promise.all(relatedPromises);
          console.log('[ArtistPage] Mapeo final de relacionados con IDs Spotify:', relatedArtistsWithSpotifyIds);
          setRelatedArtists(relatedArtistsWithSpotifyIds);
      } else {
          setRelatedArtists([]);
      }

    } catch (err) {
      console.error('[ArtistPage] Error durante la carga diferida de relacionados:', err);
      const message = err instanceof Error ? err.message : 'Error desconocido.';
      setRelatedArtistsError(`Error al cargar artistas similares: ${message}`);
      setRelatedArtists([]);
    } finally {
      setRelatedArtistsLoading(false);
      setRelatedArtistsLoaded(true);
      console.log('[ArtistPage] Carga diferida de relacionados finalizada.');
    }
  }, [spotifyArtistName]); // Depende del nombre del artista principal

  // *** Preservar fetchYouTubeMusicArtist ***
  // (El código original de esta función debe estar aquí o importado)
  const fetchYouTubeMusicArtist = async (ytArtistId: string) => {
    // Asegurarse de que esta función existe y es correcta
    // basada en el código original que tenías.
    // Esta función debería:
    // 1. Llamar a `/api/youtube-artist?artistId=${ytArtistId}`
    // 2. Procesar la respuesta completa (incluyendo description, views, videos, albums, related)
    // 3. Actualizar los estados: setArtist, setYoutubeArtist, setOriginalSpotifyTopTracks (con videos),
    //    setAlbums (con albums de YT), setRelatedArtists (con related de YT)
    // 4. Manejar errores y el estado de carga (setLoading, setError)
    console.log(`[ArtistPage] fetchYouTubeMusicArtist para ID: ${ytArtistId}`);
    setLoading(true);
    setError(null);
    // ... (Resto de la implementación de fetchYouTubeMusicArtist como estaba antes) ...
    // Ejemplo de estructura básica (adaptar a tu código original):
    try {
      const response = await fetch(`/api/youtube-artist?artistId=${ytArtistId}`);
      if (!response.ok) throw new Error(`Error ${response.status}`);
      const data = await response.json();

      // Parsear y establecer estados (artist, youtubeArtist, originalSpotifyTopTracks, albums, relatedArtists)
      // ... lógica de parseo y setStates ...

      console.log(`[ArtistPage] Datos de YouTube para ${ytArtistId} cargados.`);
      setDataSource('youtube'); // Asegurar que la fuente es correcta

    } catch (err) {
        console.error('[ArtistPage] Error fetching YouTube Music artist data:', err);
        const message = err instanceof Error ? err.message : 'Error desconocido.';
        setError(`Error loading YouTube artist data: ${message}`);
        // Limpiar estados
        setArtist(null);
        setYoutubeArtist(null);
        setOriginalSpotifyTopTracks([]);
        setAlbums([]);
        setRelatedArtists([]);
    } finally {
        // setLoading(false); // fetchArtistData se encarga del loading general
    }
  };
  // ******************************************

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    const relatedArtistsTabIndex = dataSource === 'youtube' ? 3 : 2;
    if (newValue === relatedArtistsTabIndex && dataSource === 'spotify' && !relatedArtistsLoaded && !relatedArtistsLoading) {
      // Cargar relacionados solo si la fuente es Spotify y no se han cargado
      loadRelatedArtists();
    }
    // Si la fuente es YouTube, los relacionados ya se cargaron en fetchYouTubeMusicArtist
  };

  const handleRetry = () => {
    setError(null);
    fetchArtistData(dataSource);
  };

  // Renderizado (Loading inicial)
  if (loading && !artist) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {/* Skeleton UI */}
        <Box sx={{ mb: 4 }}><Skeleton variant="rectangular" height={300} /></Box>
        <Grid container spacing={3}>
            <Grid item xs={12} md={4}><Skeleton variant="circular" width={160} height={160} sx={{ mx: 'auto' }} /><Skeleton variant="text" height={60} sx={{ mt: 2 }} /><Skeleton variant="text" height={30} width="70%" sx={{ mx: 'auto' }} /></Grid>
            <Grid item xs={12} md={8}><Skeleton variant="text" height={40} sx={{ mb: 2 }} />{Array.from(new Array(5)).map((_, index) => (<Skeleton key={index} variant="rectangular" height={60} sx={{ mb: 1 }} />))}</Grid>
        </Grid>
      </Container>
    );
  }

  // Renderizado (Error principal)
  if (error && !artist) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={handleRetry}>Reintentar</Button>}>
          {error || 'No se encontró información del artista'}
        </Alert>
        {/* Podrías añadir aquí el bloque de consejos si es relevante */}
      </Container>
    );
  }

  // Renderizado (Artista no encontrado después de carga)
  if (!artist) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="warning">No se pudo cargar la información del artista.</Alert>
      </Container>
    );
  }

  // Renderizado principal
  return (
    <Container maxWidth="xl">
      {/* Cabecera del artista - Sin cambios */}
      <Paper elevation={0} sx={{ position: 'relative', mb: 4, borderRadius: 4, overflow: 'hidden', bgcolor: 'background.paper', backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.4))' }}>
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.4, '&::after': { content: '""', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.7))' } }}>
          {artist.images && artist.images[0] && (
            <Image src={artist.images[0].url} alt={`Imagen de fondo de ${artist.name}`} fill style={{ objectFit: 'cover' }} priority />
          )}
        </Box>
        <Box sx={{ position: 'relative', zIndex: 1, p: 4 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={3} sx={{ textAlign: { xs: 'center', md: 'left' } }}>
              <Box sx={{ width: 180, height: 180, borderRadius: '50%', overflow: 'hidden', position: 'relative', mx: { xs: 'auto', md: 0 }, border: '4px solid rgba(255,255,255,0.2)' }}>
                <Image src={artist.images && artist.images[0] ? artist.images[0].url : '/placeholder-artist.jpg'} alt={`Foto de ${artist.name}`} fill style={{ objectFit: 'cover' }} priority />
              </Box>
            </Grid>
            <Grid item xs={12} md={9}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="h3" fontWeight="bold" color="white">{artist.name}</Typography>
                {dataSource === 'youtube' && (<Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}><YoutubeIcon sx={{ color: 'red', fontSize: 30 }} /></Box>)}
                {dataSource === 'spotify' && (<Box sx={{ display: 'flex', alignItems: 'center', ml: 2 }}><SpotifyIcon sx={{ color: '#1DB954', fontSize: 26 }} /></Box>)}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
                {artist.followers && (<Typography variant="body1" color="white" sx={{ mr: 3, display: 'flex', alignItems: 'center' }}><PeopleAlt fontSize="small" sx={{ mr: 0.5 }} />{formatNumber(artist.followers.total)} seguidores</Typography>)}
                {youtubeArtist?.views && (<Typography variant="body1" color="white" sx={{ mr: 3 }}>{youtubeArtist.views} visualizaciones</Typography>)}
                {artist.genres && artist.genres.length > 0 && (<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: { xs: 1, md: 0 } }}>{artist.genres.slice(0, 3).map(genre => (<Chip key={genre} label={genre} size="small" color="primary" variant="outlined" />))}</Box>)}
              </Box>
              {youtubeArtist?.description && (<Typography variant="body2" color="rgba(255,255,255,0.8)" sx={{ mt: 2, maxHeight: '80px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>{youtubeArtist.description}</Typography>)}
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* Tabs de contenido */}
      <Box sx={{ mb: 4 }}>
        <Tabs value={activeTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider', mb: 2, '& .MuiTab-root': { minWidth: 100, py: 2 } }}>
          <Tab label="Top Tracks" icon={<MusicNote />} iconPosition="start" />
          <Tab label="Álbumes" icon={<Album />} iconPosition="start" />
          {dataSource === 'youtube' && <Tab label="Videos" icon={<VideoLibrary />} iconPosition="start" />}
          <Tab label="Artistas similares" icon={<PeopleAlt />} iconPosition="start" />
        </Tabs>

        {/* Contenido de las pestañas */}
        <Box sx={{ py: 2 }}>
          {/* Pestaña 1: Top Tracks - Sin cambios */}
          {activeTab === 0 && (
            <Box>
                {/* Loading/Error/Data rendering */}
                {!loading && !error && originalSpotifyTopTracks.length === 0 && (<Typography>No se encontraron canciones populares.</Typography>)}
                {!loading && originalSpotifyTopTracks.length > 0 && (<TrackList tracks={originalSpotifyTopTracks} />)}
            </Box>
          )}
          {/* Pestaña 2: Álbumes - Sin cambios */}
          {activeTab === 1 && (
            <Box>
                {albums.length === 0 ? (<Typography>No se encontraron álbumes.</Typography>) : (
                <Grid container spacing={1.5}>
                  {albums.map((album) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={album.id || album.browseId}>
                                <UnifiedMusicCard id={album.id || album.browseId || ''} title={album.name || album.title || ''} subtitle={album.year || (album.release_date ? album.release_date.split('-')[0] : '')} coverUrl={album.images?.[0]?.url || album.thumbnails?.[0]?.url || '/placeholder-album.jpg'} isPlayable={false} itemType="album" linkTo={`/album/${album.id || album.browseId}`} badge={{ text: dataSource === 'youtube' ? 'YouTube' : 'Spotify', color: dataSource === 'youtube' ? 'bg-red-600' : 'bg-green-600' }} />
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}
          {/* Pestaña 3: Videos (Solo YouTube) - Sin cambios */}
          {activeTab === 2 && dataSource === 'youtube' && (
            <Box>
              {!youtubeArtist?.videos?.results || youtubeArtist.videos.results.length === 0 ? (<Typography>No se encontraron videos.</Typography>) : (
                <Grid container spacing={1.5}>
                  {youtubeArtist?.videos?.results?.map((video) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={video.videoId}>
                      <UnifiedMusicCard id={video.videoId} title={video.title} subtitle={video.views || ''} coverUrl={video.thumbnails?.[0]?.url || '/placeholder-video.jpg'} isPlayable={true} itemType="video" badge={{ text: 'Video', color: 'bg-red-600' }} />
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}
          {/* Pestaña 4: Artistas similares - Actualizada */}
          {activeTab === (dataSource === 'youtube' ? 3 : 2) && (
            <Box sx={{ minHeight: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
              {relatedArtistsLoading ? (
                <CircularProgress sx={{mt: 4}}/>
              ) : relatedArtistsError ? (
                <Alert severity="error" sx={{width: '100%'}}>{relatedArtistsError}</Alert>
              ) : !relatedArtistsLoaded && dataSource === 'spotify' ? (
                 <Typography color="text.secondary" sx={{mt: 4}}>Cargando artistas similares...</Typography> // Mensaje mientras carga diferido
              ) : relatedArtists.length === 0 ? (
                <Typography color="text.secondary" sx={{mt: 4}}>
                  No se encontraron artistas similares.
                </Typography>
              ) : (
                <Grid container spacing={1.5}>
                  {relatedArtists.map((relArtist) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={relArtist.id}>
                      <UnifiedMusicCard
                        id={relArtist.id}
                        title={relArtist.name}
                        coverUrl={relArtist.images?.[0]?.url || '/placeholder-artist.jpg'}
                        isPlayable={false}
                        itemType="artist"
                        linkTo={`/artist/${relArtist.id}`}
                      />
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Descripción del artista (solo YouTube) - Sin cambios */}
      {youtubeArtist?.description && (
        <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 2, backgroundColor: 'background.paper' }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>Acerca del artista</Typography>
          <Typography variant="body1">{youtubeArtist.description}</Typography>
        </Paper>
      )}
    </Container>
  );
}

// Componentes auxiliares - Sin cambios
const Chip = ({ label, size, color, variant }: any) => (<Box sx={{ display: 'inline-flex', borderRadius: '16px', px: 1.5, py: 0.5, backgroundColor: variant === 'outlined' ? 'transparent' : 'primary.main', border: variant === 'outlined' ? '1px solid' : 'none', borderColor: 'primary.main', color: variant === 'outlined' ? 'primary.main' : 'white', fontSize: size === 'small' ? '0.75rem' : '0.875rem', fontWeight: 'medium' }}>{label}</Box>);
const YoutubeIcon = (props: any) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>);
const SpotifyIcon = (props: any) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>);
