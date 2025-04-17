/**
 * Servicio de recomendaciones de Last.fm
 * Proporciona funciones para obtener recomendaciones musicales de Last.fm
 */

import { Track } from '@/types/types';
import { recommendationsCache, DEFAULT_CACHE_TTL } from '@/lib/cache';
import { getApiBaseUrl } from '@/lib/api-config';

// Configuración de endpoints
const PROXY_URL = '/api/proxy/lastfm';
// Tiempo de espera para solicitudes a Last.fm (5 segundos)
const TIMEOUT = 5000;

// Géneros válidos conocidos (para fallback si la API falla)
export const VALID_GENRES = [
  'rock', 'pop', 'alternative', 'indie', 'electronic', 
  'hip-hop', 'rap', 'metal', 'jazz', 'blues', 'folk', 
  'country', 'r&b', 'soul', 'reggae', 'punk', 
  'classical', 'ambient', 'dance', 'latin', 'world'
];

/**
 * Obtiene recomendaciones de Last.fm para un género específico
 * 
 * @param genre Género musical para buscar
 * @param limit Límite de canciones a devolver
 * @returns Lista de canciones recomendadas
 */
export async function getRecommendationsByGenre(
  genre: string,
  limit: number = 20
): Promise<Track[]> {
  // Limpiamos y formateamos el género para que sea válido para Last.fm
  const normalizedGenre = normalizeGenre(genre.toLowerCase());
  console.log(`[Last.fm] Buscando recomendaciones para género: ${normalizedGenre} (original: ${genre})`);
  
  try {
    // Intentar obtener de caché primero
    const cacheKey = `lastfm:genre:${normalizedGenre}:${limit}`;
    const cachedData = await recommendationsCache.get(cacheKey);
    
    if (cachedData) {
      try {
        const parsedData = JSON.parse(cachedData);
        console.log(`[Last.fm] Cache hit para género: ${normalizedGenre} (${parsedData.length} canciones)`);
        return parsedData;
      } catch (parseError) {
        console.error(`[Last.fm] Error al parsear datos de caché:`, parseError);
        // Continuar con la petición a la API si hay error al parsear la caché
      }
    }
    
    // Si no hay en caché, obtener de la API
    const apiBaseUrl = getApiBaseUrl();
    const maxToFetch = Math.max(limit * 1.5, 30); // Solicitamos más para tener variedad
    
    console.log(`[Last.fm] Solicitando a API: ${normalizedGenre} (limit=${maxToFetch})`);
    
    // Verificar si hay término principal y términos relacionados para buscar
    const searchTerms = [normalizedGenre, ...getRelatedTerms(normalizedGenre)];
    
    // Limitar términos de búsqueda para no saturar la API
    const limitedTerms = searchTerms.slice(0, 5);
    console.log(`[Last.fm] Términos de búsqueda: ${limitedTerms.join(', ')}`);
    
    // Array para almacenar todas las canciones encontradas
    let allTracks: Track[] = [];
    
    // Realizar búsquedas secuenciales para cada término
    for (const term of limitedTerms) {
      if (allTracks.length >= maxToFetch) {
        break; // Ya tenemos suficientes canciones
      }
      
      try {
        const response = await fetch(
          `${apiBaseUrl}/proxy/lastfm?method=tag.gettoptracks&tag=${encodeURIComponent(term)}&limit=${maxToFetch}`
        );
    
    if (!response.ok) {
          console.error(`[Last.fm] Error en respuesta para "${term}": ${response.status}`);
          continue; // Continuar con el siguiente término
        }
        
        // Convertir respuesta a JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error(`[Last.fm] La respuesta no es JSON válido para "${term}"`);
          continue; // Continuar con el siguiente término
    }
    
    const data = await response.json();
    
        if (!data.tracks || !data.tracks.track || !Array.isArray(data.tracks.track)) {
          console.warn(`[Last.fm] No se encontraron tracks para "${term}"`);
          continue; // Continuar con el siguiente término
        }
        
        console.log(`[Last.fm] Obtenidos ${data.tracks.track.length} tracks para "${term}"`);
        
        // Convertir resultados de Last.fm a nuestro formato Track
        const tracks = data.tracks.track.map((track: any) => ({
          id: `lastfm_${track.mbid || track.name.replace(/\s+/g, '_').toLowerCase()}`,
          title: track.name,
          artist: track.artist.name,
          album: track.name, // Last.fm no proporciona nombre de álbum en esta API
          albumCover: 
            track.image && track.image.length > 2 && track.image[2]['#text']
              ? track.image[2]['#text']
              : selectGenreImage(normalizedGenre),
          cover: 
            track.image && track.image.length > 2 && track.image[2]['#text']
              ? track.image[2]['#text']
              : selectGenreImage(normalizedGenre),
          duration: 210000, // Last.fm no proporciona duración, aproximamos 3:30
          sourceUrl: track.url,
          spotifyId: undefined,
          youtubeId: undefined
        }));
        
        // Combinar con resultados previos, evitando duplicados
        for (const track of tracks) {
          const isDuplicate = allTracks.some(
            t => t.title.toLowerCase() === track.title.toLowerCase() && 
                 t.artist.toLowerCase() === track.artist.toLowerCase()
          );
          
          if (!isDuplicate) {
            allTracks.push(track);
          }
        }
        
        console.log(`[Last.fm] Total acumulado: ${allTracks.length} canciones únicas`);
        
        // Si ya tenemos suficientes canciones, parar
        if (allTracks.length >= maxToFetch) {
          break;
        }
      } catch (termError) {
        console.error(`[Last.fm] Error obteniendo canciones para "${term}":`, termError);
        // Continuar con el siguiente término
      }
    }
    
    // Si tenemos resultados, aleatorizar y limitar
    if (allTracks.length > 0) {
      // Aleatorizar para más variedad
      allTracks = allTracks.sort(() => Math.random() - 0.5);
      
      // Limitar al número solicitado
      const limitedTracks = allTracks.slice(0, limit);
      console.log(`[Last.fm] Devolviendo ${limitedTracks.length} canciones para género ${normalizedGenre}`);
      
      // Guardar en caché para futuras solicitudes
      await recommendationsCache.set(
        cacheKey,
        JSON.stringify(limitedTracks),
        DEFAULT_CACHE_TTL * 3 // Triple de tiempo para géneros (cambian poco)
      );
      
      return limitedTracks;
    }
    
    console.warn(`[Last.fm] No se encontraron canciones para ningún término relacionado con "${normalizedGenre}"`);
    
    // Si no hay resultados, intentar con géneros predefinidos
    if (VALID_GENRES.includes(normalizedGenre)) {
      console.log(`[Last.fm] Generando tracks fallback para género válido: ${normalizedGenre}`);
      return getFallbackTracks(normalizedGenre, limit);
    }
    
    // Si llegamos aquí, intentar encontrar un género relacionado dentro de los válidos
    const closeGenre = findClosestGenre(normalizedGenre);
    
    if (closeGenre && closeGenre !== normalizedGenre) {
      console.log(`[Last.fm] Reintentando con género similar: ${closeGenre}`);
      return getRecommendationsByGenre(closeGenre, limit);
    }
    
    // Si todo falla, devolver canciones fallback
    console.log(`[Last.fm] Usando fallback final para: ${normalizedGenre}`);
    return getFallbackTracks(normalizedGenre, limit);
  } catch (error) {
    console.error(`[Last.fm] Error general obteniendo recomendaciones:`, error);
    
    // En caso de error, intentar devolver datos de caché aún si están expirados
    try {
      const cacheKey = `lastfm:genre:${normalizedGenre}:${limit}`;
      const cachedData = await recommendationsCache.get(cacheKey, true);
      
      if (cachedData) {
        console.log(`[Last.fm] Usando caché expirada como recuperación`);
        return JSON.parse(cachedData);
      }
    } catch (cacheError) {
      console.error(`[Last.fm] Error accediendo a caché expirada:`, cacheError);
    }
    
    // Como último recurso, devolver tracks fallback
    return getFallbackTracks(normalizedGenre, limit);
  }
}

/**
 * Normaliza un género para que sea compatible con Last.fm
 * @param genre Género a normalizar
 * @returns Género normalizado
 */
function normalizeGenre(genre: string): string {
  // Quitar caracteres especiales y normalizar espacios
  let normalized = genre.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Convertir géneros compuestos al formato de Last.fm
  if (normalized.includes(' ')) {
    // Last.fm usa guión para géneros compuestos: hip-hop, drum-and-bass
    normalized = normalized.replace(/\s+/g, '-');
  }
  
  // Normalizaciones específicas comunes
  const genreMap: Record<string, string> = {
    'hiphop': 'hip-hop',
    'r&b': 'rnb',
    'rb': 'rnb',
    'electronica': 'electronic',
    'classic': 'classical',
    'classics': 'classical',
    'alternative rock': 'alternative',
    'alt rock': 'alternative',
    'alt': 'alternative'
  };
  
  return genreMap[normalized] || normalized;
}

/**
 * Extrae términos de búsqueda a partir de un título o texto
 * @param input Texto de entrada
 * @returns Términos significativos extraídos
 */
function extractSearchTerms(input: string): string[] {
  // Palabras que no aportan valor semántico musical
  const stopWords = ['the', 'and', 'for', 'with', 'feat', 'ft', 'by', 'from', 'mix'];
  
  // Obtener palabras y filtrar
  let words = input.toLowerCase()
    .replace(/\(.*?\)/g, '') // Eliminar contenido entre paréntesis
    .replace(/[^\w\s]/g, ' ') // Convertir símbolos en espacios
    .replace(/\s+/g, ' ') // Normalizar espacios
    .trim()
    .split(' ')
    .filter(w => w.length > 2 && !stopWords.includes(w)); // Filtrar palabras cortas y stopwords
  
  // Si hay más de 3 palabras, priorizar las más largas (posiblemente más descriptivas)
  if (words.length > 3) {
    words = words
      .sort((a, b) => b.length - a.length) // Ordenar por longitud descendente
      .slice(0, 3); // Tomar las 3 más largas
    
    // Reordenar las palabras según su orden original en el texto para mantener la semántica
    words = words.sort((a, b) => {
      const indexA = input.toLowerCase().indexOf(a);
      const indexB = input.toLowerCase().indexOf(b);
      return indexA - indexB;
    });
  }
  
  return words;
}

/**
 * Obtiene términos relacionados o alternativos para una búsqueda
 * @param input Entrada original (género o término)
 * @returns Lista de términos alternativos
 */
function getRelatedTerms(input: string): string[] {
  // Palabras clave extraídas del input
  const words = input.toLowerCase().split(' ').filter(w => w.length > 2);
  
  // Términos generales populares si no podemos usar el input
  const generalTerms = ['pop', 'rock', 'indie', 'alternative', 'electronic', 'hiphop', 'dance', 'jazz'];
  
  // Si no hay palabras útiles, devolver términos generales
  if (words.length === 0) {
    return generalTerms;
  }
  
  // Intentar mapear palabras a géneros conocidos
  const genreMap: Record<string, string[]> = {
    // Géneros principales con mapeos más extensos
    'rock': ['alternative', 'indie rock', 'classic rock', 'hard rock', 'punk rock', 'progressive rock', 'grunge', 'psychedelic'],
    'pop': ['dance pop', 'synth pop', 'indie pop', 'power pop', 'electropop', 'pop rock', 'chamber pop', 'dream pop'],
    'indie': ['indie rock', 'indie pop', 'alternative', 'indie folk', 'dream pop', 'shoegaze', 'indietronica', 'chamber pop'],
    'electronic': ['dance', 'electronica', 'EDM', 'house', 'techno', 'trance', 'dubstep', 'ambient', 'synthwave'],
    'rap': ['hip hop', 'trap', 'urban', 'lo-fi hip hop', 'boom bap', 'conscious rap', 'grime', 'drill'],
    'hip': ['hip hop', 'rap', 'conscious rap', 'old school', 'urban', 'trap', 'lo-fi hip hop', 'r&b'],
    'hop': ['hip hop', 'rap', 'conscious rap', 'old school', 'urban', 'trap', 'lo-fi hip hop', 'r&b'],
    'jazz': ['smooth jazz', 'jazz fusion', 'blues', 'bebop', 'cool jazz', 'modal jazz', 'swing', 'jazz funk'],
    'classical': ['orchestra', 'piano', 'instrumental', 'symphony', 'baroque', 'contemporary classical', 'chamber music'],
    'metal': ['heavy metal', 'rock', 'hard rock', 'thrash metal', 'death metal', 'black metal', 'power metal', 'doom metal'],
    'folk': ['acoustic', 'singer-songwriter', 'indie folk', 'americana', 'folk rock', 'bluegrass', 'contemporary folk'],
    'country': ['americana', 'folk', 'bluegrass', 'country rock', 'outlaw country', 'alt-country', 'country pop'],
    'dance': ['electronic', 'EDM', 'house', 'techno', 'trance', 'disco', 'dubstep', 'drum and bass'],
    'chill': ['ambient', 'chillout', 'lofi', 'downtempo', 'trip hop', 'atmospheric', 'new age', 'relaxation'],
    'sad': ['melancholic', 'ballad', 'emotional', 'alternative', 'indie', 'piano', 'sad songs', 'blues'],
    'happy': ['upbeat', 'feel good', 'summer', 'dance', 'pop', 'uplifting', 'cheerful', 'party'],
    'acoustic': ['unplugged', 'singer-songwriter', 'folk', 'indie folk', 'acoustic guitar', 'live acoustic', 'ballad'],
    // Géneros adicionales
    'soul': ['r&b', 'funk', 'blues', 'motown', 'neo-soul', 'jazz', 'gospel', 'disco'],
    'funk': ['soul', 'disco', 'r&b', 'jazz funk', 'groove', 'electro funk', 'boogie', 'funk rock'],
    'blues': ['rhythm and blues', 'soul', 'jazz', 'rock and roll', 'blues rock', 'folk', 'acoustic blues'],
    'reggae': ['dub', 'ska', 'dancehall', 'roots reggae', 'lover\'s rock', 'reggae fusion', 'rocksteady'],
    'punk': ['punk rock', 'hardcore', 'post-punk', 'pop punk', 'skate punk', 'emo', 'proto-punk', 'oi'],
    'grunge': ['alternative rock', 'rock', 'post-grunge', 'punk', 'hard rock', 'alternative metal', 'indie'],
    'ambient': ['chill', 'electronic', 'drone', 'atmospheric', 'ambient electronic', 'new age', 'space music'],
    'house': ['electronic', 'dance', 'deep house', 'progressive house', 'tech house', 'disco', 'club'],
    'techno': ['electronic', 'dance', 'minimal techno', 'detroit techno', 'acid techno', 'hard techno'],
    'trance': ['electronic', 'dance', 'progressive trance', 'psychedelic trance', 'uplifting trance', 'vocal trance'],
    'drum': ['drum and bass', 'jungle', 'breakbeat', 'electronic', 'liquid drum and bass', 'drumstep'],
    'bass': ['drum and bass', 'dubstep', 'bass music', 'electronic', 'trap', 'future bass', 'deep bass'],
    'lofi': ['lo-fi hip hop', 'chillhop', 'trip hop', 'instrumental hip hop', 'ambient', 'beats', 'downtempo'],
    'edm': ['electronic', 'dance', 'house', 'techno', 'trance', 'dubstep', 'future bass', 'electro'],
    'indie_alt': ['alternative', 'indie rock', 'indie pop', 'indie folk', 'dream pop', 'shoegaze', 'post-punk'],
    'alternative': ['indie', 'alternative rock', 'post-punk', 'grunge', 'college rock', 'emo', 'new wave'],
    'emo': ['emotional hardcore', 'punk', 'post-hardcore', 'alternative', 'indie', 'pop punk', 'screamo'],
    'instrumental': ['classical', 'ambient', 'soundtrack', 'post-rock', 'piano', 'guitar', 'orchestral', 'jazz'],
    'latin': ['reggaeton', 'latin pop', 'salsa', 'bachata', 'cumbia', 'merengue', 'latin jazz', 'latin rock'],
    'disco': ['dance', 'funk', 'soul', 'pop', '70s', 'house', 'nu-disco', 'eurodisco'],
    'synthwave': ['electronic', 'retro', '80s', 'outrun', 'retrowave', 'synthpop', 'cyberpunk', 'vaporwave'],
    'vaporwave': ['electronic', 'ambient', 'experimental', 'chillwave', 'future funk', 'synthwave', 'lo-fi']
  };
  
  // Construir lista de términos relacionados
  const relatedTerms: string[] = [];
  
  // Añadir el término original primero
  relatedTerms.push(input);
  
  // Añadir mapeos conocidos
  for (const word of words) {
    if (genreMap[word]) {
      relatedTerms.push(...genreMap[word]);
    } else if (word === 'indie' && genreMap['indie_alt']) {
      // Caso especial para indie (que está duplicado)
      relatedTerms.push(...genreMap['indie_alt']);
    }
  }
  
  // Añadir combinaciones (primer palabra + cada término)
  if (words.length > 1) {
    relatedTerms.push(words[0]);
    // Añadir cada palabra individual como posible género
    words.forEach(word => {
      if (word.length > 3 && !relatedTerms.includes(word)) {
        relatedTerms.push(word);
      }
    });
  }
  
  // Añadir algunos términos generales como fallback solo si no hay muchos términos ya
  if (relatedTerms.length < 5) {
    relatedTerms.push(...generalTerms.slice(0, 5));
  }
  
  // Eliminar duplicados
  const uniqueTerms: string[] = [];
  for (const term of relatedTerms) {
    if (!uniqueTerms.includes(term)) {
      uniqueTerms.push(term);
    }
  }
  
  // Limitar la cantidad de términos para evitar demasiadas peticiones innecesarias
  return uniqueTerms.slice(0, 15);
}

/**
 * Encuentra el género válido más cercano al proporcionado
 * @param genre Género a comparar
 * @returns Género válido más cercano
 */
function findClosestGenre(genre: string): string | null {
  if (VALID_GENRES.includes(genre)) {
    return genre;
  }
  
  // Buscar en términos relacionados si alguno es un género válido
  const relatedTerms = getRelatedTerms(genre);
  
  for (const term of relatedTerms) {
    if (VALID_GENRES.includes(term)) {
      return term;
    }
  }
  
  // Si ningún término relacionado es válido, buscar coincidencias parciales
  for (const validGenre of VALID_GENRES) {
    if (
      genre.includes(validGenre) || 
      validGenre.includes(genre) ||
      // Comprobar si hay similitud por distancia Levenshtein (simplificada)
      genre.length > 3 && validGenre.length > 3 && 
      (genre.startsWith(validGenre.substring(0, 3)) || validGenre.startsWith(genre.substring(0, 3)))
    ) {
      return validGenre;
    }
  }
  
  // Si no hay coincidencias, devolver un género por defecto general
  return 'rock';
}

/**
 * Selecciona una imagen por defecto basada en el género
 * @param genre Género musical
 * @returns URL de imagen representativa del género
 */
function selectGenreImage(genre: string): string {
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
    'default': 'https://images.unsplash.com/photo-1494232410401-ad00d5433cfa'
  };
  
  // Buscar coincidencia exacta o parcial
  for (const [key, url] of Object.entries(genreImages)) {
    if (genre === key || genre.includes(key) || key.includes(genre)) {
      return url;
    }
  }
  
  return genreImages['default'];
}

/**
 * Genera canciones fallback cuando otras opciones fallan
 * @param genre Género musical
 * @param limit Número de canciones a generar
 * @returns Lista de canciones simuladas
 */
function getFallbackTracks(genre: string, limit: number): Track[] {
  console.log(`[Last.fm] Generando tracks fallback para: ${genre}`);
  
  const fallbackTracks: Track[] = [];
  
  // Artistas ficticios por género
  const artists = {
    'rock': ['Imagine Dragons', 'The Killers', 'Foo Fighters', 'Arctic Monkeys'],
    'pop': ['Taylor Swift', 'Ariana Grande', 'Ed Sheeran', 'Dua Lipa'],
    'hip-hop': ['Kendrick Lamar', 'Drake', 'J. Cole', 'Travis Scott'],
    'electronic': ['Calvin Harris', 'David Guetta', 'Daft Punk', 'Avicii'],
    'default': ['The Artist', 'Music Band', 'Top Performer', 'Famous Singer']
  };
  
  // Seleccionar artistas apropiados para este género
  const genreArtists = artists[genre as keyof typeof artists] || artists['default'];
  
  // Imagen por defecto basada en género
  const coverImage = selectGenreImage(genre);
  
  // Crear tracks simulados
  for (let i = 0; i < Math.min(limit, 10); i++) {
    const artistIndex = i % genreArtists.length;
    
    fallbackTracks.push({
      id: `lastfm_fallback_${genre}_${i}`,
      title: `${genre.charAt(0).toUpperCase() + genre.slice(1)} Song ${i + 1}`,
      artist: genreArtists[artistIndex],
      album: `Best of ${genreArtists[artistIndex]}`,
      albumCover: coverImage,
      cover: coverImage,
      duration: 180000 + (i * 15000), // Entre 3 y 5 minutos
      sourceUrl: 'https://www.last.fm',
      spotifyId: undefined,
      youtubeId: undefined
    });
  }
  
  return fallbackTracks;
} 