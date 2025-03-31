/**
 * Index de servicios de recomendaciones
 * 
 * Este archivo exporta las funciones de recomendación de diferentes fuentes,
 * facilitando su uso por otros componentes de la aplicación.
 */

// Importaciones necesarias
import { hybridRecommender } from './hybrid-recommender';
import { getRecommendationsByGenre, getAvailableGenres } from './multi-source-recommender';
import { getSimilarArtistTracks, getArtistTopTracks } from './artist';
import { getSimilarTracks } from './track';
import { getGeneralRecommendations as _getGeneralRecommendations, getTrendingTracks } from './general';
import { searchMultiSource } from './search';
import { Track } from '@/types/types';

// Búsqueda multifuente
export { searchMultiSource } from './search';

// Recomendador híbrido para interfaz unificada
export { hybridRecommender };

// Número único basado en la hora actual
// Esto ayuda a evitar que siempre se obtengan las mismas recomendaciones
const getTimeBasedSeed = () => {
  const now = new Date();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const hours = now.getHours();
  // Usar la hora del día para variar las recomendaciones
  return (hours * 60 + minutes + seconds) % 25;
};

// Función de shuffle personalizada con semilla temporal
const shuffleWithSeed = (array: Track[]): Track[] => {
  const seed = getTimeBasedSeed();
  const shuffled = [...array];
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Usar la semilla para añadir variabilidad al algoritmo de mezcla
    const j = Math.floor(((i + 1) * (seed + 1) / 31) % (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
};

// Envoltura para variar los resultados de getGeneralRecommendations
const getGeneralRecommendations = async (limit: number = 20, options = {}) => {
  const extraLimit = Math.floor(limit * 1.5); // Solicitar más canciones para poder diversificar
  const tracks = await _getGeneralRecommendations(extraLimit, {...options, forceFresh: true});
  
  // Mezclar los resultados usando nuestra función con semilla temporal
  const shuffled = shuffleWithSeed(tracks);
  
  // Tomar solo la cantidad solicitada
  const result = shuffled.slice(0, limit);
  
  console.log(`[Recomendaciones] Generando recomendaciones más variadas (semilla: ${getTimeBasedSeed()})`);
  return result;
};

// Exportar todas las funciones principales de recomendación
export {
  getRecommendationsByGenre,
  getAvailableGenres,
  getSimilarArtistTracks,
  getArtistTopTracks,
  getSimilarTracks,
  getGeneralRecommendations,
  getTrendingTracks
};

// Definir tipos comunes para opciones de recomendación
export interface RecommendationOptions {
  limit?: number;             // Número máximo de resultados
  offset?: number;            // Desplazamiento para paginación
  forceFresh?: boolean;       // Si es true, ignorar caché
  preferredSource?: string;   // Fuente preferida (spotify, lastfm, deezer, etc)
  combineResults?: boolean;   // Si es true, combinar resultados de múltiples fuentes
  minResults?: number;        // Número mínimo de resultados requeridos
}

// Exportar VALID_GENRES desde la nueva ubicación
export { VALID_GENRES } from '@/lib/genres';

// Exportar funciones de las fuentes individuales para uso directo si es necesario
import * as spotifyRecommender from './sources/spotify';
import * as deezerRecommender from './sources/deezer';
import * as lastfmRecommender from './sources/lastfm';

export const sources = {
  spotify: spotifyRecommender,
  deezer: deezerRecommender,
  lastfm: lastfmRecommender
}; 