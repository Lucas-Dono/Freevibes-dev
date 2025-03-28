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
  
  const sourceManager = getSourceManager();
  const { playTrack } = usePlayer();
  const router = useRouter();

  // Efecto para obtener datos generales y recomendaciones
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Obtener categorías de Spotify
        const categoriesData = await getCategories(30);
        setCategories(categoriesData);
        
        // Obtener recomendaciones musicales generales usando el sistema multi-fuente
        const tracksData = await getGeneralRecommendations(20);
        setRecommendedTracks(tracksData);
        
        // Registrar éxito para Spotify si todo salió bien
        sourceManager.registerSourceSuccess('spotify');
        
        setError(null);
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
  }, []);

  // Efecto para cargar canciones en tendencia
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        setLoadingTrending(true);
        
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
              .then((results: any[]) => {
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
                    source: 'spotify'
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
            source: 'fallback'
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
  }, []);

  // Efecto para cargar recomendaciones personalizadas
  useEffect(() => {
    const fetchPersonalRecommendations = async () => {
      try {
        setLoadingPersonal(true);
        
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
              .then((results: any[]) => {
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
                    source: 'spotify'
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
      } catch (err) {
        console.error('Error al cargar recomendaciones personalizadas:', err);
        
        // Último recurso: usar géneros populares con imágenes predefinidas
        try {
          const popularGenres = ['pop', 'indie', 'electronic', 'rock', 'hip-hop'];
          const fallbackTracks: Track[] = popularGenres.map((genre, index) => ({
            id: `fallback-personal-${index}`,
            title: `Lo Mejor de ${genre.charAt(0).toUpperCase() + genre.slice(1)}`,
            artist: 'Artistas Recomendados',
            album: 'Para Ti',
            cover: genreImages[genre] || genreImages.default,
            albumCover: genreImages[genre] || genreImages.default,
            duration: 180000,
            source: 'fallback'
          }));
          
          setPersonalRecommendations(fallbackTracks);
        } catch (fallbackErr) {
          console.error('Error también en fallback final:', fallbackErr);
          setPersonalRecommendations([]);
        }
      } finally {
        setLoadingPersonal(false);
      }
    };

    fetchPersonalRecommendations();
  }, []);

  // Efecto para cargar géneros disponibles
  useEffect(() => {
    const fetchGenres = async () => {
      try {
        setLoadingGenres(true);
        
        // Usar el nuevo sistema multi-fuente para obtener géneros
        const genresData = await getMultiAvailableGenres();
        
        // Filtrar sólo géneros populares para mostrar
        const popularGenres = [
          'pop', 'rock', 'hip-hop', 'electronic', 'jazz', 'r&b', 
          'latin', 'classical', 'indie', 'metal', 'soul', 'blues',
          'reggae', 'country', 'alternative', 'dance'
        ];
        
        // Filtrar géneros disponibles que también están en nuestra lista de populares
        const filteredGenres = genresData.filter((genre: string) => 
          popularGenres.includes(genre.toLowerCase())
        );
        
        // Si no obtenemos suficientes géneros populares, usar los primeros 12 de la lista completa
        const finalGenres = filteredGenres.length >= 8 ? 
          filteredGenres.slice(0, 12) : 
          genresData.slice(0, 12);
        
        setGenres(finalGenres);
      } catch (err) {
        console.error('Error al cargar géneros:', err);
        // Establecer géneros por defecto en caso de error
        setGenres(['pop', 'rock', 'hip-hop', 'electronic', 'jazz', 'r&b', 'latin', 'classical']);
      } finally {
        setLoadingGenres(false);
      }
    };

    fetchGenres();
  }, []);

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
  const handlePlayTrack = (track: Track) => {
    if (playTrack) {
      playTrack(track);
    }
  };

  // Loading spinner con mejora visual
  if (loading && categories.length === 0) {
    return (
      <div className="container mx-auto p-6 min-h-screen flex flex-col items-center justify-center">
        <div className="w-20 h-20 border-4 border-purple-300 border-t-purple-600 rounded-full animate-spin mb-6"></div>
        <h2 className="text-xl font-semibold text-center bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-indigo-600">
          Descubriendo música increíble para ti...
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
        Explorar
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
          <h2 className="text-2xl font-bold text-white">Para Ti</h2>
        </div>
        
        {loadingPersonal ? (
          <div className="flex justify-center items-center h-60 bg-zinc-800/30 rounded-xl backdrop-blur-sm">
            <div className="w-10 h-10 border-4 border-purple-300 border-t-purple-600 rounded-full animate-spin"></div>
          </div>
        ) : personalRecommendations.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
            {personalRecommendations.map((track, index) => (
              <motion.div
                key={track.id}
                className="bg-zinc-800/70 hover:bg-zinc-700/70 transition-all duration-300 rounded-xl overflow-hidden shadow-xl cursor-pointer group"
                onClick={() => handlePlayTrack(track)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={{ y: -5 }}
              >
                <div className="aspect-square relative overflow-hidden">
                  <GenreImage
                    genre={track.album || 'default'}
                    artistName={track.artist}
                    trackTitle={track.title}
                    size="large"
                    className="w-full h-full transform group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="rounded-full p-3 bg-purple-600/80 backdrop-blur-sm transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-white truncate">{track.title}</h3>
                  <p className="text-zinc-400 text-sm truncate">{track.artist}</p>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 rounded-xl bg-zinc-800/30 backdrop-blur-sm">
            <p className="text-zinc-300">No hay recomendaciones disponibles. Intenta de nuevo más tarde.</p>
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
          <h2 className="text-2xl font-bold text-white">Tendencias</h2>
        </div>
        
        {loadingTrending ? (
          <div className="flex justify-center items-center h-60 bg-zinc-800/30 rounded-xl backdrop-blur-sm">
            <div className="w-10 h-10 border-4 border-green-300 border-t-green-600 rounded-full animate-spin"></div>
          </div>
        ) : trendingTracks.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {trendingTracks.map((track, index) => (
              <motion.div
                key={track.id}
                className="bg-zinc-800/70 hover:bg-zinc-700/70 transition-all duration-300 rounded-xl overflow-hidden shadow-xl cursor-pointer group"
                onClick={() => handlePlayTrack(track)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={{ y: -5 }}
              >
                <div className="aspect-square relative overflow-hidden">
                  <GenreImage
                    genre={track.album || 'default'}
                    artistName={track.artist}
                    trackTitle={track.title}
                    size="large"
                    className="w-full h-full transform group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="rounded-full p-3 bg-green-600/80 backdrop-blur-sm transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-white truncate">{track.title}</h3>
                  <p className="text-zinc-400 text-sm truncate">{track.artist}</p>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 rounded-xl bg-zinc-800/30 backdrop-blur-sm">
            <p className="text-zinc-300">No hay tendencias disponibles. Intenta de nuevo más tarde.</p>
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
          <h2 className="text-2xl font-bold text-white">Géneros</h2>
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
          <h2 className="text-2xl font-bold text-white">Explorar Música</h2>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-60 bg-zinc-800/30 rounded-xl backdrop-blur-sm">
            <div className="w-10 h-10 border-4 border-amber-300 border-t-amber-600 rounded-full animate-spin"></div>
          </div>
        ) : recommendedTracks.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
            {recommendedTracks.map((track, index) => (
              <motion.div
                key={track.id}
                className="bg-zinc-800/70 hover:bg-zinc-700/70 transition-all duration-300 rounded-xl overflow-hidden shadow-xl cursor-pointer group"
                onClick={() => handlePlayTrack(track)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={{ y: -5 }}
              >
                <div className="aspect-square relative overflow-hidden">
                  <GenreImage
                    genre={track.album || 'default'}
                    artistName={track.artist}
                    trackTitle={track.title}
                    size="large"
                    className="w-full h-full transform group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="rounded-full p-3 bg-amber-600/80 backdrop-blur-sm transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-white truncate">{track.title}</h3>
                  <p className="text-zinc-400 text-sm truncate">{track.artist}</p>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center p-8 rounded-xl bg-zinc-800/30 backdrop-blur-sm">
            <p className="text-zinc-300">No hay recomendaciones disponibles. Intenta de nuevo más tarde.</p>
          </div>
        )}
      </motion.section>

      {/* Sección de categorías de Spotify */}
      <motion.section 
        className="mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <div className="flex items-center mb-6">
          <div className="w-1 h-6 bg-gradient-to-b from-pink-500 to-rose-600 rounded-full mr-3"></div>
          <h2 className="text-2xl font-bold text-white">Descubrir</h2>
        </div>
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
                  <h3 className="font-bold text-white truncate">{category.name}</h3>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.section>

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
              Playlists de {categories.find(c => c.id === selectedCategory)?.name || selectedCategory}
            </h2>
          </div>
          {loading ? (
            <div className="flex justify-center items-center h-60 bg-zinc-800/30 rounded-xl backdrop-blur-sm">
              <div className="w-10 h-10 border-4 border-teal-300 border-t-teal-600 rounded-full animate-spin"></div>
            </div>
          ) : categoryPlaylists.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {categoryPlaylists.map((playlist, index) => (
                <motion.div
                  key={playlist.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  whileHover={{ y: -5 }}
                >
                  <Link
                    href={`/playlist/${playlist.id}`}
                    className="block h-full bg-zinc-800/70 hover:bg-zinc-700/70 transition-all duration-300 rounded-xl overflow-hidden shadow-xl group"
                  >
                    <div className="aspect-square relative overflow-hidden">
                      {playlist.images && playlist.images.length > 0 ? (
                        <img 
                          src={playlist.images[0].url} 
                          alt={playlist.name} 
                          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-700 flex items-center justify-center transform group-hover:scale-105 transition-transform duration-500">
                          <span className="text-white text-5xl font-bold">{playlist.name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-white truncate">{playlist.name}</h3>
                      <p className="text-zinc-400 text-sm truncate">{playlist.owner.display_name}</p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 rounded-xl bg-zinc-800/30 backdrop-blur-sm">
              <p className="text-zinc-300">No hay playlists disponibles para esta categoría.</p>
            </div>
          )}
        </motion.section>
      )}
    </div>
  );
} 