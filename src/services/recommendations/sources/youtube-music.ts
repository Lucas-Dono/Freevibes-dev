/**
 * Servicio de YouTube Music para recomendaciones
 */
import { Track, Artist, Playlist } from '@/types/types';
import { youtubeMusic } from '@/services/youtube/youtube-music';
import { recommendationsCache } from '@/lib/cache';
import { youtube, youtubeMusicAPI, YTMusicResult } from '@/services/youtube';

// Definición de RecommendedTrack como extensión de Track
interface RecommendedTrack extends Track {
  weight: number;
  sourceGenre?: string;
}

const CACHE_DURATION = 1000 * 60 * 60; // 1 hora
const genreRecommendationsCache: Record<string, { 
  timestamp: number; 
  data: {
    artists: Artist[];
    playlists: Playlist[];
    tracks: RecommendedTrack[];
  } 
}> = {};

/**
 * Obtiene recomendaciones de canciones por género
 * @param genre Género musical
 * @param limit Número máximo de resultados
 * @returns Lista de canciones recomendadas
 */
export async function getRecommendationsByGenre(genre: string, limit: number = 20): Promise<Track[]> {
  try {
    console.log(`[YouTube Music] Obteniendo recomendaciones para género: ${genre}`);
    
    // Intentar obtener de caché primero
    const cacheKey = `youtube_music:genre:${genre}:${limit}`;
    const cachedData = await recommendationsCache.get(cacheKey);
    
    if (cachedData) {
      console.log(`[YouTube Music] Cache hit para género: ${genre}`);
      return JSON.parse(cachedData);
    }
    
    // Usar el servicio de YouTube Music para buscar recomendaciones por género
    const tracks = await youtubeMusic.getRecommendationsByGenre(genre, limit);
    
    // Guardar en caché para futuras solicitudes
    if (tracks.length > 0) {
      await recommendationsCache.set(cacheKey, JSON.stringify(tracks), 60 * 60 * 12); // 12 horas
    }
    
    return tracks;
  } catch (error) {
    console.error(`[YouTube Music] Error en getRecommendationsByGenre para ${genre}:`, error);
    return getFallbackTracks(genre, limit);
  }
}

/**
 * Busca canciones en YouTube Music
 * @param query Consulta de búsqueda
 * @param limit Número máximo de resultados
 * @returns Lista de canciones encontradas
 */
export async function searchTracks(query: string, limit: number = 20): Promise<Track[]> {
  try {
    console.log(`[YouTube Music] Buscando canciones para: ${query}`);
    
    // Usar el servicio de YouTube Music para buscar canciones
    const ytMusicResults = await youtubeMusic.searchSongs(query, limit);
    return youtubeMusic.toTracks(ytMusicResults);
  } catch (error) {
    console.error(`[YouTube Music] Error en searchTracks para ${query}:`, error);
    return [];
  }
}

/**
 * Obtiene canciones similares a una canción dada
 * @param trackName Nombre de la canción
 * @param artistName Nombre del artista
 * @param limit Número máximo de resultados
 * @returns Lista de canciones similares
 */
export async function getSimilarTracks(trackName: string, artistName: string, limit: number = 20): Promise<Track[]> {
  try {
    console.log(`[YouTube Music] Buscando canciones similares a: ${trackName} - ${artistName}`);
    
    // Usar el servicio de YouTube Music para buscar canciones similares
    return await youtubeMusic.getSimilarSongs(trackName, artistName, limit);
  } catch (error) {
    console.error(`[YouTube Music] Error en getSimilarTracks para ${trackName}:`, error);
    return [];
  }
}

/**
 * Obtiene tracks fallback cuando otras opciones fallan
 * @param genre Género musical
 * @param limit Número de canciones a generar
 * @returns Lista de canciones fallback
 */
function getFallbackTracks(genre: string, limit: number): Track[] {
  console.log(`[YouTube Music] Generando tracks fallback para: ${genre}`);
  
  const fallbackTracks: Track[] = [];
  
  // URLs de carátulas reales categorizadas por género
  const coverUrlsByGenre: {[key: string]: string[]} = {
    'rock': [
      'https://i.scdn.co/image/ab67616d0000b273e8107e6d9214baa81bb79bba',
      'https://i.scdn.co/image/ab67616d0000b273d86a1e021e7acc7c07c7d186',
      'https://i.scdn.co/image/ab67616d0000b273a0e738c561629266418fd810'
    ],
    'pop': [
      'https://i.scdn.co/image/ab67616d0000b2737b9e5a9d697bcb8bf86a83b4',
      'https://i.scdn.co/image/ab67616d0000b273450a500a9eef89fbac8a85ff',
      'https://i.scdn.co/image/ab67616d0000b273f9835b67fb41aee7f9c2d40c'
    ],
    'hip-hop': [
      'https://i.scdn.co/image/ab67616d0000b273814456ecfe8f73373a8b147c',
      'https://i.scdn.co/image/ab67616d0000b2735b46697eb409397d8cb90dcf',
      'https://i.scdn.co/image/ab67616d0000b273ea3ef7697cfd5705b8f47521'
    ],
    'electronic': [
      'https://i.scdn.co/image/ab67616d0000b2731f4752e83c0cf31fb4e10a12',
      'https://i.scdn.co/image/ab67616d0000b2735b1d4ca06ea2f3f14489deed',
      'https://i.scdn.co/image/ab67616d0000b273978c68c28905d2262b026af4'
    ],
    'jazz': [
      'https://i.scdn.co/image/ab67616d0000b273419950fdf75f95ae50936b0a',
      'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36',
      'https://i.scdn.co/image/ab67616d0000b2737929b5d3881e09a328d58373'
    ],
    'default': [
      'https://i.scdn.co/image/ab67616d0000b273abeb4c6c08489e6676994caf',
      'https://i.scdn.co/image/ab67616d0000b2731e4f95f5cbe425d3867e5672',
      'https://i.scdn.co/image/ab67616d0000b273533fd0b248052d04e6b732c0'
    ]
  };
  
  // Nombres de artistas por género
  const artistsByGenre: {[key: string]: string[]} = {
    'rock': ['Rock Legends', 'Guitar Heroes', 'The Amplifiers'],
    'pop': ['Pop Stars', 'Chart Toppers', 'Melody Makers'],
    'hip-hop': ['Flow Masters', 'Beat Collective', 'Rhyme Kings'],
    'electronic': ['Digital DJs', 'Synth Wave', 'EDM Collective'],
    'jazz': ['Jazz Ensemble', 'Smooth Quartet', 'Blue Note'],
    'default': ['YouTube Artists', 'Music Channel', 'Sound Collection']
  };
  
  // Elegir artistas y covers para el género actual
  const genreArtists = artistsByGenre[genre.toLowerCase()] || artistsByGenre['default'];
  const genreCovers = coverUrlsByGenre[genre.toLowerCase()] || coverUrlsByGenre['default'];
  
  // Crear tracks fallback
  for (let i = 0; i < Math.min(limit, 10); i++) {
    const artistIndex = i % genreArtists.length;
    const coverIndex = i % genreCovers.length;
    
    fallbackTracks.push({
      id: `youtube_music_fallback_${genre}_${i}`,
      title: `${genre.charAt(0).toUpperCase() + genre.slice(1)} Track ${i + 1}`,
      artist: genreArtists[artistIndex],
      album: `YouTube Music ${genre.charAt(0).toUpperCase() + genre.slice(1)}`,
      cover: genreCovers[coverIndex],
      duration: 180000 + (i * 30000), // Entre 3 y 8 minutos
      source: 'youtube',
      youtubeId: undefined
    });
  }
  
  return fallbackTracks;
}

export async function getRecommendationsByUserGenres(
  genres: string[], 
  options: { 
    limit?: number;
    artistsPerGenre?: number;
    playlistsPerGenre?: number;
    tracksPerGenre?: number;
  } = {}
): Promise<{
  artists: Artist[];
  playlists: Playlist[];
  tracks: RecommendedTrack[];
}> {
  const { 
    limit = 30, 
    artistsPerGenre = 20,
    playlistsPerGenre = 10,
    tracksPerGenre = 30
  } = options;
  
  if (!genres || genres.length === 0) {
    console.warn('No se proporcionaron géneros para obtener recomendaciones');
    return { artists: [], playlists: [], tracks: [] };
  }
  
  // Usar solo los 3 principales géneros
  const topGenres = genres.slice(0, 3);
  const cacheKey = `user_genres_${topGenres.join('_')}_${artistsPerGenre}_${playlistsPerGenre}_${tracksPerGenre}`;
  
  // Verificar caché
  const cached = genreRecommendationsCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.info(`Usando recomendaciones en caché para géneros: ${topGenres.join(', ')}`);
    return cached.data;
  }
  
  try {
    // Llamar a la API de YouTube Music para obtener recomendaciones por géneros
    const ytMusicResponse = await youtubeMusicAPI.getRecommendationsByGenres(
      topGenres,
      { artistsPerGenre, playlistsPerGenre, tracksPerGenre }
    );
    
    // Convertir los tracks de YouTube Music a RecommendedTrack
    const recommendedTracks: RecommendedTrack[] = ytMusicResponse.tracks
      .filter((track: YTMusicResult) => track.thumbnails && track.thumbnails.length > 0)
      .map((track: YTMusicResult) => ({
        id: track.videoId,
        title: track.title,
        artist: track.artist,
        album: track.album || '',
        cover: track.thumbnails[track.thumbnails.length - 1].url,
        duration: track.duration || 0,
        source: 'youtube',
        youtubeId: track.videoId,
        weight: 1,
        sourceGenre: (track as any).sourceGenre
      }));
    
    // Limitar el número de tracks si es necesario
    const limitedTracks = recommendedTracks.slice(0, limit);
    
    // Guardar en caché
    const result = {
      artists: ytMusicResponse.artists,
      playlists: ytMusicResponse.playlists,
      tracks: limitedTracks
    };
    
    genreRecommendationsCache[cacheKey] = {
      timestamp: Date.now(),
      data: result
    };
    
    console.info(`Obtenidas ${result.tracks.length} canciones, ${result.artists.length} artistas y ${result.playlists.length} playlists de YouTube Music por géneros`);
    return result;
  } catch (error) {
    console.error('Error obteniendo recomendaciones por géneros de usuario:', error);
    return { artists: [], playlists: [], tracks: [] };
  }
} 