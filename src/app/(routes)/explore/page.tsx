'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { getCategories, getCategoryPlaylists } from '@/services/spotify';
import { 
  getGeneralRecommendations, 
  getTrendingTracks, 
  getRecommendationsByGenre,
  getAvailableGenres as getMultiAvailableGenres
} from '@/services/recommendations';
import { usePlayer } from '@/contexts/PlayerContext';
import { Track } from '@/types/types';
import GenreImage from '@/components/GenreImage';
import GenreSelector from '@/components/GenreSelector';
import { CircuitBreaker } from '@/lib/resilience/circuit-breaker';
import { getSourceManager, SourceType } from '@/lib/source-manager';
import UnifiedMusicCard from '@/components/UnifiedMusicCard';
import { useAuth } from '@/components/providers/AuthProvider';
import demoDataService from '@/services/demo/demo-data-service';
import LoadingState from '@/components/LoadingState';
import { useTranslation } from '@/hooks/useTranslation';
import { homePlayTrack } from '@/services/player/homePlayService';

interface Category {
  id: string;
  name: string;
  icons: Array<{ url: string }>;
}

interface Playlist {
  id: string;
  name: string;
  description: string;
  images: Array<{ url: string }>;
  owner: { display_name: string };
}

// Imágenes de fondo para géneros
const genreImages: Record<string, string> = {
  'pop': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819',
  'rock': 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee',
  'hip-hop': 'https://images.unsplash.com/photo-1601643157091-ce5c665179ab',
  'electronic': 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745',
  'jazz': 'https://images.unsplash.com/photo-1511192336575-5a79af67a629',
  'r&b': 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f',
  'latin': 'https://images.unsplash.com/photo-1535324492437-d8dea70a38a7',
  'classical': 'https://images.unsplash.com/photo-1507838153414-b4b713384a76',
  'indie': 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b',
  'metal': 'https://images.unsplash.com/photo-1629276301820-0f3eedc29fd0',
  'soul': 'https://images.unsplash.com/photo-1605722625766-a4c989c747a4',
  'blues': 'https://images.unsplash.com/photo-1601312378427-822b2b41da35',
  'default': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
};

// Utilidad para manejar errores en modo demo
const handleDemoError = (error: any, fallbackData: any = [], errorMessage: string = ''): any => {
  console.log('[ExplorePage] Error en modo demo, usando fallback:', errorMessage, error);
  // Si tenemos datos de fallback, los devolvemos
  return fallbackData;
};

export default function ExplorePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryPlaylists, setCategoryPlaylists] = useState<Playlist[]>([]);
  const [recommendedTracks, setRecommendedTracks] = useState<Track[]>([]);
  const [personalRecommendations, setPersonalRecommendations] = useState<Track[]>([]);
  const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingGenres, setLoadingGenres] = useState(true);
  const [loadingPersonal, setLoadingPersonal] = useState(true);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [currentGenreSource, setCurrentGenreSource] = useState<SourceType>('spotify');
  
  const { isAuthenticated, isDemo, preferredLanguage, toggleDemoMode } = useAuth();
  const { t, language } = useTranslation();
  const sourceManager = getSourceManager();
  const { playTrack } = usePlayer();
  const router = useRouter();

  // Mensaje de depuración para el modo demo
  useEffect(() => {
    if (isDemo) {
      console.log('[ExplorePage] Página cargada con modo demo activo desde el contexto');
    }
  }, [isDemo]);

  // Efecto para obtener datos generales y recomendaciones
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Verificar si estamos en modo demo (usamos tanto el contexto como las cookies para mayor robustez)
        const isDemoFromCookie = document.cookie.includes('demo-mode=true') || document.cookie.includes('demoMode=true');
        const inDemoMode = isDemo || isDemoFromCookie;
        
        console.log('[ExplorePage] Verificación de modo demo:', { isDemo, isDemoFromCookie, inDemoMode });
        
        // Si hay incoherencia entre cookie y estado, actualizar el estado en vez de recargar
        if (isDemoFromCookie && !isDemo) {
          console.log('[ExplorePage] Detectada cookie de demo-mode pero estado no sincronizado');
          // En lugar de recargar, usar el contexto para actualizar el estado
          if (toggleDemoMode) {
            console.log('[ExplorePage] Sincronizando estado de demo con cookie existente');
            toggleDemoMode(true); // Forzar estado demo = true para que coincida con la cookie
          }
        }
        
        if (inDemoMode) {
          console.log('[ExplorePage] Cargando datos en modo demo (cookie o contexto)');
          
          try {
            // Cargar categorías desde datos demo con manejo de errores robusto
            try {
              const categoriesData = await demoDataService.getFeaturedPlaylists();
              if (categoriesData && categoriesData.playlists && categoriesData.playlists.items) {
                // Convertir playlists a formato de categorías para la visualización
                const demoCategories = categoriesData.playlists.items.map((playlist: any, index: number) => ({
                  id: playlist.id || `demo-category-${index}`,
                  name: playlist.name || `Categoría ${index + 1}`,
                  icons: playlist.images && playlist.images.length > 0 ? [{ url: playlist.images[0].url }] : []
                }));
                setCategories(demoCategories);
              }
            } catch (error) {
              // En caso de error, usar categorías predefinidas
              const fallbackCategories = [
                { id: 'pop', name: 'Pop', icons: [{ url: genreImages['pop'] }] },
                { id: 'rock', name: 'Rock', icons: [{ url: genreImages['rock'] }] },
                { id: 'hip-hop', name: 'Hip Hop', icons: [{ url: genreImages['hip-hop'] }] },
                { id: 'electronic', name: 'Electrónica', icons: [{ url: genreImages['electronic'] }] }
              ];
              setCategories(handleDemoError(error, fallbackCategories, 'Error cargando categorías'));
            }
            
            // Cargar recomendaciones desde datos demo (mezclando idiomas)
            // Usamos datos demo pero les asignamos idiomas diferentes para simular diversidad
            const tracksData = await demoDataService.getRecommendations();
            if (tracksData && tracksData.tracks) {
              // Convertir al formato Track esperado y añadir idiomas
              const demoTracks = tracksData.tracks.map((track: any, index: number) => {
                return {
                  id: track.id,
                  title: track.name,
                  artist: track.artists?.map((a: any) => a.name).join(', ') || 'Artista',
                  album: track.album?.name || '',
                  cover: track.album?.images?.[0]?.url || '/placeholder-album.jpg',
                  duration: track.duration_ms || 0,
                  spotifyId: track.id,
                  source: 'spotify',
                  itemType: 'track'
                };
              });
              setRecommendedTracks(demoTracks);
            }
            
            setError(null);
          } catch (demoError) {
            console.error('[ExplorePage] Error global cargando datos demo:', demoError);
            // No rompemos la experiencia, simplemente mostramos un mensaje de error pero permitimos seguir navegando
            setError('Algunos datos demo no pudieron cargarse correctamente. La experiencia puede estar limitada.');
          }
        } else {
          // Código modificado para modo no-demo: búsqueda por idiomas
        // Obtener categorías de Spotify
        const categoriesData = await getCategories(30);
        setCategories(categoriesData);
        
          // Búsqueda multi-idioma para recomendaciones
          console.log('[ExploreMúsica] Solicitando música en múltiples idiomas');
          
          // Usar la API de Spotify directamente para mejor calidad
          const spotifyApi = await import('@/services/spotify');
          
          // Términos de búsqueda por idioma
          const searchQueries = [
            { term: 'música latina', language: 'Español' },
            { term: 'top hits', language: 'English' },
            { term: 'musica brasileira', language: 'Português' },
            { term: 'musique française', language: 'Français' },
            { term: 'musica italiana', language: 'Italiano' }
          ];
          
          let allResults: Track[] = [];
          
          // Realizar búsquedas en paralelo para cada idioma
          const searches = await Promise.all(
            searchQueries.map(query => 
              spotifyApi.searchTracks(query.term, 5)
                .then((results: any) => {
                  // Solo conservar tracks con imágenes de Spotify
                  return results
                    .filter((item: any) => 
                      item?.album?.images?.[0]?.url && 
                      item.album.images[0].url.includes('i.scdn.co') // Verificar que sea dominio de Spotify
                    )
                    .map((item: any) => ({
                      id: item.id,
                      title: item.name,
                      artist: item.artists?.map((a: any) => a.name).join(', ') || 'Spotify Artist',
                      album: item.album?.name || '',
                      albumCover: item.album?.images?.[0]?.url || '',
                      cover: item.album?.images?.[0]?.url || '',
                      duration: item.duration_ms || 0,
                      spotifyId: item.id,
                      source: 'spotify',
                      language: query.language,
                      itemType: 'track'
                    }));
                })
                .catch(() => [])
            )
          );
          
          // Combinar todos los resultados
          searches.forEach(result => {
            allResults = [...allResults, ...result];
          });
          
          // Eliminar duplicados por ID de Spotify
          const uniqueResults: Track[] = [];
          const spotifyIds = new Set<string>();
          
          allResults.forEach(track => {
            if (track.spotifyId && !spotifyIds.has(track.spotifyId)) {
              spotifyIds.add(track.spotifyId);
              uniqueResults.push(track);
            }
          });
          
          if (uniqueResults.length > 0) {
            console.log(`[ExploreMúsica] Encontradas ${uniqueResults.length} canciones en múltiples idiomas`);
            setRecommendedTracks(uniqueResults);
            
            // Registrar éxito para Spotify
            sourceManager.registerSourceSuccess('spotify');
          } else {
            // Si no se encuentran resultados, usar la implementación original
        const tracksData = await getGeneralRecommendations(20);
        setRecommendedTracks(tracksData);
          }
        
        setError(null);
        }
      } catch (err) {
        console.error('Error al cargar datos de exploración:', err);
        setError('Error al cargar datos. Por favor, intenta de nuevo más tarde.');
        
        // Registrar error para Spotify
        sourceManager.registerSourceError('spotify');
        
        // Intentar recuperar de un error con datos alternos
        try {
          // Intentar con recomendaciones de Last.fm como fallback
          const fallbackTracks = await getGeneralRecommendations(20, { 
            preferredSource: 'lastfm'
          });
          
          if (fallbackTracks.length > 0) {
            setRecommendedTracks(fallbackTracks);
            sourceManager.registerSourceSuccess('lastfm');
          }
        } catch (fallbackErr) {
          console.error('Error también en fallback:', fallbackErr);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isDemo, preferredLanguage, toggleDemoMode]);

  // Efecto para cargar canciones en tendencia
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        setLoadingTrending(true);
        
        // Verificar si estamos en modo demo (usando contexto y cookies)
        const isDemoFromCookie = document.cookie.includes('demo-mode=true') || document.cookie.includes('demoMode=true');
        const inDemoMode = isDemo || isDemoFromCookie;
        
        // Si hay incoherencia entre cookie y estado, actualizar el estado en vez de recargar
        if (isDemoFromCookie && !isDemo && toggleDemoMode) {
          console.log('[ExplorePage] Sincronizando estado de demo en tendencias');
          toggleDemoMode(true);
        }
        
        if (inDemoMode) {
          console.log('[ExplorePage] Cargando tendencias en modo demo');
          try {
            // Usar datos demo para tendencias (podemos usar topTracks o newReleases)
            const demoTopTracks = await demoDataService.getTopTracks();
            
            if (demoTopTracks && demoTopTracks.items && demoTopTracks.items.length > 0) {
              // Convertir al formato Track esperado
              const demoTrendingTracks = demoTopTracks.items.map((item: any) => {
                const track = item.track || item;
                return {
                  id: track.id,
                  title: track.name,
                  artist: track.artists?.map((a: any) => a.name).join(', ') || 'Artista Demo',
                  album: track.album?.name || '',
                  cover: track.album?.images?.[0]?.url || '/placeholder-album.jpg',
                  albumCover: track.album?.images?.[0]?.url || '/placeholder-album.jpg',
                  duration: track.duration_ms || 0,
                  spotifyId: track.id,
                  source: 'spotify',
                  itemType: 'track'
                };
              });
              
              // Limitar a 15 canciones y mezclarlas aleatoriamente
              const shuffledTracks = demoTrendingTracks
                .sort(() => Math.random() - 0.5)
                .slice(0, 15);
              
              setTrendingTracks(shuffledTracks);
            } else {
              throw new Error('No se encontraron canciones en tendencia en los datos demo');
            }
          } catch (demoError) {
            console.error('[ExplorePage] Error cargando tendencias demo:', demoError);
            
            // Usar imágenes predefinidas como fallback
            const popularGenres = ['pop', 'rock', 'hip-hop', 'electronic', 'jazz'];
            const fallbackTracks: Track[] = popularGenres.map((genre, index) => ({
              id: `fallback-${index}`,
              title: `Éxitos de ${genre.charAt(0).toUpperCase() + genre.slice(1)}`,
              artist: 'Artistas Populares',
              album: 'Tendencias',
              cover: genreImages[genre] || genreImages.default,
              albumCover: genreImages[genre] || genreImages.default,
              duration: 180000,
              source: 'fallback',
              itemType: 'track'
            }));
            
            setTrendingTracks(fallbackTracks);
          }
        } else {
          // Código original para modo no-demo
        
        // NUEVA SOLUCIÓN: Solicitar directamente a Spotify con búsqueda de alta calidad
        console.log('[Tendencias] Solicitando directamente desde Spotify para garantizar imágenes');
        
        // Usar la API de Spotify directamente para obtener mejor calidad
        const spotifyApi = await import('@/services/spotify');
        
        // Combinar varias búsquedas para obtener una variedad de canciones
        const queries = ['top hits', 'new releases', 'popular', 'chart'];
        let allResults: Track[] = [];
        
        // Realizar búsquedas en paralelo para cada término
        const searches = await Promise.all(
          queries.map(query => 
            spotifyApi.searchTracks(query, 10)
              .then((results: any) => {
                // Solo conservar tracks con imágenes de Spotify
                return results
                  .filter((item: any) => 
                    item?.album?.images?.[0]?.url && 
                    item.album.images[0].url.includes('i.scdn.co') // Verificar que sea dominio de Spotify
                  )
                  .map((item: any) => ({
                    id: item.id,
                    title: item.name,
                    artist: item.artists?.map((a: any) => a.name).join(', ') || 'Spotify Artist',
                    album: item.album?.name || '',
                    albumCover: item.album?.images?.[0]?.url || '',
                    cover: item.album?.images?.[0]?.url || '',
                    duration: item.duration_ms || 0,
                    spotifyId: item.id,
                    source: 'spotify',
                    itemType: 'track'
                  }));
              })
              .catch(() => [])
          )
        );
        
        // Combinar todos los resultados
        searches.forEach(result => {
          allResults = [...allResults, ...result];
        });
        
        // Eliminar duplicados por ID de Spotify
        const uniqueResults: Track[] = [];
        const spotifyIds = new Set<string>();
        
        allResults.forEach(track => {
          if (track.spotifyId && !spotifyIds.has(track.spotifyId)) {
            spotifyIds.add(track.spotifyId);
            uniqueResults.push(track);
          }
        });
        
        // Seleccionar 15 canciones aleatorias para variedad
        const shuffledResults = uniqueResults.sort(() => Math.random() - 0.5).slice(0, 15);
        
        if (shuffledResults.length > 0) {
          console.log(`[Tendencias] Encontradas ${shuffledResults.length} canciones con imágenes de Spotify`);
          setTrendingTracks(shuffledResults);
        } else {
          // Si no se encuentran resultados, usar fallback
          throw new Error('No se encontraron canciones con imágenes de calidad');
          }
        }
      } catch (err) {
        console.error('Error al cargar tendencias:', err);
        
        // Último recurso: usar géneros populares con imágenes predefinidas
        try {
          const popularGenres = ['pop', 'rock', 'hip-hop', 'electronic', 'jazz'];
          const fallbackTracks: Track[] = popularGenres.map((genre, index) => ({
            id: `fallback-${index}`,
            title: `Éxitos de ${genre.charAt(0).toUpperCase() + genre.slice(1)}`,
            artist: 'Artistas Populares',
            album: 'Tendencias',
            cover: genreImages[genre] || genreImages.default,
            albumCover: genreImages[genre] || genreImages.default,
            duration: 180000,
            source: 'fallback',
            itemType: 'track'
          }));
          
          setTrendingTracks(fallbackTracks);
        } catch (fallbackErr) {
          console.error('Error también en fallback final:', fallbackErr);
          setTrendingTracks([]);
        }
      } finally {
        setLoadingTrending(false);
      }
    };

    fetchTrending();
  }, [isDemo, preferredLanguage, toggleDemoMode]);

  // Efecto para cargar recomendaciones personalizadas
  useEffect(() => {
    const fetchPersonalRecommendations = async () => {
      try {
        setLoadingPersonal(true);
        
        // Verificar si estamos en modo demo (usando contexto y cookies)
        const isDemoFromCookie = document.cookie.includes('demo-mode=true') || document.cookie.includes('demoMode=true');
        const inDemoMode = isDemo || isDemoFromCookie;
        
        // Si hay incoherencia entre cookie y estado, actualizar el estado
        if (isDemoFromCookie && !isDemo && toggleDemoMode) {
          console.log('[ExplorePage] Sincronizando estado de demo en recomendaciones personales');
          toggleDemoMode(true);
        }
        
        if (inDemoMode) {
          console.log('[ExplorePage] Cargando recomendaciones personales en modo demo');
          try {
            // Usar datos demo para recomendaciones personales
            const demoSavedTracks = await demoDataService.getSavedTracks();
            
            if (demoSavedTracks && demoSavedTracks.items && demoSavedTracks.items.length > 0) {
              // Convertir al formato Track esperado
              const demoPersonalTracks = demoSavedTracks.items.map((item: any) => {
                const track = item.track || item;
                return {
                  id: track.id,
                  title: track.name,
                  artist: track.artists?.map((a: any) => a.name).join(', ') || 'Artista Demo',
                  album: track.album?.name || '',
                  cover: track.album?.images?.[0]?.url || '/placeholder-album.jpg',
                  albumCover: track.album?.images?.[0]?.url || '/placeholder-album.jpg',
                  duration: track.duration_ms || 0,
                  spotifyId: track.id,
                  source: 'spotify',
                  itemType: 'track'
                };
              });
              
              // Limitar a 12 canciones y mezclarlas aleatoriamente
              const shuffledTracks = demoPersonalTracks
                .sort(() => Math.random() - 0.5)
                .slice(0, 12);
              
              setPersonalRecommendations(shuffledTracks);
            } else {
              throw new Error('No se encontraron canciones guardadas en los datos demo');
            }
          } catch (demoError) {
            console.error('[ExplorePage] Error cargando recomendaciones personales demo:', demoError);
            // Usar fallbacks si es necesario
          }
        } else {
          // Código original para modo no-demo
        // NUEVA SOLUCIÓN: Solicitar directamente a Spotify usando géneros populares
        console.log('[Para Ti] Solicitando directamente desde Spotify para garantizar imágenes');
        
        // Usar la API de Spotify directamente
        const spotifyApi = await import('@/services/spotify');
        
        // Lista de géneros populares para solicitar recomendaciones
        const popularGenres = ['pop', 'indie', 'electronic', 'rock', 'hip-hop', 'r&b', 'latin'];
        const selectedGenres = popularGenres.slice(0, 3); // Tomar tres géneros aleatorios
        
        let allResults: Track[] = [];
        
        // Realizar búsquedas en paralelo para cada género
        const searches = await Promise.all(
          selectedGenres.map(genre => 
            spotifyApi.searchTracks(`genre:${genre}`, 10)
              .then((results: any) => {
                // Solo conservar tracks con imágenes de Spotify
                return results
                  .filter((item: any) => 
                    item?.album?.images?.[0]?.url && 
                    item.album.images[0].url.includes('i.scdn.co') // Verificar que sea dominio de Spotify
                  )
                  .map((item: any) => ({
                    id: item.id,
                    title: item.name,
                    artist: item.artists?.map((a: any) => a.name).join(', ') || 'Spotify Artist',
                    album: item.album?.name || '',
                    albumCover: item.album?.images?.[0]?.url || '',
                    cover: item.album?.images?.[0]?.url || '',
                    duration: item.duration_ms || 0,
                    spotifyId: item.id,
                    source: 'spotify',
                    itemType: 'track'
                  }));
              })
              .catch(() => [])
          )
        );
        
        // Combinar todos los resultados
        searches.forEach(result => {
          allResults = [...allResults, ...result];
        });
        
        // Eliminar duplicados por ID de Spotify
        const uniqueResults: Track[] = [];
        const spotifyIds = new Set<string>();
        
        allResults.forEach(track => {
          if (track.spotifyId && !spotifyIds.has(track.spotifyId)) {
            spotifyIds.add(track.spotifyId);
            uniqueResults.push(track);
          }
        });
        
        // Seleccionar 10 canciones aleatorias para variedad
        const shuffledResults = uniqueResults.sort(() => Math.random() - 0.5).slice(0, 10);
        
        if (shuffledResults.length > 0) {
          console.log(`[Para Ti] Encontradas ${shuffledResults.length} canciones con imágenes de Spotify`);
          setPersonalRecommendations(shuffledResults);
        } else {
          // Si no se encuentran resultados, usar fallback
          throw new Error('No se encontraron canciones con imágenes de calidad');
          }
        }
      } catch (err) {
        console.error('Error al cargar recomendaciones personales:', err);
        
        // Usar fallbacks si es necesario
      } finally {
        setLoadingPersonal(false);
      }
    };

    fetchPersonalRecommendations();
  }, [isDemo, preferredLanguage, toggleDemoMode]);

  // Efecto para cargar géneros disponibles
  useEffect(() => {
    const fetchGenres = async () => {
      try {
        setLoadingGenres(true);
        
        // Verificar si estamos en modo demo (usando contexto y cookies)
        const isDemoFromCookie = document.cookie.includes('demo-mode=true') || document.cookie.includes('demoMode=true');
        const inDemoMode = isDemo || isDemoFromCookie;
        
        // Si hay incoherencia entre cookie y estado, actualizar el estado
        if (isDemoFromCookie && !isDemo && toggleDemoMode) {
          console.log('[ExplorePage] Sincronizando estado de demo en carga de géneros');
          toggleDemoMode(true);
        }
        
        if (inDemoMode) {
          console.log('[ExplorePage] Cargando géneros en modo demo');
          // En modo demo, simplemente usar una lista predefinida de géneros
          const demoGenres = [
            'pop', 'rock', 'hip-hop', 'electronic', 'jazz', 
            'r&b', 'latin', 'classical', 'indie', 'metal'
          ];
          setGenres(demoGenres);
        } else {
          // Código original para modo no-demo
          // Usar la implementación multi-fuente para obtener géneros
          const availableGenres = await getMultiAvailableGenres();
          setGenres(availableGenres);
        }
      } catch (error) {
        console.error('Error al obtener géneros:', error);
      } finally {
        setLoadingGenres(false);
      }
    };

    fetchGenres();
  }, [isDemo, toggleDemoMode]);

  useEffect(() => {
    const fetchCategoryPlaylists = async () => {
      if (!selectedCategory) return;
      
      try {
        setLoading(true);
        const playlists = await getCategoryPlaylists(selectedCategory, 20);
        setCategoryPlaylists(playlists);
        setError(null);
      } catch (err) {
        console.error(`Error al cargar playlists de la categoría ${selectedCategory}:`, err);
        setError('Error al cargar playlists. Por favor, intenta de nuevo más tarde.');
        setCategoryPlaylists([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryPlaylists();
  }, [selectedCategory]);

  // Función para manejar selección de género con fuente
  const handleGenreSelect = (genre: string, source: SourceType) => {
    setCurrentGenreSource(source);
    router.push(`/explore/genre/${genre}?source=${source}`);
  };

  // Función para reproducir una canción
  const handlePlayTrack = async (track: Track) => {
    try {
      console.log('[ExplorePage] Intentando reproducir track:', track);
      
      // Asegurarse de que el track tiene todos los campos necesarios
      const enhancedTrack = {
        ...track,
        // Asegurar que tenemos ambos formatos de título
        title: track.title || '',
        // Asegurar todos los formatos de id
        id: track.id || '',
        spotifyId: track.spotifyId || track.id || '',
        uri: track.spotifyId || track.id || '',
        // Mantener el artista como está
        artist: track.artist || '',
        // Asegurar todas las variantes de imágenes
        cover: track.cover || track.albumCover || track.thumbnail || '',
        albumCover: track.albumCover || track.cover || track.thumbnail || '',
        thumbnail: track.thumbnail || track.cover || track.albumCover || '',
        // Asegurar formatos de duración
        duration: track.duration || 0,
        // Asegurar fuente
        source: track.source || 'spotify'
      };
      
      console.log('[ExplorePage] Track mejorado para reproducción:', enhancedTrack);
      
      // Usar explícitamente homePlayTrack para evitar confusiones
      await homePlayTrack(enhancedTrack);
    } catch (error) {
      console.error('[ExplorePage] Error al reproducir track:', error);
      // Mostrar un mensaje al usuario
      alert('No se pudo reproducir la canción. Por favor, intenta con otra.');
    }
  };

  // Loading spinner con mejora visual
  if (loading && categories.length === 0) {
    return (
      <div className="container mx-auto p-6 min-h-screen flex flex-col items-center justify-center">
        <div className="w-20 h-20 border-4 border-purple-300 border-t-purple-600 rounded-full animate-spin mb-6"></div>
        <h2 className="text-xl font-semibold text-center bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-indigo-600">
          {t('explore.loading.discovering')}
        </h2>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 bg-gradient-to-b from-zinc-900 to-black min-h-screen">
      <motion.h1 
        className="text-3xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {t('explore.title')}
      </motion.h1>

      {error && (
        <motion.div 
          className="bg-red-900/30 border border-red-500/50 text-red-200 px-6 py-4 rounded-xl mb-6 backdrop-blur-sm"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <p className="font-medium">{error}</p>
        </motion.div>
      )}

      {/* Sección de recomendaciones personalizadas */}
      <motion.section 
        className="mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="flex items-center mb-6">
          <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-600 rounded-full mr-3"></div>
          <h2 className="text-2xl font-bold text-white">{t('explore.forYou')}</h2>
        </div>
        
        {loadingPersonal ? (
          <LoadingState 
            type="card" 
            count={5} 
            message={t('explore.loading.recommendations')}
            aspectRatio="square"
          />
        ) : personalRecommendations.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {personalRecommendations.map((track, index) => (
              <UnifiedMusicCard
                key={track.id}
                id={track.id}
                title={track.title}
                subtitle={track.artist}
                coverUrl={track.cover}
                isPlayable={true}
                itemType={track.itemType as any}
                badge={track.source ? {
                  text: track.source === 'spotify' ? 'Spotify' : 'Last.fm',
                  color: track.source === 'spotify' ? 'bg-purple-500' : 'bg-green-500'
                } : undefined}
                onPlay={() => handlePlayTrack(track)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center p-8 rounded-xl bg-zinc-800/30 backdrop-blur-sm">
            <p className="text-zinc-300">{t('explore.noRecommendations')}</p>
          </div>
        )}
      </motion.section>

      {/* Sección de canciones en tendencia */}
      <motion.section 
        className="mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="flex items-center mb-6">
          <div className="w-1 h-6 bg-gradient-to-b from-green-500 to-teal-600 rounded-full mr-3"></div>
          <h2 className="text-2xl font-bold text-white">{t('explore.trending')}</h2>
        </div>
        
        {loadingTrending ? (
          <LoadingState 
            type="card" 
            count={5} 
            message={t('explore.loading.trending')}
            aspectRatio="square"
          />
        ) : trendingTracks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {trendingTracks.map((track, index) => (
              <UnifiedMusicCard
                key={track.id}
                id={track.id}
                title={track.title}
                subtitle={track.artist}
                coverUrl={track.cover}
                isPlayable={true}
                itemType={track.itemType as any}
                badge={track.source ? {
                  text: track.source === 'spotify' ? 'Spotify' : 'Fallback',
                  color: track.source === 'spotify' ? 'bg-purple-500' : 'bg-zinc-700'
                } : undefined}
                onPlay={() => handlePlayTrack(track)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center p-8 rounded-xl bg-zinc-800/30 backdrop-blur-sm">
            <p className="text-zinc-300">{t('explore.noTrends')}</p>
          </div>
        )}
      </motion.section>

      {/* Sección de géneros usando el validador proactivo */}
      <motion.section 
        className="mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <div className="flex items-center mb-6">
          <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full mr-3"></div>
          <h2 className="text-2xl font-bold text-white">{t('explore.genres')}</h2>
        </div>
        <div className="bg-zinc-800/40 backdrop-blur-sm p-6 rounded-xl">
          <GenreSelector onGenreSelect={handleGenreSelect} />
        </div>
      </motion.section>

      {/* Sección de recomendaciones generales */}
      <motion.section 
        className="mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="flex items-center mb-6">
          <div className="w-1 h-6 bg-gradient-to-b from-amber-500 to-orange-600 rounded-full mr-3"></div>
          <h2 className="text-2xl font-bold text-white">{t('explore.worldMusic')}</h2>
        </div>
        
        {loading ? (
          <LoadingState 
            type="card" 
            count={5} 
            message={t('explore.loading.worldMusic')}
            aspectRatio="square"
          />
        ) : recommendedTracks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {recommendedTracks.map((track, index) => (
              <UnifiedMusicCard
                key={track.id}
                id={track.id}
                title={track.title}
                subtitle={track.artist}
                coverUrl={track.cover}
                isPlayable={true}
                itemType={track.itemType as any}
                badge={track.language ? {
                  text: track.language,
                  color: 
                    track.language === 'Español' ? 'bg-red-500' : 
                    track.language === 'English' ? 'bg-blue-500' : 
                    track.language === 'Português' ? 'bg-green-500' : 
                    track.language === 'Français' ? 'bg-purple-500' : 
                    track.language === 'Italiano' ? 'bg-amber-500' : 
                    'bg-gray-500'
                } : undefined}
                onPlay={() => handlePlayTrack(track)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center p-8 rounded-xl bg-zinc-800/30 backdrop-blur-sm">
            <p className="text-zinc-300">{t('explore.noRecommendations')}</p>
          </div>
        )}
      </motion.section>

      {/* Sección de categorías de Spotify */}
      {!isDemo && (
      <motion.section 
        className="mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <div className="flex items-center mb-6">
          <div className="w-1 h-6 bg-gradient-to-b from-pink-500 to-rose-600 rounded-full mr-3"></div>
          <h2 className="text-2xl font-bold text-white">{t('explore.discover')}</h2>
        </div>
          
          {loadingCategories ? (
            <LoadingState 
              type="grid" 
              count={8} 
              message={t('explore.loading.genres')}
              withText={true}
            />
          ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {categories.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              whileHover={{ y: -5 }}
            >
              <Link
                href={`/explore/category/${category.id}`}
                className="block h-full bg-zinc-800/70 hover:bg-zinc-700/70 transition-all duration-300 rounded-xl overflow-hidden shadow-xl group"
              >
                <div className="aspect-square relative overflow-hidden">
                  {category.icons && category.icons.length > 0 ? (
                    <img 
                      src={category.icons[0].url} 
                      alt={category.name} 
                      className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-700 flex items-center justify-center transform group-hover:scale-105 transition-transform duration-500">
                      <span className="text-white text-5xl font-bold">{category.name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-white">{category.name}</h3>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
          )}
      </motion.section>
      )}

      {/* Sección de playlists de categoría */}
      {selectedCategory && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <div className="flex items-center mb-6">
            <div className="w-1 h-6 bg-gradient-to-b from-teal-500 to-emerald-600 rounded-full mr-3"></div>
            <h2 className="text-2xl font-bold text-white">
              {t('explore.playlistsOf').replace('{category}', categories.find(c => c.id === selectedCategory)?.name || selectedCategory)}
            </h2>
          </div>
          {loading ? (
            <div className="flex justify-center items-center h-60 bg-zinc-800/30 rounded-xl backdrop-blur-sm">
              <div className="w-10 h-10 border-4 border-teal-300 border-t-teal-600 rounded-full animate-spin"></div>
            </div>
          ) : categoryPlaylists.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {categoryPlaylists.map((playlist, index) => (
                <UnifiedMusicCard
                  key={playlist.id}
                  id={playlist.id}
                  title={playlist.name}
                  subtitle={playlist.owner.display_name}
                  coverUrl={playlist.images[0]?.url || ''}
                  isPlayable={false}
                  linkTo={`/playlist/${playlist.id}`}
                />
              ))}
            </div>
          ) : (
            <div className="text-center p-8 rounded-xl bg-zinc-800/30 backdrop-blur-sm">
              <p className="text-zinc-300">{t('explore.noPlaylists')}</p>
            </div>
          )}
        </motion.section>
      )}
    </div>
  );
} 