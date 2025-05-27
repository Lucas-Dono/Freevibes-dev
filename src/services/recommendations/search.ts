/**
 * Servicio de búsqueda musical multi-fuente
 *
 * Este módulo proporciona funciones para realizar búsquedas de música en múltiples fuentes.
 */

import { Track } from '@/types/types';
import { recommendationsCache, DEFAULT_CACHE_TTL } from '@/lib/cache';
import { loadOrchestrator } from '@/services/orchestration';
import { asSectionType } from '@/lib/navigation-map';
import * as spotifySource from './sources/spotify';
import * as deezerSource from './sources/deezer';
import * as lastfmSource from './sources/lastfm';
import { youtube, youtubeMusic } from '../youtube';

// Opciones para la búsqueda multi-fuente
export interface SearchOptions {
  // Determina si se deben combinar resultados de diferentes fuentes
  combineResults?: boolean;
  // Extraer información textual de los resultados (útil para obtener metadatos)
  extractText?: boolean;
  // Fuente preferida a utilizar
  preferredSource?: 'spotify' | 'deezer' | 'lastfm' | 'youtube';
  // Nombre de artista a priorizar en los resultados
  preferArtist?: string;
  // Forzar búsqueda fresca (ignorar caché)
  forceFresh?: boolean;
  // Lista de fuentes disponibles para usar (controladas por límites de API)
  availableSources?: string[];
  // Sección para la distribución de API
  section?: string;
  // Preservar orden de resultados
  preserveOrder?: boolean;
}

/**
 * Busca canciones en varias fuentes (Spotify, LastFM, Deezer, YouTube)
 * @param query Consulta de búsqueda
 * @param limit Número máximo de resultados
 * @param options Opciones adicionales de búsqueda
 * @returns Lista de tracks encontrados
 */
export async function searchMultiSource(
  query: string,
  limit: number = 20,
  options: SearchOptions = {}
): Promise<Track[]> {
  const cacheKey = `search:${query}:${limit}:${JSON.stringify(options)}`;
  const useCache = !options.forceFresh;
  let startTime: number;

  try {
    if (useCache) {
      // Intentar obtener de caché primero
      const cachedData = await recommendationsCache.get(cacheKey);
      if (cachedData) {
        const tracks = JSON.parse(cachedData);

        // Ordenar por completitud si estamos usando el orquestador
        if (options.section) {
          return loadOrchestrator.sortTracksByCompleteness(tracks);
        }
        return tracks;
      }
    }

    startTime = Date.now();

    // Optimización: convertir búsquedas de género a formato específico
    const isGenreSearch = query.toLowerCase().startsWith('genre:');

    let results: Track[] = [];
    let sourcesUsed = {
      spotify: false,
      youtube: false
    };

    // Determinar la distribución de APIs según la sección
    let apiDistribution = {
      spotify: 40,
      youtube: 60
    };

    // Si tenemos información de sección, usar la distribución optimizada
    if (options.section) {
      apiDistribution = loadOrchestrator.getApiDistribution(asSectionType(options.section));
    }

    // Determinar fuentes a utilizar basado en la disponibilidad y distribución
    // Solo permitimos spotify y youtube como fuentes
    const availableSources = options.availableSources ||
      ['spotify', 'youtube'].filter(source => {
        // Determinar si usaremos esta fuente basado en su porcentaje en la distribución
        const randomValue = Math.random() * 100;
        return randomValue <= apiDistribution[source as keyof typeof apiDistribution];
      });

    // Si se especifica una fuente preferida y está disponible, usarla primero
    const preferredSource = options.preferredSource;

    if (preferredSource && (preferredSource === 'spotify' || preferredSource === 'youtube') && availableSources.includes(preferredSource)) {
      const tracks = await searchBySource(preferredSource, query, limit, options);

      if (tracks.length > 0) {
        results = tracks;
        sourcesUsed[preferredSource as keyof typeof sourcesUsed] = true;
      }
    }

    // Si no tenemos suficientes resultados o queremos combinar, continuar con otras fuentes
    if (results.length < limit || options.combineResults) {
      // Definir promises para búsquedas en paralelo, excluyendo la fuente preferida ya usada
      const remainingSources = availableSources.filter(
        source => source !== preferredSource || !sourcesUsed[source as keyof typeof sourcesUsed]
      );

      if (remainingSources.length > 0) {
        // Definir tiempos de espera diferentes para cada fuente
        const timeouts = {
          spotify: 8000,  // 8 segundos para Spotify
          youtube: 10000  // 10 segundos para YouTube (cuota limitada)
        };

        const sourcePromises = remainingSources.map(source => {
          return Promise.race([
            searchBySource(source, query, limit, options)
              .then(tracks => ({ source, tracks }))
              .catch((error: any) => {
                console.error(`[Search] Error en ${source}:`, error);
                return { source, tracks: [] };
              }),
            new Promise<{ source: string; tracks: Track[] }>(resolve =>
              setTimeout(() => {
                resolve({ source, tracks: [] });
              }, timeouts[source as keyof typeof timeouts])
            )
          ]);
        });

        // Esperar a que todas las promesas se resuelvan
        const sourceResults = await Promise.all(sourcePromises);

        // Procesar los resultados de cada fuente
        for (const { source, tracks } of sourceResults) {
          if (tracks.length > 0) {
            sourcesUsed[source as keyof typeof sourcesUsed] = true;

            if (options.combineResults) {
              // Añadir a los resultados existentes
              results = [...results, ...tracks];
            } else if (results.length < limit) {
              // Si no estamos combinando, usar estos resultados si no tenemos suficientes
              results = tracks;
              break;
            }
          }
        }
      }
    }

    // Eliminar duplicados basados en ID o combinación de título y artista
    const uniqueTracks: Record<string, Track> = {};

    results.forEach(track => {
      // Crear clave única basada en ID o título+artista
      const key = track.id || `${track.title}:${track.artist}`.toLowerCase();

      // Filtrar canciones con títulos inválidos como "canción no encontrada numero 1"
      const invalidPatterns = [
        'no encontrada',
        'not found',
        'unknown track',
        'unknown song',
        'undefined',
        'sin título',
        'error',
        'no disponible'
      ];

      const isInvalidTitle = invalidPatterns.some(pattern =>
        track.title?.toLowerCase().includes(pattern) ||
        track.artist?.toLowerCase().includes(pattern)
      );

      // Omitir tracks con títulos inválidos
      if (isInvalidTitle) {
        return;
      }

      // Si este track ya existe, mantener la versión con más datos
      if (uniqueTracks[key]) {
        const existing = uniqueTracks[key];

        // Determinar cuál tiene más datos (preferir el que tiene ID de Spotify)
        if (
          (track.spotifyId && !existing.spotifyId) ||
          (track.cover && !existing.cover) ||
          (track.youtubeId && !existing.youtubeId)
        ) {
          uniqueTracks[key] = {
            ...existing,
            ...track,
            // Mantener estos campos si ya existen y el nuevo track no los tiene
            spotifyId: track.spotifyId || existing.spotifyId,
            cover: track.cover || existing.cover,
            albumCover: track.albumCover || existing.albumCover,
            youtubeId: track.youtubeId || existing.youtubeId
          };
        }
      } else {
        uniqueTracks[key] = track;
      }
    });

    // Convertir de vuelta a array y limitar resultados
    results = Object.values(uniqueTracks);

    // SOLUCIÓN RADICAL: Eliminar TODOS los tracks sin imágenes o con imágenes de LastFM
    results = results.filter(track => {
      // Si no tiene imagen, eliminar
      if (!track.cover) return false;

      // Detectar URLs de Last.fm o genéricas
      const badImagePatterns = [
        'lastfm',
        '2a96cbd8b46e442fc41c2b86b821562f',
        'placeholder',
        'default',
        'unknown',
        'fb421c35',
        'c6f59c1e',
        '4128a6eb',
        'avatar',
        '/i/u/',
        '/ar0/'
      ];

      // Si contiene alguno de los patrones, eliminar
      return !badImagePatterns.some(pattern =>
        track.cover?.toLowerCase().includes(pattern)
      );
    });

    // Si quedan muy pocos resultados después del filtrado, buscar en Spotify como fallback
    if (results.length < Math.min(5, limit) && !query.includes('spotify:')) {

      try {
        // Intentar una búsqueda directa en Spotify
        const spotifyApi = await import('@/services/spotify');
        const spotifyResults = await spotifyApi.searchTracks(query, limit * 2);

        // Filtrar también estos resultados para garantizar imágenes válidas
        const filteredSpotifyResults = spotifyResults.filter((track: Track) =>
          track.cover && !track.cover.includes('lastfm')
        );

        // Combinar los resultados originales con los nuevos de Spotify
        const combinedResults = [...results];

        // Añadir sólo tracks de Spotify que no estén ya en los resultados (por título+artista)
        for (const spotifyTrack of filteredSpotifyResults) {
          const key = `${spotifyTrack.title}:${spotifyTrack.artist}`.toLowerCase();
          if (!results.some(t => `${t.title}:${t.artist}`.toLowerCase() === key)) {
            combinedResults.push(spotifyTrack);
          }
        }

        results = combinedResults;
      } catch (error) {
        console.error('[Search] Error en fallback de Spotify:', error);
      }
    }

    // Aleatorizar el orden de los resultados para mayor variedad
    // (excepto en búsquedas específicas donde el orden puede ser importante)
    if (!options.preserveOrder && !query.includes(':') && results.length > 5) {
      results = shuffleArray(results);
    }

    // Limitar al número solicitado
    results = results.slice(0, limit);

    // Si estamos usando el orquestador, ordenar por completitud
    if (options.section) {
      results = loadOrchestrator.sortTracksByCompleteness(results);
    }

    // Guardar en caché para futuras búsquedas si tenemos resultados
    if (results.length > 0 && useCache) {
      await recommendationsCache.set(cacheKey, JSON.stringify(results), DEFAULT_CACHE_TTL);
    }

    const endTime = Date.now();
    console.log(`[Search] Búsqueda "${query}" completada en ${endTime - startTime}ms. Fuentes usadas:`,
      Object.entries(sourcesUsed)
        .filter(([_, used]) => used)
        .map(([source]) => source)
        .join(', ')
    );

    return results;
  } catch (error) {
    console.error(`[Search] Error buscando "${query}":`, error);

    // Intentar recuperar de caché incluso si es una búsqueda forzada
    if (!useCache) {
      const cachedData = await recommendationsCache.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
    }

    // Si todo falla, devolver array vacío
    return [];
  }
}

/**
 * Realiza búsqueda en una fuente específica
 * @param source Fuente a utilizar
 * @param query Consulta de búsqueda
 * @param limit Número máximo de resultados
 * @param options Opciones adicionales
 * @returns Lista de tracks encontrados
 */
async function searchBySource(
  source: string,
  query: string,
  limit: number,
  options: SearchOptions
): Promise<Track[]> {
  try {

    switch (source.toLowerCase()) {
      case 'spotify': {
        // Ajustar consulta para Spotify si se especifica un artista preferido
        let spotifyQuery = query;
        if (options.preferArtist && !query.toLowerCase().includes(options.preferArtist.toLowerCase())) {
          spotifyQuery = `${query} ${options.preferArtist}`;
        }

        // Buscar en Spotify
        const spotifyTracks = await spotifySource.searchTracks(spotifyQuery, limit);
        return spotifyTracks;
      }

      case 'youtube': {
        // Siempre usar YouTube Music para búsquedas
        const ytMusicResults = await youtubeMusic.searchSongs(query, limit);
        if (ytMusicResults.length > 0) {
          return youtubeMusic.toTracks(ytMusicResults);
        }

        // Si no hay resultados con YouTube Music, intentar con YouTube normal
        const musicQuery = query.includes('music') || query.includes('música') || query.includes('canción')
          ? query
          : `${query} music`;

        // Buscar videos
        const videos = await youtube.searchVideos(musicQuery, limit);

        if (!videos || !videos.items || videos.items.length === 0) {
          return [];
        }

        // Filtrar contenido no musical basado en el título
        const musicItems = videos.items.filter(item => {
          const title = item.snippet.title.toLowerCase();
          const nonMusicTerms = [
            'gameplay', 'tutorial', 'how to', 'walkthrough', 'review',
            'unboxing', 'trailer', 'explicación', 'explicacion'
          ];
          return !nonMusicTerms.some(term => title.includes(term));
        });

        // Extraer título y artista de los videos
        return musicItems.map(item => {
          // Intentar extraer artista y título del formato común "Artista - Título"
          const { title, artist } = extractArtistAndTitle(item.snippet.title);

          // Determinar la mejor imagen disponible
          const thumbnails = item.snippet.thumbnails;
          const bestThumbnail =
            thumbnails.maxres?.url ||
            thumbnails.standard?.url ||
            thumbnails.high?.url ||
            thumbnails.medium?.url ||
            thumbnails.default.url;

          return {
            id: item.id.videoId,
            title,
            artist,
            album: 'YouTube Music',
            cover: bestThumbnail,
            duration: 0, // YouTube API no proporciona duración en la búsqueda inicial
            source: 'youtube',
            youtubeId: item.id.videoId
          };
        });
      }

      default:
        console.warn(`[Search] Fuente no soportada: ${source}`);
        return [];
    }
  } catch (error) {
    console.error(`[Search] Error buscando en ${source}:`, error);
    return [];
  }
}

/**
 * Extrae artista y título a partir del título de un video de YouTube
 */
function extractArtistAndTitle(videoTitle: string): { title: string; artist: string } {
  // Patrón común: "Artista - Título (Opcional)"
  const dashSeparatorMatch = videoTitle.match(/^(.*?)\s*-\s*(.*?)(\(.*?\))?$/);

  if (dashSeparatorMatch) {
    let [, artist, title] = dashSeparatorMatch;

    // Limpiar el título
    title = cleanMusicTitle(title);

    return { title, artist: artist.trim() };
  }

  // Sin separador claro, asumir que todo es el título y derivar artista del canal
  return {
    title: cleanMusicTitle(videoTitle),
    artist: 'Artista Desconocido'
  };
}

/**
 * Limpia un título musical eliminando términos comunes en videos musicales
 */
function cleanMusicTitle(title: string): string {
  let cleanTitle = title.trim();

  // Términos comunes a eliminar
  const termsToRemove = [
    /\(Official\s*Video\)/gi,
    /\(Video\s*Oficial\)/gi,
    /\(Official\s*Music\s*Video\)/gi,
    /\(Official\s*Audio\)/gi,
    /\(Audio\s*Oficial\)/gi,
    /\(Lyrics\)/gi,
    /\(Letra\)/gi,
    /\(Lyric\s*Video\)/gi,
    /\(Video\s*Lyric\)/gi,
    /\(HQ\)/gi,
    /\(HD\)/gi,
    /\(4K\)/gi,
    /\[Official\s*Video\]/gi,
    /\[Video\s*Oficial\]/gi,
    /\[Official\s*Music\s*Video\]/gi,
    /\[Official\s*Audio\]/gi,
    /\[Audio\s*Oficial\]/gi,
    /\[Lyrics\]/gi,
    /\[Letra\]/gi,
    /\[Lyric\s*Video\]/gi,
    /\[Video\s*Lyric\]/gi,
    /\[HQ\]/gi,
    /\[HD\]/gi,
    /\[4K\]/gi,
    /Official\s*Video/gi,
    /Video\s*Oficial/gi,
    /Official\s*Music\s*Video/gi,
    /Official\s*Audio/gi,
    /Audio\s*Oficial/gi,
    /Lyrics/gi,
    /Letra/gi,
    /Lyric\s*Video/gi,
    /Video\s*Lyric/gi
  ];

  // Aplicar cada patrón
  for (const pattern of termsToRemove) {
    cleanTitle = cleanTitle.replace(pattern, '');
  }

  // Eliminar múltiples espacios
  cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();

  return cleanTitle;
}

/**
 * Aleatoriza un array (algoritmo Fisher-Yates shuffle)
 * @param array Array a aleatorizar
 * @returns Array aleatorizado
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Función para guardar tracks en caché
async function cacheTracks(query: string, tracks: Track[], options: SearchOptions): Promise<void> {
  if (tracks.length > 0 && !options.forceFresh) {
    try {
      const cacheKey = `search:${query.toLowerCase()}:${tracks.length}:${JSON.stringify(options)}`;
      await recommendationsCache.set(cacheKey, JSON.stringify(tracks), DEFAULT_CACHE_TTL);
    } catch (error: any) {
      console.error(`[Search] Error guardando en caché:`, error);
    }
  }
}

/**
 * Genera resultados de búsqueda simulados para desarrollo
 * NOTA: Función temporal para desarrollo, será reemplazada por búsquedas reales en APIs
 *
 * @param query Término de búsqueda
 * @param limit Número máximo de resultados
 * @param options Opciones de búsqueda
 * @returns Lista de canciones simuladas
 */
function generateMockSearchResults(query: string, limit: number, options: SearchOptions): Track[] {

  const mockTracks: Track[] = [];
  const count = Math.min(limit, 25); // Aumentamos el límite para mayor variedad
  const words = query.split(' ');

  // Extraer posible género si la búsqueda es de formato genre:xxx
  let genre = '';
  let isGenreSearch = false;

  if (query.toLowerCase().startsWith('genre:')) {
    isGenreSearch = true;
    genre = query.substring('genre:'.length).toLowerCase();
  }

  // Imágenes por géneros para búsquedas de género
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
    'alternative': 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89',
    'metal': 'https://images.unsplash.com/photo-1629276301820-0f3eedc29fd0',
    'default': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
  };

  // Artistas ficticios por género con nombres mejorados
  const genreArtists: Record<string, string[]> = {
    'pop': ['Taylor Wonder', 'The Weekdays', 'Ariadna Grande', 'Justin Lake', 'Katy Perry', 'Ed Williams', 'Dua Nova'],
    'rock': ['Imagine Lions', 'Foo Racers', 'Linkin Hill', 'Red Hot Peppers', 'Guns & Petals', 'The Rolling Hills', 'Queen Bees'],
    'hip-hop': ['Drake Bell', 'Kendrick Martin', 'J-Colt', 'Eminem', 'Cardi A', 'Tyler Creator', 'Post Express'],
    'electronic': ['David Greta', 'Calvin Russell', 'Marshmello', 'Avicii', 'Daft Function', 'Skrillex', 'Diplo'],
    'jazz': ['Miles Away', 'John Culture', 'Ella Gerald', 'Louis Steel', 'Nina Monday', 'Duke Silver', 'Count Basic'],
    'r&b': ['Beyonder', 'Sam Smith', 'Frank Channel', 'The Weekend', 'SZA', 'Alicia Notes', 'Janelle Monae'],
    'latin': ['Bad Rabbit', 'J Balvin', 'Rosalía', 'Daddy Yankee', 'Shakira', 'Enrique Lakes', 'Maluma'],
    'classical': ['Mozart Today', 'Bach to Life', 'Beethoven Returns', 'Chopin Master', 'Modern Tchaikovsky', 'Vivaldi Quartet', 'Debussy Dreams'],
    'indie': ['Arcade Fire', 'Tame Cheetah', 'Vampire Weekend', 'Arctic Tigers', 'The Neighbourhood', 'The xx', 'Bon Journey'],
    'alternative': ['Radiohead', 'The Killers', 'Twenty One Pirates', 'Imagine Dragons', 'Coldplay', 'The 1978', 'Green Week'],
    'metal': ['Metallica', 'Iron Boy', 'Black Monday', 'Slayer', 'Megadeth', 'System Of A Rise', 'Rammstein'],
    'default': ['The Universal Artist', 'Music Masters', 'Sound Collective', 'Audio Wizards', 'Harmony Crew']
  };

  // Títulos de canciones por género mejorados
  const genreSongTitles: Record<string, string[]> = {
    'pop': ['Dancing With Myself', 'Love Story', 'Night Changes', 'Watermelon Sugar', 'Blinding Lights', 'Bad Habits', 'Levitating'],
    'rock': ['Highway to Heaven', 'Sweet Emotion', 'Enter Sandcastle', 'Black Hole Sun', 'Numb', 'November Rain', 'Welcome to the Circus'],
    'hip-hop': ['Straight Outta Town', 'God\'s Plan', 'Lose Yourself', 'Sicko Mode', 'HUMBLE.', 'Alright', 'Money Trees'],
    'electronic': ['One More Time', 'Levels', 'Strobe Light', 'Animals', 'Clarity', 'Scary Monsters', 'Summer Feelings'],
    'jazz': ['Take Five Steps', 'So What Now', 'Blue and Green', 'My Favorite Serenade', 'Autumn Falls', 'Round Midnight', 'All Blues'],
    'r&b': ['Love Galore', 'Redbone', 'Stay With Me Tonight', 'Thinking About You', 'No Guidance', 'Fine Line', 'Pick Up Your Feelings'],
    'latin': ['Despacito Remix', 'Havana Nights', 'Mi Gente', 'Bailando', 'Vivir Mi Vida', 'Gasolina Dreams', 'Danza Kuduro'],
    'classical': ['Moonlight Sonata Redux', 'Four Seasons: Spring', 'Symphony No. 5', 'Clair de Lune', 'Ride of the Valkyries', 'Canon in A', 'Air on G String'],
    'indie': ['Midnight City Lights', 'Do I Wanna Know?', 'Skinny Love', 'Pumped Up Kids', 'Take Me Out', 'Obstacle 1', 'Two Weeks'],
    'alternative': ['Creep Show', 'Seven Nation Alliance', 'Feel Good Inc.', 'Viva La Vida', 'My Chemical Heart', 'High and Dry', 'Boulevard of Broken Dreams'],
    'metal': ['Master of Reality', 'The Trooper', 'Holy Wars', 'Walk This Path', 'Paranoid Android', 'Enter Sandman', 'Crazy Train'],
    'default': ['The Journey Begins', 'First Impression', 'New Horizons', 'Sunset Boulevard', 'Midnight Memories', 'Summer Breeze']
  };

  // Nombres de álbumes por género mejorados
  const genreAlbums: Record<string, string[]> = {
    'pop': ['Teenage Dream', 'Sweetener', 'Future Nostalgia', '1989', 'After Hours', 'Divide', 'Confessions'],
    'rock': ['Dark Side of the Moon', 'The Wall', 'Nevermind', 'The Black Album', 'Hysteria', 'Highway to Hell', 'Led Zeppelin IV'],
    'hip-hop': ['To Pimp a Butterfly', 'Good Kid, M.A.A.D City', 'The Blueprint', 'My Beautiful Twisted Fantasy', 'The Chronic', 'Illmatic', 'Astroworld'],
    'electronic': ['Random Access Memories', 'Discovery', 'Cross', 'Homework', 'Settle', 'True', 'Worlds'],
    'jazz': ['Kind of Blue', 'A Love Supreme', 'Time Out', 'Bitches Brew', 'Head Hunters', 'Giant Steps', 'Moanin'],
    'r&b': ['Channel Orange', 'Blonde', 'CTRL', 'Back to Black', 'Lemonade', 'Velvet Rope', 'Confessions'],
    'latin': ['Vibras', 'El Último Tour Del Mundo', 'Aura', 'YHLQMDLG', 'Colores', 'Fórmula Vol. 2', 'Energia'],
    'classical': ['The Four Seasons', 'Symphony No.9', 'Clair de Lune Collection', 'The Planets', 'The Nutcracker Suite', 'Piano Concertos'],
    'indie': ['In Rainbows', 'Currents', 'This Is Happening', 'The Suburbs', 'Modern Vampires of the City', 'Merriweather Post Pavilion'],
    'alternative': ['OK Computer', 'Hot Fuss', 'American Idiot', 'The Bends', 'Mellon Collie and the Infinite Sadness', 'Absolution'],
    'metal': ['Master of Puppets', 'Rust in Peace', 'The Number of the Beast', 'Paranoid', 'Reign in Blood', 'Cowboys from Hell'],
    'default': ['Magnum Opus', 'The Collection', 'Studio Sessions', 'Greatest Hits', 'New Beginnings', 'The Journey']
  };

  // Extraer posible nombre de artista
  const artistName = options.preferArtist || (words.length > 1 && !isGenreSearch ? words[0] : undefined);

  // Seleccionar imagen de género si es búsqueda por género
  let coverImage;
  let artistsList;
  let songTitlesList;
  let albumsList;

  if (isGenreSearch) {
    coverImage = genreImages[genre] || genreImages['default'];
    artistsList = genreArtists[genre] || genreArtists['default'];
    songTitlesList = genreSongTitles[genre] || genreSongTitles['default'];
    albumsList = genreAlbums[genre] || genreAlbums['default'];
  } else {
    // Para búsquedas normales, usar imágenes aleatorias de calidad
    const searchImages = [
      'https://images.unsplash.com/photo-1494232410401-ad00d5433cfa',
      'https://images.unsplash.com/photo-1458560871784-56d23406c091',
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f',
      'https://images.unsplash.com/photo-1516223725307-6f76b9ec8742',
      'https://images.unsplash.com/photo-1496293455970-f8581aae0e3b'
    ];
    artistsList = genreArtists['default'];
    songTitlesList = genreSongTitles['default'];
    albumsList = genreAlbums['default'];
    coverImage = searchImages[Math.floor(Math.random() * searchImages.length)];
  }

  // Crear tracks simulados relacionados con la búsqueda
  for (let i = 0; i < count; i++) {
    // Obtener un artista aleatorio o usar el proporcionado
    const randomArtist = artistsList[Math.floor(Math.random() * artistsList.length)];
    const artist = options.preferArtist || randomArtist;

    // Obtener un título aleatorio de canción
    const randomIndex = Math.floor(Math.random() * songTitlesList.length);
    const songBase = songTitlesList[randomIndex];

    // Generar título relevante a la búsqueda pero sin prefijos de género
    let title = songBase;

    // Para evitar repeticiones si hay más canciones que títulos en nuestra lista
    if (i >= songTitlesList.length) {
      // Añadir un sufijo numérico discreto
      const suffix = Math.floor(Math.random() * 3) + 1;
      title = `${songBase} ${suffix === 1 ? '' : suffix}`.trim();
    }

    // Seleccionar un álbum aleatorio
    const albumIndex = Math.floor(Math.random() * albumsList.length);
    const album = albumsList[albumIndex];

    mockTracks.push({
      id: `search_${query.replace(/\s+/g, '_').replace(/[^\w-]/g, '')}_${i}`,
      title,
      artist,
      album,
      albumCover: coverImage,
      cover: coverImage,
      duration: 180000 + (i * 10000), // Duración ficticia
      spotifyId: undefined,
      youtubeId: undefined
    });
  }

  return mockTracks;
}
