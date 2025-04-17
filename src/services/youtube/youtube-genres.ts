/**
 * Servicio para manejar géneros y charts de YouTube Music
 */

import { youtubeMusicAPI } from './youtube-music-api';
import { genreCache } from '@/lib/cache';
import { getCountryCode } from '@/lib/utils';

// Tiempo de caché: 24 horas
const CACHE_TTL = 24 * 60 * 60; 

/**
 * Obtiene categorías de estado de ánimo disponibles en YouTube Music
 */
export async function getMoodCategories() {
  try {
    // Intentar obtener de caché primero
    const cacheKey = 'ytmusic:mood-categories';
    const cached = await genreCache.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Obtener de la API si no está en caché
    const categories = await youtubeMusicAPI.getMoodCategories();
    
    // Guardar en caché
    if (categories) {
      await genreCache.set(cacheKey, JSON.stringify(categories), CACHE_TTL);
    }
    
    return categories;
  } catch (error) {
    console.error('[YouTubeGenres] Error obteniendo categorías de mood:', error);
    throw error;
  }
}

/**
 * Obtiene playlists para una categoría de estado de ánimo específica
 */
export async function getMoodPlaylists(params: string) {
  try {
    // Intentar obtener de caché primero
    const cacheKey = `ytmusic:mood-playlists:${params}`;
    const cached = await genreCache.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Obtener de la API si no está en caché
    const playlists = await youtubeMusicAPI.getMoodPlaylists(params);
    
    // Guardar en caché
    if (playlists) {
      await genreCache.set(cacheKey, JSON.stringify(playlists), CACHE_TTL);
    }
    
    return playlists;
  } catch (error) {
    console.error('[YouTubeGenres] Error obteniendo playlists de mood:', error);
    throw error;
  }
}

/**
 * Obtiene charts (listas de éxitos) de YouTube Music
 */
export async function getCharts(country?: string) {
  try {
    const countryCode = country || getCountryCode();
    
    // Intentar obtener de caché primero
    const cacheKey = `ytmusic:charts:${countryCode}`;
    const cached = await genreCache.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Obtener de la API si no está en caché
    const charts = await youtubeMusicAPI.getCharts(countryCode);
    
    // Guardar en caché
    if (charts) {
      await genreCache.set(cacheKey, JSON.stringify(charts), CACHE_TTL);
    }
    
    return charts;
  } catch (error) {
    console.error('[YouTubeGenres] Error obteniendo charts:', error);
    throw error;
  }
}

/**
 * Obtiene géneros disponibles para usar en la interfaz de usuario
 */
export async function getAvailableGenres(): Promise<string[]> {
  try {
    // Intentar obtener de caché primero
    const cacheKey = 'ytmusic:available-genres';
    const cached = await genreCache.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Obtener géneros a partir de las categorías de mood y charts
    const genres: string[] = [];
    
    // 1. Intentar obtener géneros de categorías de mood
    try {
      const moodCategories = await getMoodCategories();
      
      if (moodCategories) {
        // Extraer nombres de categorías como géneros
        Object.keys(moodCategories).forEach(category => {
          if (!genres.includes(category)) {
            genres.push(category);
          }
          
          // También agregar títulos de subcategorías si son diferentes
          moodCategories[category].forEach((item: any) => {
            const title = item.title?.toLowerCase() || '';
            if (title && !genres.includes(title)) {
              genres.push(title);
            }
          });
        });
      }
    } catch (e) {
      console.warn('[YouTubeGenres] Error obteniendo géneros de categorías de mood:', e);
    }
    
    // 2. Intentar obtener géneros de charts
    try {
      const charts = await getCharts();
      
      if (charts && charts.genres) {
        charts.genres.forEach((genre: any) => {
          const genreName = genre.title?.toLowerCase() || '';
          if (genreName && !genres.includes(genreName)) {
            genres.push(genreName);
          }
        });
      }
    } catch (e) {
      console.warn('[YouTubeGenres] Error obteniendo géneros de charts:', e);
    }
    
    // 3. Si no hemos obtenido suficientes géneros, usar una lista predefinida
    if (genres.length < 10) {
      const fallbackGenres = [
        'pop', 'rock', 'hip-hop', 'rap', 'latin', 'r&b', 'jazz', 
        'electronic', 'dance', 'indie', 'classical', 'metal', 'folk', 'country'
      ];
      
      fallbackGenres.forEach(genre => {
        if (!genres.includes(genre)) {
          genres.push(genre);
        }
      });
    }
    
    // Guardar en caché
    await genreCache.set(cacheKey, JSON.stringify(genres), CACHE_TTL);
    
    return genres;
  } catch (error) {
    console.error('[YouTubeGenres] Error obteniendo géneros disponibles:', error);
    
    // Devolver géneros fallback en caso de error
    return [
      'pop', 'rock', 'hip-hop', 'rap', 'latin', 'r&b', 'jazz', 
      'electronic', 'dance', 'indie', 'classical', 'metal', 'folk', 'country'
    ];
  }
}

export default {
  getMoodCategories,
  getMoodPlaylists,
  getCharts,
  getAvailableGenres
}; 