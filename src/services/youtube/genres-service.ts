/**
 * Servicio para gestionar géneros musicales
 *
 * Proporciona una lista optimizada de los 10 géneros musicales más populares
 * basados en estadísticas actuales
 */

import { VALID_GENRES } from '@/lib/genres';

// Interfaz para items de género
export interface GenreItem {
  id: string;
  name: string;
  thumbnail: string;
  description?: string;
}

// Los 10 géneros musicales más populares según estadísticas actuales
export const TOP_GENRES: GenreItem[] = [
  { id: 'rock', name: 'Rock', thumbnail: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee' },
  { id: 'pop', name: 'Pop', thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819' },
  { id: 'hip-hop', name: 'Hip-Hop', thumbnail: 'https://images.unsplash.com/photo-1601643157091-ce5c665179ab' },
  { id: 'r-and-b', name: 'R&B', thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f' },
  { id: 'electronic', name: 'Electrónica', thumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745' },
  { id: 'latin', name: 'Latino', thumbnail: 'https://images.unsplash.com/photo-1535324492437-d8dea70a38a7' },
  { id: 'classical', name: 'Clásica', thumbnail: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76' },
  { id: 'jazz', name: 'Jazz', thumbnail: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629' },
  { id: 'country', name: 'Country', thumbnail: 'https://images.unsplash.com/photo-1581290723777-fd2c6fba9b44' },
  { id: 'blues', name: 'Blues', thumbnail: 'https://images.unsplash.com/photo-1601312378427-822b2b41da35' }
];

// Todos los géneros disponibles (solo contiene los 10 principales para optimizar rendimiento)
export const ALL_GENRES = TOP_GENRES;

/**
 * Obtiene todos los géneros principales
 */
export function getPriorityGenres(): GenreItem[] {
  return TOP_GENRES;
}

/**
 * Obtiene todos los géneros disponibles
 */
export function getAllGenres(): GenreItem[] {
  return ALL_GENRES;
}

/**
 * Obtiene un género por su ID
 */
export function getGenreById(genreId?: string): GenreItem | undefined {
  if (!genreId) return undefined;

  // Normalizar el ID del género para la búsqueda
  const normalizedSearchId = genreId.toLowerCase().replace(/[-_\s]/g, '');

  // Primero buscar coincidencia exacta
  const exactMatch = ALL_GENRES.find(genre => genre.id === genreId);
  if (exactMatch) return exactMatch;

  // Luego buscar coincidencia por ID normalizado
  for (const genre of ALL_GENRES) {
    const normalizedId = genre.id.toLowerCase().replace(/[-_\s]/g, '');
    if (normalizedId === normalizedSearchId) return genre;
  }

  // Finalmente buscar por coincidencia parcial
  for (const genre of ALL_GENRES) {
    const normalizedId = genre.id.toLowerCase().replace(/[-_\s]/g, '');
    if (normalizedId.includes(normalizedSearchId) || normalizedSearchId.includes(normalizedId)) {
      return genre;
    }
  }

  // Si nada coincide, devolver undefined
  return undefined;
}

/**
 * Verifica si un término es un género válido
 */
export function isValidGenre(term: string): boolean {
  const normalizedTerm = term.toLowerCase().trim();

  // Verificar en la lista de géneros válidos
  return VALID_GENRES.some(genre =>
    genre.toLowerCase() === normalizedTerm ||
    normalizedTerm.includes(genre.toLowerCase()) ||
    genre.toLowerCase().includes(normalizedTerm)
  );
}

export default {
  getPriorityGenres,
  getAllGenres,
  getGenreById,
  isValidGenre
};
