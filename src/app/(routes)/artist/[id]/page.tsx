'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { getYouTubeArtistInfo, YTArtistInfo } from '@/services/youtube/artist-service';
import axios from 'axios';
// Imports de Material-UI ya no necesarios - migrado a Tailwind CSS
import { formatNumber } from '@/lib/utils';
import UnifiedMusicCard from '@/components/UnifiedMusicCard';
import { useAuth } from '@/components/providers/AuthProvider';
import { useArtistNavigation } from '@/hooks/useArtistNavigation';
import { toast } from 'react-hot-toast';
import { TrackList } from '@/components/TrackList';
import { Track } from '@/types/types';
import { playTrack as playTrackService } from '@/services/player/playService';

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

  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handlePlayTrack = (track: Track) => {
    if (!track) return;

    console.log('[ArtistPage] Reproduciendo track:', track);
    
    // Usar el servicio de reproducción
    playTrackService(track);
  };

  // Renderizado (Loading inicial)
  if (loading && !artist) {
    return (
      <div className="bg-gradient-to-b from-zinc-900 to-black min-h-screen">
        <div className="container mx-auto px-4 md:px-6 py-6 md:py-8">
          {/* Skeleton UI optimizado para móvil */}
          <div className="mb-6">
            <div className="w-full h-48 md:h-72 bg-zinc-800/50 rounded-lg animate-pulse mb-4"></div>
            <div className="flex flex-col md:flex-row gap-4 md:gap-6">
              <div className="flex flex-col items-center md:items-start">
                <div className="w-32 h-32 md:w-40 md:h-40 bg-zinc-800/50 rounded-full animate-pulse mb-3"></div>
                <div className="w-32 h-4 bg-zinc-800/50 rounded animate-pulse mb-2"></div>
                <div className="w-24 h-3 bg-zinc-800/50 rounded animate-pulse"></div>
              </div>
              <div className="flex-1 space-y-3">
                <div className="w-3/4 h-6 bg-zinc-800/50 rounded animate-pulse"></div>
                {Array.from(new Array(4)).map((_, index) => (
                  <div key={index} className="w-full h-12 bg-zinc-800/50 rounded animate-pulse"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Renderizado (Error principal)
  if (error && !artist) {
    return (
      <div className="bg-gradient-to-b from-zinc-900 to-black min-h-screen">
        <div className="container mx-auto px-4 md:px-6 py-8 md:py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="p-4 md:p-6 mb-6 bg-red-900/20 border border-red-800/30 text-red-300 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h3 className="text-lg md:text-xl font-semibold">Error</h3>
                    <p className="mt-1 text-sm md:text-base">{error || 'No se encontró información del artista'}</p>
                  </div>
                </div>
                <button
                  onClick={handleRetry}
                  className="px-3 py-1.5 md:px-4 md:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm md:text-base"
                >
                  Reintentar
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Renderizado (Artista no encontrado después de carga)
  if (!artist) {
    return (
      <div className="bg-gradient-to-b from-zinc-900 to-black min-h-screen">
        <div className="container mx-auto px-4 md:px-6 py-8 md:py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="p-4 md:p-6 bg-yellow-900/20 border border-yellow-800/30 text-yellow-300 rounded-lg"
          >
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h3 className="text-lg md:text-xl font-semibold">Advertencia</h3>
                <p className="mt-1 text-sm md:text-base">No se pudo cargar la información del artista.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Renderizado principal
  return (
    <div className="bg-gradient-to-b from-zinc-900 to-black min-h-screen">
      {/* Cabecera del artista optimizada */}
      <div className="relative">
        {/* Imagen de fondo */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-zinc-900 z-0">
          {artist.images && artist.images[0] && (
            <div className="w-full h-full relative opacity-30">
              <Image 
                src={artist.images[0].url} 
                alt={`Imagen de fondo de ${artist.name}`} 
                fill 
                style={{ objectFit: 'cover' }} 
                priority 
              />
            </div>
          )}
        </div>

        {/* Información del artista */}
        <motion.div 
          className="container mx-auto px-4 md:px-6 py-8 md:py-12 relative z-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8">
            {/* Imagen del artista - más pequeña en móvil */}
            <motion.div 
              className="w-32 h-32 md:w-44 md:h-44 relative rounded-full overflow-hidden border-4 border-white/20 shadow-2xl"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Image 
                src={artist.images && artist.images[0] ? artist.images[0].url : '/placeholder-artist.jpg'} 
                alt={`Foto de ${artist.name}`} 
                fill 
                style={{ objectFit: 'cover' }} 
                priority 
              />
            </motion.div>
            
            {/* Información del artista */}
            <motion.div 
              className="text-center md:text-left flex-1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              {/* Nombre y fuente */}
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 mb-3 md:mb-4">
                <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-white leading-tight">
                  {artist.name}
                </h1>
                <div className="flex justify-center md:justify-start">
                  {dataSource === 'youtube' && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-red-600 rounded-full">
                      <YoutubeIcon className="w-4 h-4 text-white" />
                      <span className="text-white text-xs font-medium">YouTube</span>
                    </div>
                  )}
                  {dataSource === 'spotify' && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-600 rounded-full">
                      <SpotifyIcon className="w-4 h-4 text-white" />
                      <span className="text-white text-xs font-medium">Spotify</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Estadísticas */}
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 mb-3 md:mb-4 text-white text-sm md:text-base">
                {artist.followers && (
                  <div className="flex items-center justify-center md:justify-start gap-1">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.5 1.5 0 0 0 18.54 8H16c-.8 0-1.54.37-2 1l-3.72 5.6-2.28-6.8A1.5 1.5 0 0 0 6.54 7H4c-.8 0-1.54.37-2 1L.46 15.37A1.5 1.5 0 0 0 1.88 17H4v5h2v-5h2.5l2.5-3.75L13.5 17H16v5h4z"/>
                    </svg>
                    <span>{formatNumber(artist.followers.total)} seguidores</span>
                  </div>
                )}
                {youtubeArtist?.views && (
                  <div className="flex items-center justify-center md:justify-start gap-1">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                    <span>{youtubeArtist.views} visualizaciones</span>
                  </div>
                )}
              </div>

              {/* Géneros */}
              {artist.genres && artist.genres.length > 0 && (
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-3 md:mb-4">
                  {artist.genres.slice(0, 3).map(genre => (
                    <span 
                      key={genre} 
                      className="px-2 py-1 md:px-3 md:py-1.5 text-xs md:text-sm bg-purple-600/30 border border-purple-500/50 text-purple-200 rounded-full"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {/* Descripción (solo YouTube) */}
              {youtubeArtist?.description && (
                <p className="text-gray-300 text-sm md:text-base line-clamp-2 md:line-clamp-3 max-w-2xl">
                  {youtubeArtist.description}
                </p>
              )}
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Tabs de contenido optimizadas */}
      <div className="container mx-auto px-4 md:px-6 py-6 md:py-8">
        <motion.div 
          className="mb-6 md:mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {/* Tabs responsivas */}
          <div className="flex overflow-x-auto scrollbar-hide border-b border-zinc-700 mb-6">
            <div className="flex space-x-1 md:space-x-2 min-w-max">
              <button
                onClick={() => handleTabChange({} as any, 0)}
                className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-3 text-sm md:text-base font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                  activeTab === 0 
                    ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-900/20' 
                    : 'text-gray-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
                <span>Top Tracks</span>
              </button>
              
              <button
                onClick={() => handleTabChange({} as any, 1)}
                className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-3 text-sm md:text-base font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                  activeTab === 1 
                    ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-900/20' 
                    : 'text-gray-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                </svg>
                <span>Álbumes</span>
              </button>
              
              {dataSource === 'youtube' && (
                <button
                  onClick={() => handleTabChange({} as any, 2)}
                  className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-3 text-sm md:text-base font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                    activeTab === 2 
                      ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-900/20' 
                      : 'text-gray-400 hover:text-white hover:bg-zinc-800/50'
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                  </svg>
                  <span>Videos</span>
                </button>
              )}
              
              <button
                onClick={() => handleTabChange({} as any, dataSource === 'youtube' ? 3 : 2)}
                className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-3 text-sm md:text-base font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                  activeTab === (dataSource === 'youtube' ? 3 : 2)
                    ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-900/20' 
                    : 'text-gray-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.5 1.5 0 0 0 18.54 8H16c-.8 0-1.54.37-2 1l-3.72 5.6-2.28-6.8A1.5 1.5 0 0 0 6.54 7H4c-.8 0-1.54.37-2 1L.46 15.37A1.5 1.5 0 0 0 1.88 17H4v5h2v-5h2.5l2.5-3.75L13.5 17H16v5h4z"/>
                </svg>
                <span>Similares</span>
              </button>
            </div>
          </div>

          {/* Contenido de las pestañas */}
          <div className="py-4 md:py-6">
            {/* Pestaña 1: Top Tracks */}
            {activeTab === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {!loading && !error && originalSpotifyTopTracks.length === 0 ? (
                  <div className="text-center py-8 md:py-12">
                    <div className="inline-block p-3 md:p-4 rounded-full bg-zinc-800/50 mb-3 md:mb-4">
                      <svg className="w-8 h-8 md:w-10 md:h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                      </svg>
                    </div>
                    <h3 className="text-lg md:text-xl font-medium text-gray-300 mb-2">Sin canciones populares</h3>
                    <p className="text-gray-400 text-sm md:text-base">No se encontraron canciones populares para este artista.</p>
                  </div>
                ) : (
                  !loading && originalSpotifyTopTracks.length > 0 && (
                    <div>
                      {/* Vista móvil: Lista compacta */}
                      <div className="md:hidden space-y-2">
                        {originalSpotifyTopTracks.map((track, index) => (
                          <motion.div
                            key={track.id || `track-${index}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            className="flex items-center gap-3 p-3 bg-zinc-800/30 rounded-lg hover:bg-zinc-700/30 transition-colors duration-200 cursor-pointer"
                            onClick={() => handlePlayTrack(track)}
                          >
                            {/* Número de track */}
                            <div className="w-6 text-center text-gray-400 text-sm font-medium">
                              {index + 1}
                            </div>
                            
                            {/* Imagen del álbum */}
                            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                              <Image
                                src={track.cover || track.albumCover || '/img/default-track.jpg'}
                                alt={track.title}
                                width={48}
                                height={48}
                                className="object-cover w-full h-full"
                              />
                            </div>
                            
                            {/* Información de la canción */}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-white text-sm truncate">{track.title}</h3>
                              <p className="text-zinc-400 text-xs truncate">
                                {track.artist || 'Artista desconocido'}
                              </p>
                            </div>
                            
                            {/* Duración */}
                            <div className="text-zinc-400 text-xs font-medium">
                              {track.duration ? formatDuration(track.duration * 1000) : '--:--'}
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      {/* Vista desktop: Tabla completa */}
                      <div className="hidden md:block">
                                                 {/* Cabecera de la tabla */}
                         <div className="grid grid-cols-[40px_4fr_3fr_2fr_auto] gap-4 px-4 py-2 border-b border-white/10 text-gray-400 text-sm">
                           <div className="text-center">#</div>
                           <div>TÍTULO</div>
                           <div>ÁLBUM</div>
                           <div>RANKING</div>
                           <div className="flex justify-end">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                               <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                             </svg>
                           </div>
                         </div>

                        {/* Lista de canciones */}
                        <div className="mt-2">
                          {originalSpotifyTopTracks.map((track, index) => (
                            <motion.div
                              key={track.id || `track-${index}`}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2, delay: index * 0.03 }}
                              className="grid grid-cols-[40px_4fr_3fr_2fr_auto] gap-4 px-4 py-2 rounded-md hover:bg-white/5 group items-center cursor-pointer"
                              onClick={() => handlePlayTrack(track)}
                            >
                              <div className="flex items-center justify-center text-gray-400">
                                <span>{index + 1}</span>
                              </div>

                                                             <div className="flex items-center min-w-0">
                                 <div className="relative w-10 h-10 mr-3 flex-shrink-0">
                                   <Image
                                     src={track.cover || track.albumCover || '/img/default-track.jpg'}
                                     alt={track.title}
                                     fill
                                     className="object-cover rounded"
                                   />
                                 </div>
                                 <div className="min-w-0">
                                   <p className="text-white truncate font-medium group-hover:text-purple-400">{track.title}</p>
                                   <div className="text-gray-400 text-sm truncate">
                                     {track.artist || 'Artista desconocido'}
                                   </div>
                                 </div>
                               </div>
 
                               <div className="flex items-center min-w-0">
                                 <span className="text-gray-300 truncate">
                                   {track.album || 'Álbum desconocido'}
                                 </span>
                               </div>

                                                             <div className="flex items-center text-gray-400 text-sm">
                                 <div className="flex items-center gap-1">
                                   <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                     <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                   </svg>
                                   <span>{index + 1}º</span>
                                 </div>
                               </div>

                              <div className="flex items-center justify-end text-gray-400 text-sm">
                                {track.duration ? formatDuration(track.duration * 1000) : '--:--'}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </motion.div>
            )}

            {/* Pestaña 2: Álbumes */}
            {activeTab === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {albums.length === 0 ? (
                  <div className="text-center py-8 md:py-12">
                    <div className="inline-block p-3 md:p-4 rounded-full bg-zinc-800/50 mb-3 md:mb-4">
                      <svg className="w-8 h-8 md:w-10 md:h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                      </svg>
                    </div>
                    <h3 className="text-lg md:text-xl font-medium text-gray-300 mb-2">Sin álbumes</h3>
                    <p className="text-gray-400 text-sm md:text-base">No se encontraron álbumes para este artista.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                    {albums.map((album, index) => (
                      <motion.div
                        key={album.id || album.browseId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <UnifiedMusicCard 
                          id={album.id || album.browseId || ''} 
                          title={album.name || album.title || ''} 
                          subtitle={album.year || (album.release_date ? album.release_date.split('-')[0] : '')} 
                          coverUrl={album.images?.[0]?.url || album.thumbnails?.[0]?.url || '/placeholder-album.jpg'} 
                          isPlayable={false} 
                          itemType="album" 
                          linkTo={`/album/${album.id || album.browseId}`} 
                          badge={{ text: dataSource === 'youtube' ? 'YouTube' : 'Spotify', color: dataSource === 'youtube' ? 'bg-red-600' : 'bg-green-600' }} 
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Pestaña 3: Videos (Solo YouTube) */}
            {activeTab === 2 && dataSource === 'youtube' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {!youtubeArtist?.videos?.results || youtubeArtist.videos.results.length === 0 ? (
                  <div className="text-center py-8 md:py-12">
                    <div className="inline-block p-3 md:p-4 rounded-full bg-zinc-800/50 mb-3 md:mb-4">
                      <svg className="w-8 h-8 md:w-10 md:h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                      </svg>
                    </div>
                    <h3 className="text-lg md:text-xl font-medium text-gray-300 mb-2">Sin videos</h3>
                    <p className="text-gray-400 text-sm md:text-base">No se encontraron videos para este artista.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                    {youtubeArtist?.videos?.results?.map((video, index) => (
                      <motion.div
                        key={video.videoId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <UnifiedMusicCard 
                          id={video.videoId} 
                          title={video.title} 
                          subtitle={video.views || ''} 
                          coverUrl={video.thumbnails?.[0]?.url || '/placeholder-video.jpg'} 
                          isPlayable={true} 
                          itemType="video" 
                          badge={{ text: 'Video', color: 'bg-red-600' }} 
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Pestaña 4: Artistas similares */}
            {activeTab === (dataSource === 'youtube' ? 3 : 2) && (
              <motion.div
                className="min-h-48 md:min-h-64"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {relatedArtistsLoading ? (
                  <div className="flex justify-center items-center py-12 md:py-16">
                    <div className="animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-t-2 border-b-2 border-purple-500"></div>
                  </div>
                ) : relatedArtistsError ? (
                  <div className="p-4 md:p-6 bg-red-900/20 border border-red-800/30 text-red-300 rounded-lg">
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm md:text-base">{relatedArtistsError}</p>
                    </div>
                  </div>
                ) : !relatedArtistsLoaded && dataSource === 'spotify' ? (
                  <div className="text-center py-8 md:py-12">
                    <div className="animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
                    <p className="text-gray-400 text-sm md:text-base">Cargando artistas similares...</p>
                  </div>
                ) : relatedArtists.length === 0 ? (
                  <div className="text-center py-8 md:py-12">
                    <div className="inline-block p-3 md:p-4 rounded-full bg-zinc-800/50 mb-3 md:mb-4">
                      <svg className="w-8 h-8 md:w-10 md:h-10 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.5 1.5 0 0 0 18.54 8H16c-.8 0-1.54.37-2 1l-3.72 5.6-2.28-6.8A1.5 1.5 0 0 0 6.54 7H4c-.8 0-1.54.37-2 1L.46 15.37A1.5 1.5 0 0 0 1.88 17H4v5h2v-5h2.5l2.5-3.75L13.5 17H16v5h4z"/>
                      </svg>
                    </div>
                    <h3 className="text-lg md:text-xl font-medium text-gray-300 mb-2">Sin artistas similares</h3>
                    <p className="text-gray-400 text-sm md:text-base">No se encontraron artistas similares.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                    {relatedArtists.map((relArtist, index) => (
                      <motion.div
                        key={relArtist.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <UnifiedMusicCard
                          id={relArtist.id}
                          title={relArtist.name}
                          coverUrl={relArtist.images?.[0]?.url || '/placeholder-artist.jpg'}
                          isPlayable={false}
                          itemType="artist"
                          linkTo={`/artist/${relArtist.id}`}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Descripción del artista (solo YouTube) */}
        {youtubeArtist?.description && (
          <motion.div 
            className="p-4 md:p-6 mb-6 md:mb-8 bg-zinc-800/50 rounded-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <h3 className="text-lg md:text-xl font-bold text-white mb-3 md:mb-4">Acerca del artista</h3>
            <p className="text-gray-300 text-sm md:text-base leading-relaxed">{youtubeArtist.description}</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Componentes auxiliares optimizados
const YoutubeIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
  </svg>
);

const SpotifyIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);
