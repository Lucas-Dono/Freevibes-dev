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
import { searchTracks } from '@/services/spotify';

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
 * Obtiene recomendaciones de canciones en múltiples idiomas
 * Esta función realiza búsquedas específicas por idioma para asegurar diversidad
 * 
 * @param limit Número máximo de resultados
 * @param options Opciones adicionales para la búsqueda
 * @returns Lista de canciones en diferentes idiomas
 */
export async function getMultiLanguageRecommendations(
  limit: number = 30,
  options: {
    forceFresh?: boolean;
    preferredSource?: SourceType;
  } = {}
): Promise<Track[]> {
  try {
    console.log(`[General] Obteniendo recomendaciones multi-idioma (limit=${limit})`);
    
    // Intentar obtener de caché primero si no se fuerza refresco
    if (!options.forceFresh) {
      const cacheKey = `multi_language_recommendations:${limit}:${options.preferredSource || 'default'}`;
      const cachedData = await recommendationsCache.get(cacheKey);
      
      if (cachedData) {
        console.log(`[General] Cache hit para recomendaciones multi-idioma`);
        return JSON.parse(cachedData);
      }
    }
    
    // Términos de búsqueda específicos por idioma - mejorados con términos más específicos
    const languageQueries = [
      { term: 'éxitos música latina', language: 'Español', color: 'red', subregion: 'Latinoamérica' },
      { term: 'top hits english', language: 'English', color: 'blue', subregion: 'Internacional' },
      { term: 'sucessos música brasileira', language: 'Português', color: 'green', subregion: 'Brasil' },
      { term: 'chansons populaires françaises', language: 'Français', color: 'purple', subregion: 'Francia' },
      { term: 'canzoni italiane popolari', language: 'Italiano', color: 'amber', subregion: 'Italia' },
      { term: 'k-pop hits 2023', language: 'Coreano', color: 'pink', subregion: 'Corea' },
      { term: 'j-pop popular songs', language: 'Japonés', color: 'teal', subregion: 'Japón' },
      { term: 'reggaetón hits', language: 'Español', color: 'orange', subregion: 'Urbano' }
    ];
    
    // Número de canciones a obtener por idioma, con un mínimo para asegurar diversidad
    const minTracksPerLanguage = 3;
    const tracksPerLanguage = Math.max(
      minTracksPerLanguage,
      Math.ceil(limit / Math.min(languageQueries.length, 5))
    );
    
    // Obtener resultados para cada idioma en paralelo
    const results = await Promise.all(
      languageQueries.slice(0, 5).map(async (query) => {
        try {
          // Intentar primero con Spotify para mejor calidad
          if (!options.preferredSource || options.preferredSource === 'spotify') {
            const spotifyResults = await searchTracks(query.term, tracksPerLanguage * 2);
            
            // Filtrar solo tracks con imágenes válidas
            const validSpotifyResults = spotifyResults.filter(track => {
              return track.cover && 
                     typeof track.cover === 'string' && 
                     track.cover.includes('scdn.co'); // Asegurar que es una imagen de Spotify
            });
            
            if (validSpotifyResults && validSpotifyResults.length > 0) {
              return validSpotifyResults.slice(0, tracksPerLanguage).map(track => ({
                ...track,
                language: query.language, // Añadir el idioma como propiedad
                subregion: query.subregion, // Añadir subregión para más contexto
                color: query.color // Almacenar color para visualización
              }));
            }
          }
          
          // Si no hay resultados válidos de Spotify, intentar con recomendaciones por término
          const genreResults = await getRecommendationsByGenre(query.term, tracksPerLanguage * 2, {
            forceFresh: options.forceFresh,
            preferredSource: options.preferredSource || 'spotify',
            combineResults: true
          });
          
          // Filtrar solo tracks con imágenes válidas
          const validGenreResults = genreResults.filter(track => {
            return track.cover && 
                   typeof track.cover === 'string' && 
                   track.cover.startsWith('http') &&
                   !track.cover.includes('placeholder');
          });
          
          if (validGenreResults && validGenreResults.length > 0) {
            return validGenreResults.slice(0, tracksPerLanguage).map(track => ({
              ...track,
              language: query.language,
              subregion: query.subregion,
              color: query.color
            }));
          }
          
          return [];
        } catch (error) {
          console.error(`[General] Error en búsqueda para ${query.language}:`, error);
          return [];
        }
      })
    );
    
    // Combinar resultados
    let allTracks: Track[] = [];
    results.forEach((languageTracks, index) => {
      if (languageTracks && languageTracks.length > 0) {
        // Añadir etiqueta de idioma si no existe
        const tracksWithLanguage = languageTracks.map(track => ({
          ...track,
          language: track.language || languageQueries[index]?.language || 'Desconocido',
          subregion: track.subregion || languageQueries[index]?.subregion || 'Internacional',
          color: track.color || languageQueries[index]?.color || 'gray'
        }));
        allTracks = [...allTracks, ...tracksWithLanguage];
      }
    });
    
    // Deduplicar por ID y también por combinación de título+artista para evitar duplicados con diferentes IDs
    const uniqueTracksMap = new Map<string, Track>();
    const uniqueIdentifiers = new Set<string>();
    
    allTracks.forEach(track => {
      // Crear un identificador único combinando título y artista normalizados
      const normalizedTitle = track.title.toLowerCase().trim();
      const normalizedArtist = track.artist.toLowerCase().trim();
      const uniqueIdentifier = `${normalizedTitle}|${normalizedArtist}`;
      
      // Si este es un nuevo track (por ID y por título+artista), añadirlo al mapa
      if (!uniqueTracksMap.has(track.id) && !uniqueIdentifiers.has(uniqueIdentifier)) {
        uniqueTracksMap.set(track.id, track);
        uniqueIdentifiers.add(uniqueIdentifier);
      }
    });
    
    const uniqueTracks = Array.from(uniqueTracksMap.values());
    
    // Agrupar por idioma para distribuir equitativamente
    const groupedByLanguage: Record<string, Track[]> = {};
    uniqueTracks.forEach(track => {
      const lang = track.language || 'Desconocido';
      if (!groupedByLanguage[lang]) {
        groupedByLanguage[lang] = [];
      }
      groupedByLanguage[lang].push(track);
    });
    
    // Distribuir tracks en orden intercalado por idioma para una mezcla equilibrada
    const finalTracks: Track[] = [];
    let continues = true;
    let index = 0;
    
    // Usar un enfoque de "round robin" para asegurar diversidad
    while (continues && finalTracks.length < limit) {
      continues = false;
      
      // Iterar sobre cada idioma
      Object.keys(groupedByLanguage).forEach(language => {
        if (groupedByLanguage[language].length > index) {
          finalTracks.push(groupedByLanguage[language][index]);
          continues = true;
        }
      });
      
      index++;
    }
    
    // Limitar al número solicitado
    const result = finalTracks.slice(0, limit);
    
    // Asegurar que todos los tracks tienen URL de imagen válida
    const finalResultWithImages = result.map(track => {
      // Si no tiene imagen válida, usar placeholder del color correspondiente al idioma
      if (!track.cover || !track.cover.startsWith('http') || track.cover.includes('placeholder')) {
        const color = track.color || 'gray';
        const language = track.language || 'Desconocido';
        return {
          ...track,
          cover: `https://placehold.co/300x300/${color}/white?text=${encodeURIComponent(language)}`,
          albumCover: `https://placehold.co/300x300/${color}/white?text=${encodeURIComponent(language)}`
        };
      }
      return track;
    });
    
    // Guardar en caché para futuras solicitudes
    if (finalResultWithImages.length > 0) {
      const cacheKey = `multi_language_recommendations:${limit}:${options.preferredSource || 'default'}`;
      await recommendationsCache.set(
        cacheKey,
        JSON.stringify(finalResultWithImages),
        DEFAULT_CACHE_TTL
      );
    }
    
    console.log(`[General] Recomendaciones multi-idioma obtenidas: ${finalResultWithImages.length} tracks`);
    return finalResultWithImages;
  } catch (error) {
    console.error(`[General] Error obteniendo recomendaciones multi-idioma:`, error);
    
    // En caso de error, intentar recuperar datos de caché expirada
    try {
      const cacheKey = `multi_language_recommendations:${limit}:${options.preferredSource || 'default'}`;
      const cachedData = await recommendationsCache.get(cacheKey);
      
      if (cachedData) {
        console.log(`[General] Usando caché expirada para recomendaciones multi-idioma`);
        return JSON.parse(cachedData);
      }
    } catch (cacheError) {
      console.error(`[General] Error accediendo a caché de multi-idioma:`, cacheError);
    }
    
    // Si no hay datos en caché, intentar con recomendaciones generales
    try {
      return await getGeneralRecommendations(limit, options);
    } catch (generalError) {
      console.error(`[General] Error en fallback para multi-idioma:`, generalError);
      return getMultiLanguageFallbackTracks(limit);
    }
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

/**
 * Función helper para generar canciones fallback en varios idiomas
 * @param limit Número de canciones a generar
 * @returns Lista de canciones fallback con etiquetas de idioma
 */
function getMultiLanguageFallbackTracks(limit: number): Track[] {
  console.log(`[General] Generando tracks fallback multi-idioma`);
  
  const languages = ['Español', 'English', 'Português', 'Français', 'Italiano', 'Coreano', 'Japonés'];
  const fallbackTracks: Track[] = [];
  
  // Crear tracks fallback variados con idiomas
  for (let i = 0; i < Math.min(limit, 14); i++) {
    const language = languages[i % languages.length];
    let title, artist;
    
    // Personalizar nombres según idioma
    switch (language) {
      case 'Español':
        title = `Éxito Latino ${Math.floor(i/languages.length) + 1}`;
        artist = 'Artista Latino';
        break;
      case 'English':
        title = `Top Hit ${Math.floor(i/languages.length) + 1}`;
        artist = 'English Artist';
        break;
      case 'Português':
        title = `Sucesso Brasileiro ${Math.floor(i/languages.length) + 1}`;
        artist = 'Artista Brasileiro';
        break;
      case 'Français':
        title = `Chanson Française ${Math.floor(i/languages.length) + 1}`;
        artist = 'Artiste Français';
        break;
      case 'Italiano':
        title = `Canzone Italiana ${Math.floor(i/languages.length) + 1}`;
        artist = 'Artista Italiano';
        break;
      case 'Coreano':
        title = `K-Pop Hit ${Math.floor(i/languages.length) + 1}`;
        artist = 'K-Pop Artist';
        break;
      case 'Japonés':
        title = `J-Pop Song ${Math.floor(i/languages.length) + 1}`;
        artist = 'J-Pop Artist';
        break;
      default:
        title = `Canción Internacional ${Math.floor(i/languages.length) + 1}`;
        artist = 'Artista Internacional';
    }
    
    const languageColor = {
      'Español': 'red',
      'English': 'blue',
      'Português': 'green',
      'Français': 'purple',
      'Italiano': 'orange',
      'Coreano': 'pink',
      'Japonés': 'teal'
    }[language] || 'gray';
    
    fallbackTracks.push({
      id: `multi_language_fallback_${i}`,
      title,
      artist,
      album: `Éxitos ${language}`,
      albumCover: `https://placehold.co/300x300/${languageColor}/white?text=${language}`,
      cover: `https://placehold.co/300x300/${languageColor}/white?text=${language}`,
      duration: 180000 + (i * 10000), // Duración ficticia
      spotifyId: undefined,
      youtubeId: undefined,
      language
    });
  }
  
  return fallbackTracks;
} 