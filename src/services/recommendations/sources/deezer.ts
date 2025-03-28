/**
 * Servicio de recomendaciones de Deezer
 * Proporciona funciones para obtener recomendaciones musicales de Deezer
 */

import { Track } from '@/types/types';

// Configuración de endpoints
const PROXY_URL = '/api/proxy/deezer';
// Tiempo de espera para solicitudes a Deezer (5 segundos)
const TIMEOUT = 5000;

/**
 * Obtiene recomendaciones de canciones por género
 * @param genre Género musical
 * @param limit Número máximo de resultados
 * @returns Lista de canciones recomendadas
 */
export async function getRecommendationsByGenre(genre: string, limit: number = 25): Promise<Track[]> {
  try {
    console.log(`[Deezer] Obteniendo recomendaciones para género: ${genre}`);
    
    // Deezer permite buscar canciones por género usando el endpoint de búsqueda
    const searchEndpoint = `${PROXY_URL}?endpoint=search&q=${encodeURIComponent(genre)}&limit=${limit}`;
    
    // Utilizamos un tiempo límite para que la solicitud no quede colgada
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
    
    const response = await fetch(searchEndpoint, { 
      signal: controller.signal,
      cache: 'no-store'
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Si no hay resultados, intentar con pistas relacionadas
    if (!data.data || data.data.length === 0) {
      console.log(`[Deezer] Sin resultados para género ${genre}, probando con tracks relacionados`);
      return await getRelatedTracks(genre, limit);
    }
    
    return convertDeezerTracks(data.data);
  } catch (error) {
    console.error(`[Deezer] Error en getRecommendationsByGenre:`, error);
    
    // En caso de error, intentar un método alternativo
    return await getRelatedTracks(genre, limit);
  }
}

/**
 * Método alternativo: buscar canciones relacionadas a un artista popular del género
 * @param genre Género musical
 * @param limit Número máximo de resultados
 * @returns Lista de canciones relacionadas
 */
async function getRelatedTracks(genre: string, limit: number): Promise<Track[]> {
  try {
    console.log(`[Deezer] Buscando artistas para el género: ${genre}`);
    
    // Primero buscar artistas del género
    const artistSearchEndpoint = `${PROXY_URL}?endpoint=search/artist&q=${encodeURIComponent(genre)}&limit=5`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
    
    const response = await fetch(artistSearchEndpoint, { 
      signal: controller.signal 
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Error obteniendo artistas: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Si no hay artistas, devolver fallback
    if (!data.data || data.data.length === 0) {
      console.log(`[Deezer] Sin artistas para el género ${genre}, retornando fallback`);
      return getFallbackTracks(genre, limit);
    }
    
    // Buscar tracks del primer artista
    const artist = data.data[0];
    console.log(`[Deezer] Obteniendo tracks para artista: ${artist.name}`);
    
    const tracksEndpoint = `${PROXY_URL}?endpoint=artist/${artist.id}/top&limit=${limit}`;
    
    const tracksController = new AbortController();
    const tracksTimeoutId = setTimeout(() => tracksController.abort(), TIMEOUT);
    
    const tracksResponse = await fetch(tracksEndpoint, { 
      signal: tracksController.signal 
    });
    
    clearTimeout(tracksTimeoutId);
    
    if (!tracksResponse.ok) {
      throw new Error(`Error obteniendo tracks: ${tracksResponse.status}`);
    }
    
    const tracksData = await tracksResponse.json();
    
    if (!tracksData.data || tracksData.data.length === 0) {
      console.log(`[Deezer] Sin tracks para el artista ${artist.name}, retornando fallback`);
      return getFallbackTracks(genre, limit);
    }
    
    return convertDeezerTracks(tracksData.data);
  } catch (error) {
    console.error(`[Deezer] Error en getRelatedTracks:`, error);
    return getFallbackTracks(genre, limit);
  }
}

/**
 * Convierte tracks de Deezer al formato Track de la aplicación
 * @param tracks Tracks de Deezer
 * @returns Tracks en formato de la aplicación
 */
function convertDeezerTracks(tracks: any[]): Track[] {
  return tracks.map(track => ({
    id: `deezer-${track.id}`,
    title: track.title || 'Sin título',
    artist: track.artist?.name || 'Desconocido',
    artistId: track.artist?.id ? `deezer-artist-${track.artist.id}` : undefined,
    album: track.album?.title || 'Álbum desconocido',
    albumId: track.album?.id ? `deezer-album-${track.album.id}` : undefined,
    albumCover: track.album?.cover_big || track.album?.cover || '/images/default-album.png',
    cover: track.album?.cover_big || track.album?.cover || '/images/default-album.png',
    duration: track.duration * 1000 || 0, // Convertir a ms
    spotifyId: undefined,
    youtubeId: undefined
  }));
}

/**
 * Obtiene términos relacionados con un género
 * @param genre Género musical
 * @returns Lista de términos relacionados
 */
function getRelatedTerms(genre: string): string[] {
  // Mapa de géneros relacionados
  const genreMap: Record<string, string[]> = {
    'rock': ['rock', 'classic rock', 'indie rock', 'alternative rock', 'hard rock'],
    'pop': ['pop', 'pop music', 'pop hits', 'pop songs', 'contemporary'],
    'hip-hop': ['hip hop', 'rap', 'urban', 'trap'],
    'electronic': ['electronic', 'edm', 'house', 'techno', 'dance'],
    'jazz': ['jazz', 'swing', 'bebop', 'smooth jazz'],
    'classical': ['classical', 'orchestra', 'symphony', 'piano'],
    'country': ['country', 'country music', 'americana', 'nashville'],
    'r&b': ['r&b', 'soul', 'rhythm and blues', 'rnb'],
    'latin': ['latin', 'reggaeton', 'salsa', 'bachata', 'latin pop'],
    'metal': ['metal', 'heavy metal', 'thrash metal', 'death metal', 'metalcore'],
    'folk': ['folk', 'folk music', 'acoustic', 'singer-songwriter'],
    'reggae': ['reggae', 'ska', 'dub', 'dancehall'],
    'blues': ['blues', 'delta blues', 'blues rock', 'chicago blues'],
    'punk': ['punk', 'punk rock', 'hardcore', 'pop punk'],
    'funk': ['funk', 'disco', 'soul'],
    'indie': ['indie', 'indie pop', 'indie folk', 'alternative'],
    'alternative': ['alternative', 'alt rock', 'alternative music', 'indie']
  };
  
  // Normalizar el género (minúsculas y sin espacios al principio/final)
  const normalizedGenre = genre.toLowerCase().trim();
  
  // Buscar el género exacto o uno similar
  for (const [key, terms] of Object.entries(genreMap)) {
    if (key === normalizedGenre || key.includes(normalizedGenre) || normalizedGenre.includes(key)) {
      return [genre, ...terms]; // Primero el género original, luego los relacionados
    }
  }
  
  // Si no se encuentra un género relacionado, devolver algunos términos genéricos junto con el original
  return [
    genre,
    `${genre} music`,
    `best ${genre}`,
    `popular ${genre}`,
    'music',
    'popular'
  ];
}

/**
 * Obtiene tracks fallback cuando todas las otras opciones fallan
 * @param genre Género musical
 * @param limit Número máximo de resultados
 * @returns Tracks fallback
 */
function getFallbackTracks(genre: string, limit: number): Track[] {
  console.log(`[Deezer] Generando tracks fallback para género: ${genre}`);
  
  const fallbackTracks: Track[] = [];
  
  // Crear tracks fallback según el género
  for (let i = 0; i < Math.min(limit, 10); i++) {
    fallbackTracks.push({
      id: `deezer_fallback_${genre}_${i}`,
      title: `Canción ${i + 1} (${genre})`,
      artist: 'Artista no disponible',
      album: 'Álbum no disponible',
      albumCover: `https://placehold.co/300x300/blue/white?text=${encodeURIComponent(genre)}`,
      cover: `https://placehold.co/300x300/blue/white?text=${encodeURIComponent(genre)}`,
      duration: 180000 + (i * 30000), // Duración ficticia entre 3 y 6 minutos
      spotifyId: undefined,
      youtubeId: undefined
    });
  }
  
  return fallbackTracks;
} 