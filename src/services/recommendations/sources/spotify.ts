/**
 * Servicio de recomendaciones de Spotify
 * Proporciona funciones para obtener recomendaciones musicales de Spotify
 */

import { Track } from '@/types/types';

/**
 * Obtiene la URL base de la API
 * @returns URL base de la API
 */
function getApiBaseUrl() {
  // Usar la variable de entorno definida en el archivo .env de la raíz
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return `${process.env.NEXT_PUBLIC_APP_URL}/api`;
  }
  
  // Si no está definida la variable de entorno, usar el puerto actual del navegador
  if (typeof window !== 'undefined' && window.location) {
    // Obtener el puerto actual del navegador
    const currentPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
    // Construir la URL base con el puerto actual
    return `${window.location.protocol}//${window.location.hostname}:${currentPort}/api`;
  }
  
  // Valor por defecto
  return '/api';
}

/**
 * Obtiene recomendaciones de canciones por género
 * @param genre Género musical
 * @param limit Número máximo de resultados
 * @returns Lista de canciones recomendadas
 */
export async function getRecommendationsByGenre(genre: string, limit: number = 30): Promise<Track[]> {
  try {
    console.log(`[Spotify] Obteniendo recomendaciones para género: ${genre}`);
    
    // Usamos el endpoint de genre-recommendations que implementaremos en la API
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(
      `${apiBaseUrl}/spotify?action=genre-recommendations&genre=${encodeURIComponent(genre)}&limit=${limit}`,
      { cache: 'no-store' }
    );
    
    if (!response.ok) {
      console.error(`[Spotify] Error al obtener recomendaciones (${response.status}): ${response.statusText}`);
      
      if (response.status === 401) {
        const errorData = await response.json();
        if (errorData.redirect) {
          console.log(`[Spotify] Redirigiendo para autenticación: ${errorData.redirect}`);
          if (typeof window !== 'undefined') {
            window.location.href = errorData.redirect;
          }
        }
        return [];
      }
      
      // Si el error es 400 Bad Request o 404 Not Found, intentaremos con búsqueda alternativa
      if (response.status === 400 || response.status === 404) {
        console.log(`[Spotify] Intentando búsqueda alternativa para género: ${genre}`);
        return await searchTracksByGenre(genre, limit);
      }
      
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const tracks = data.tracks || [];
    
    if (!tracks.length) {
      console.log(`[Spotify] Sin resultados para género ${genre}, probando búsqueda alternativa`);
      return await searchTracksByGenre(genre, limit);
    }
    
    return tracks;
  } catch (error) {
    console.error(`[Spotify] Error en getRecommendationsByGenre:`, error);
    
    // En caso de error, intentar el método alternativo
    return await searchTracksByGenre(genre, limit);
  }
}

/**
 * Método alternativo: buscar canciones por género
 * @param genre Género musical
 * @param limit Número máximo de resultados
 * @returns Lista de canciones encontradas
 */
async function searchTracksByGenre(genre: string, limit: number): Promise<Track[]> {
  try {
    console.log(`[Spotify] Buscando canciones para género: ${genre}`);
    
    // Intentaremos primero una búsqueda específica con genre:
    const apiBaseUrl = getApiBaseUrl();
    const searchQuery = `genre:${genre}`;
    
    const response = await fetch(
      `${apiBaseUrl}/spotify?action=search&q=${encodeURIComponent(searchQuery)}&type=track&limit=${limit}`,
      { cache: 'no-store' }
    );
    
    if (!response.ok) {
      console.error(`[Spotify] Error en searchTracksByGenre específico (${response.status}): ${response.statusText}`);
      
      // Si falla la búsqueda específica, intentar búsqueda general
      const broadResponse = await fetch(
        `${apiBaseUrl}/spotify?action=search&q=${encodeURIComponent(genre)}&type=track&limit=${limit}`,
        { cache: 'no-store' }
      );
      
      if (!broadResponse.ok) {
        console.error(`[Spotify] Error en searchTracksByGenre general (${broadResponse.status}): ${broadResponse.statusText}`);
        return getFallbackTracks(genre, limit);
      }
      
      const broadData = await broadResponse.json();
      const tracks = broadData.tracks?.items || [];
      
      if (!tracks.length) {
        console.log(`[Spotify] Sin resultados para búsqueda general de ${genre}, usando fallback`);
        return getFallbackTracks(genre, limit);
      }
      
      return convertSpotifyTracks(tracks);
    }
    
    const data = await response.json();
    const tracks = data.tracks?.items || [];
    
    if (!tracks.length) {
      console.log(`[Spotify] Sin resultados para búsqueda específica de ${genre}, intentando búsqueda general`);
      return await searchTracksByGenre(genre, limit);
    }
    
    return convertSpotifyTracks(tracks);
  } catch (error) {
    console.error(`[Spotify] Error en searchTracksByGenre:`, error);
    return getFallbackTracks(genre, limit);
  }
}

/**
 * Convierte tracks de Spotify al formato Track de la aplicación
 * @param tracks Tracks de Spotify
 * @returns Tracks en formato de la aplicación
 */
function convertSpotifyTracks(tracks: any[]): Track[] {
  // Filtrar tracks que no tengan imágenes
  return tracks
    .filter(track => track.album?.images && track.album.images.length > 0)
    .map(track => ({
      id: track.id,
      title: track.name,
      artist: track.artists?.map((a: any) => a.name).join(', ') || 'Desconocido',
      artistId: track.artists?.[0]?.id,
      album: track.album?.name || 'Álbum desconocido',
      albumId: track.album?.id,
      albumCover: track.album.images[0].url,
      cover: track.album.images[0].url,
      duration: track.duration_ms || 0,
      spotifyId: track.id,
      youtubeId: undefined
    }));
}

/**
 * Obtiene tracks fallback cuando todas las otras opciones fallan
 * @param genre Género musical
 * @param limit Número máximo de resultados
 * @returns Tracks fallback
 */
function getFallbackTracks(genre: string, limit: number): Track[] {
  console.log(`[Spotify] Generando tracks fallback para género: ${genre}`);
  
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
  
  // Seleccionar las carátulas para el género actual
  const genreCovers = coverUrlsByGenre[genre.toLowerCase()] || coverUrlsByGenre['default'];
  
  // Crear tracks fallback según el género
  for (let i = 0; i < Math.min(limit, 10); i++) {
    const coverIndex = i % genreCovers.length;
    
    fallbackTracks.push({
      id: `fallback_${genre}_${i}`,
      title: `Canción ${i + 1} (${genre})`,
      artist: 'Artista no disponible',
      album: 'Álbum no disponible',
      albumCover: genreCovers[coverIndex],
      cover: genreCovers[coverIndex],
      duration: 180000 + (i * 30000), // Duración ficticia entre 3 y 6 minutos
      spotifyId: undefined,
      youtubeId: undefined
    });
  }
  
  return fallbackTracks;
}

/**
 * Busca tracks en Spotify
 * @param query Consulta de búsqueda
 * @param limit Número máximo de resultados
 * @returns Lista de tracks
 */
export async function searchTracks(query: string, limit: number = 20): Promise<Track[]> {
  try {
    console.log(`[Spotify Source] Buscando canciones para: ${query}`);
    
    // Importar el servicio principal de Spotify
    const spotifyService = await import('@/services/spotify');
    
    // Obtener los resultados usando el servicio existente
    const spotifyResults = await spotifyService.searchTracks(query, limit * 2);
    
    // Filtrar y convertir los resultados al formato Track de la aplicación
    const tracks = spotifyResults
      .filter((item: any) => 
        item.album?.images?.[0]?.url && 
        !item.album.images[0].url.includes('placehold') &&
        !item.album.images[0].url.includes('lastfm')
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
      }))
      .slice(0, limit);
    
    return tracks;
  } catch (error) {
    console.error(`[Spotify Source] Error en searchTracks:`, error);
    return [];
  }
} 