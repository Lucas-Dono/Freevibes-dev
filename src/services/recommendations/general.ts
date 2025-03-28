/**
 * Servicio de recomendaciones generales
 * 
 * Este módulo proporciona funciones para obtener recomendaciones musicales generales,
 * que no están basadas en un género específico, utilizando el sistema multi-fuente.
 */

import { Track } from '@/types/types';
import { getRecommendationsByGenre } from './multi-source-recommender';
import { recommendationsCache, DEFAULT_CACHE_TTL } from '@/lib/cache';
import { SourceType } from '@/lib/source-manager';

/**
 * Obtiene recomendaciones de canciones generales
 * Usa una combinación de géneros populares para obtener recomendaciones variadas
 * 
 * @param limit Número máximo de resultados
 * @param options Opciones adicionales para la búsqueda
 * @returns Lista de canciones recomendadas
 */
export async function getGeneralRecommendations(
  limit: number = 30, 
  options: {
    forceFresh?: boolean;
    preferredSource?: SourceType;
    combineResults?: boolean;
  } = {}
): Promise<Track[]> {
  try {
    console.log(`[General] Obteniendo recomendaciones generales (limit=${limit})`);
    
    // Intentar obtener de caché primero si no se fuerza refresco
    if (!options.forceFresh) {
      const cacheKey = `general_recommendations:${limit}:${options.preferredSource || 'default'}`;
      const cachedData = await recommendationsCache.get(cacheKey);
      
      if (cachedData) {
        console.log(`[General] Cache hit para recomendaciones generales`);
        return JSON.parse(cachedData);
      }
    }
    
    // Lista de géneros populares para mezclar
    const popularGenres = ['pop', 'rock', 'hip-hop', 'electronic', 'latin'];
    
    // Obtener ~limit/4 tracks de cada género
    const tracksPerGenre = Math.ceil(limit / 3);
    const promises = popularGenres.slice(0, 3).map(genre => 
      getRecommendationsByGenre(genre, tracksPerGenre, { 
        forceFresh: options.forceFresh, 
        preferredSource: options.preferredSource,
        combineResults: options.combineResults || true 
      })
    );
    
    // Ejecutar todas las promesas en paralelo
    const results = await Promise.all(promises);
    
    // Combinar y mezclar resultados
    let allTracks: Track[] = [];
    results.forEach(genreTracks => {
      if (genreTracks && genreTracks.length > 0) {
        allTracks = [...allTracks, ...genreTracks];
      }
    });
    
    // Deduplicar por ID
    const uniqueTracks = Array.from(
      new Map(allTracks.map(track => [track.id, track])).values()
    );
    
    // Mezclar aleatoriamente
    const shuffledTracks = uniqueTracks.sort(() => 0.5 - Math.random());
    
    // Limitar al número solicitado
    const finalTracks = shuffledTracks.slice(0, limit);
    
    // Guardar en caché para futuras solicitudes
    if (finalTracks.length > 0) {
      const cacheKey = `general_recommendations:${limit}:${options.preferredSource || 'default'}`;
      await recommendationsCache.set(
        cacheKey,
        JSON.stringify(finalTracks),
        DEFAULT_CACHE_TTL
      );
    }
    
    console.log(`[General] Recomendaciones generales obtenidas: ${finalTracks.length} tracks`);
    return finalTracks;
  } catch (error) {
    console.error(`[General] Error obteniendo recomendaciones generales:`, error);
    
    // En caso de error, intentar recuperar datos de caché aunque estén expirados
    try {
      const cacheKey = `general_recommendations:${limit}:${options.preferredSource || 'default'}`;
      const cachedData = await recommendationsCache.get(cacheKey);
      
      if (cachedData) {
        console.log(`[General] Usando caché expirada para recomendaciones generales`);
        return JSON.parse(cachedData);
      }
    } catch (cacheError) {
      console.error(`[General] Error accediendo a caché:`, cacheError);
    }
    
    // Si todo falla, devolver datos fallback
    return getGeneralFallbackTracks(limit);
  }
}

/**
 * Obtiene recomendaciones de canciones basadas en tendencias
 * Esta función simula obtener las canciones más populares del momento
 * 
 * @param limit Número máximo de resultados
 * @returns Lista de canciones recomendadas
 */
export async function getTrendingTracks(limit: number = 30): Promise<Track[]> {
  try {
    console.log(`[General] Obteniendo canciones en tendencia (limit=${limit})`);
    
    // Intentar obtener de caché primero
    const cacheKey = `trending_tracks:${limit}`;
    const cachedData = await recommendationsCache.get(cacheKey);
    
    if (cachedData) {
      console.log(`[General] Cache hit para canciones en tendencia`);
      return JSON.parse(cachedData);
    }
    
    // Intentar obtener tracks usando la búsqueda "trending" o "hits"
    const trendingGenres = ['trend', 'hits', 'top', 'chart'];
    
    // Usar uno aleatorio para variar resultados
    const randomGenre = trendingGenres[Math.floor(Math.random() * trendingGenres.length)];
    
    const trendingTracks = await getRecommendationsByGenre(randomGenre, limit, { 
      forceFresh: true, 
      preferredSource: 'deezer', // Deezer suele tener buenos resultados para tendencias
      combineResults: true 
    });
    
    // Guardar en caché por menos tiempo (6 horas) ya que las tendencias cambian más rápido
    if (trendingTracks.length > 0) {
      await recommendationsCache.set(
        cacheKey,
        JSON.stringify(trendingTracks),
        6 * 60 * 60 * 1000
      );
    }
    
    console.log(`[General] Canciones en tendencia obtenidas: ${trendingTracks.length} tracks`);
    return trendingTracks;
  } catch (error) {
    console.error(`[General] Error obteniendo canciones en tendencia:`, error);
    
    // Intentar obtener recomendaciones generales como fallback
    try {
      return await getGeneralRecommendations(limit);
    } catch (fallbackError) {
      console.error(`[General] Error en fallback para tendencias:`, fallbackError);
      return getGeneralFallbackTracks(limit);
    }
  }
}

/**
 * Función helper para generar canciones fallback cuando todo falla
 * @param limit Número de canciones a generar
 * @returns Lista de canciones fallback
 */
function getGeneralFallbackTracks(limit: number): Track[] {
  console.log(`[General] Generando tracks fallback generales`);
  
  const genres = ['pop', 'rock', 'electronic', 'hip-hop'];
  const fallbackTracks: Track[] = [];
  
  // Crear tracks fallback variados
  for (let i = 0; i < Math.min(limit, 10); i++) {
    const genre = genres[i % genres.length];
    fallbackTracks.push({
      id: `general_fallback_${i}`,
      title: `Canción Popular ${i + 1}`,
      artist: 'Artista en Tendencia',
      album: 'Éxitos Recientes',
      albumCover: `https://placehold.co/300x300/purple/white?text=Top+${i+1}`,
      cover: `https://placehold.co/300x300/purple/white?text=Top+${i+1}`,
      duration: 180000 + (i * 20000), // Duración ficticia entre 3 y 6 minutos
      spotifyId: undefined,
      youtubeId: undefined
    });
  }
  
  return fallbackTracks;
} 