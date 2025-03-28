/**
 * Sistema de recomendaciones de música
 * 
 * Este módulo exporta todas las funciones para obtener recomendaciones musicales
 * desde el sistema multi-fuente, simplificando el acceso desde otras partes de la aplicación.
 */

// Importaciones necesarias
import { hybridRecommender } from './hybrid-recommender';

// Recomendaciones basadas en género
export {
  getRecommendationsByGenre,
  getAvailableGenres
} from './multi-source-recommender';

// Recomendador híbrido Spotify + YouTube Music
export { hybridRecommender };

/**
 * Obtiene recomendaciones usando el sistema híbrido
 * @param genre Género musical
 * @param limit Límite de resultados
 * @returns Lista de pistas musicales recomendadas
 */
export async function getHybridRecommendations(genre: string, limit: number = 50) {
  return hybridRecommender.getRecommendationsByGenre(genre, limit);
}

// Exportar VALID_GENRES desde la nueva ubicación
export { VALID_GENRES } from '@/lib/genres';

// Recomendaciones generales y tendencias
export {
  getGeneralRecommendations,
  getTrendingTracks
} from './general';

// Recomendaciones por artista
export {
  getArtistTopTracks,
  getSimilarArtistTracks
} from './artist';

// Recomendaciones por pista
export {
  getSimilarTracks
} from './track';

// Búsqueda multi-fuente
export {
  searchMultiSource
} from './search';

// Exportar funciones de las fuentes individuales para uso directo si es necesario
import * as spotifyRecommender from './sources/spotify';
import * as deezerRecommender from './sources/deezer';
import * as lastfmRecommender from './sources/lastfm';

export const sources = {
  spotify: spotifyRecommender,
  deezer: deezerRecommender,
  lastfm: lastfmRecommender
};

// Tipos de opciones para las recomendaciones
export interface RecommendationOptions {
  forceFresh?: boolean;        // Si es true, ignorar caché
  preferredSource?: string;    // Fuente preferida ('spotify', 'deezer', 'lastfm')
  combineResults?: boolean;    // Si es true, combinar resultados de múltiples fuentes
  minResults?: number;         // Número mínimo de resultados requeridos
} 