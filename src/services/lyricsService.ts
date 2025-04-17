import { Track } from "@/contexts/PlayerContext";

interface LRCLIBResponse {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string;
  syncedLyrics: string;
}

// Interfaces para la API de YouTube Music
interface LyricLine {
  text: string;
  start_time: number;
  end_time: number;
  id: number;
}

interface YTMusicLyrics {
  lyrics: string | LyricLine[];
  source: string;
  hasTimestamps: boolean;
}

// URL del servidor Node que actúa como intermediario para YouTube Music API
const NODE_SERVER_URL = process.env.NODE_SERVER_URL || 'http://localhost:3001/api';
const YT_MUSIC_API_URL = process.env.YTMUSIC_API_URL || 'http://localhost:5000';

/**
 * Sanitiza un string para usarlo en una URL
 * Elimina caracteres especiales y símbolos que pueden causar problemas
 * pero preserva los acentos y caracteres especiales del idioma
 */
const sanitizeParam = (param: string): string => {
  if (!param) return '';
  
  // Preservamos los acentos y solo limpiamos espacios y caracteres no deseados
  return param.trim()
    .replace(/[^\w\sáéíóúüñÁÉÍÓÚÜÑçÇàèìòùÀÈÌÒÙäëïöüÄËÏÖÜ\-&'.,]/g, '') // Mantener acentos y caracteres especiales comunes
    .replace(/\s+/g, ' ') // Reemplazar múltiples espacios por uno solo
    .trim();
};

/**
 * Convierte duración de formato MM:SS a segundos
 */
const formatDuration = (duration: number | string): number => {
  // Si es string (MM:SS), convertir a segundos
  if (typeof duration === 'string') {
  if (duration.includes(':')) {
    const parts = duration.split(':');
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return parseInt(duration);
  }
  
  // Si ya es un número (en segundos o milisegundos)
  if (duration > 10000) {
    // Probablemente en milisegundos, convertir a segundos
    return Math.round(duration / 1000);
  }
  
  return Math.round(duration);
};

/**
 * Servicio principal para obtener letras de canciones
 * Sigue el siguiente flujo:
 * 1. Busca con lrclib.net usando parámetros originales
 * 2. Si falla, intenta con YouTube Music con parámetros originales
 * 3. Si falla, prueba con parámetros simplificados en lrclib.net y YouTube Music
 * 4. Si aún falla, usa búsqueda por palabras clave
 */
export const getLyrics = async (track: Track): Promise<{
  plainLyrics: string | null;
  syncedLyrics: string | null;
}> => {
  try {
    // Sanitizar parámetros
    const title = sanitizeParam(track.title);
    const artist = sanitizeParam(track.artist);
    
    // Verificar que al menos tenemos título y artista
    if (!title || !artist) {
      console.log('Datos insuficientes para buscar letras');
      return { plainLyrics: null, syncedLyrics: null };
    }
    
    // 1. PRIMER INTENTO: Buscar en lrclib.net con parámetros originales
    console.log(`[LYRICS] Paso 1: Buscando en lrclib.net con parámetros originales: "${title}" por "${artist}"`);
    
    const lrclibResult = await searchLrclibDirect(title, artist);
    if (lrclibResult.plainLyrics || lrclibResult.syncedLyrics) {
      console.log('[LYRICS] Éxito en lrclib.net con parámetros originales');
      return lrclibResult;
    }
    
    // 2. SEGUNDO INTENTO: Buscar en YouTube Music con parámetros originales
    console.log(`[LYRICS] Paso 2: Buscando en YouTube Music con parámetros originales: "${title}" por "${artist}"`);
    
    const ytMusicResult = await getYouTubeMusicLyrics(title, artist);
    if (ytMusicResult.plainLyrics || ytMusicResult.syncedLyrics) {
      console.log('[LYRICS] Éxito en YouTube Music con parámetros originales');
      return ytMusicResult;
    }
    
    // 3. TERCER INTENTO: Probar con parámetros simplificados
    // Simplificar los parámetros
    const simpleTitle = title.split('(')[0].split('-')[0].split('feat')[0].trim();
    const simpleArtist = artist.split(',')[0].split('&')[0].split('feat')[0].trim();
    
    console.log(`[LYRICS] Paso 3: Buscando con parámetros simplificados: "${simpleTitle}" por "${simpleArtist}"`);
    
    // 3.1 Primero probar lrclib.net con parámetros simplificados
    const simpleLrclibResult = await searchLrclibDirect(simpleTitle, simpleArtist);
    if (simpleLrclibResult.plainLyrics || simpleLrclibResult.syncedLyrics) {
      console.log('[LYRICS] Éxito en lrclib.net con parámetros simplificados');
      return simpleLrclibResult;
    }
    
    // 3.2 Probar YouTube Music con parámetros simplificados
    const simpleYtMusicResult = await getYouTubeMusicLyrics(simpleTitle, simpleArtist);
    if (simpleYtMusicResult.plainLyrics || simpleYtMusicResult.syncedLyrics) {
      console.log('[LYRICS] Éxito en YouTube Music con parámetros simplificados');
      return simpleYtMusicResult;
    }
    
    // 4. CUARTO INTENTO: Usar búsqueda por palabras clave
    console.log('[LYRICS] Paso 4: Usando búsqueda por palabras clave');
    return await searchLyricsByKeywords(simpleTitle, simpleArtist);
  } catch (error) {
    console.error('[LYRICS] Error general en búsqueda de letras:', error);
    return { plainLyrics: null, syncedLyrics: null };
  }
};

/**
 * Busca letras en lrclib.net directamente
 */
const searchLrclibDirect = async (title: string, artist: string): Promise<{
  plainLyrics: string | null;
  syncedLyrics: string | null;
}> => {
  try {
    const params = new URLSearchParams({
      track_name: title,
      artist_name: artist,
    });

    const response = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      headers: {
        'Lrclib-Client': 'YoutubeMusic-Player v1.0.0',
      },
    });

    if (!response.ok) {
        return { plainLyrics: null, syncedLyrics: null };
    }

    const data: LRCLIBResponse = await response.json();
    
    return {
      plainLyrics: data.plainLyrics || null,
      syncedLyrics: data.syncedLyrics || null,
    };
  } catch (error) {
    console.error('[LYRICS] Error en lrclib.net:', error);
    return { plainLyrics: null, syncedLyrics: null };
  }
};

/**
 * Búsqueda por palabras clave cuando fallan los métodos anteriores
 * Intenta ambos servicios: lrclib.net y YouTube Music
 */
const searchLyricsByKeywords = async (title: string, artist: string): Promise<{
  plainLyrics: string | null;
  syncedLyrics: string | null;
}> => {
  try {
    // Preparar los términos de búsqueda
    // Si el título tiene múltiples palabras, usar solo las primeras 2-3 palabras importantes
    let searchTitle = title;
    if (title.split(' ').length > 3) {
      searchTitle = title.split(' ').slice(0, 3).join(' ');
    }
    
    // Usar solo el nombre principal del artista (1-2 palabras)
    let searchArtist = artist;
    if (artist.split(' ').length > 2) {
      searchArtist = artist.split(' ').slice(0, 2).join(' ');
    }
    
    // Formar una consulta de búsqueda general
    const q = `${searchTitle} ${searchArtist}`;
    
    console.log(`[LYRICS] Búsqueda por keywords en lrclib.net: "${q}"`);
    
    // 4.1 Intentar con lrclib.net por palabras clave
    try {
      const response = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, {
      headers: {
        'Lrclib-Client': 'YoutubeMusic-Player v1.0.0',
      },
    });
    
      if (response.ok) {
        const results: LRCLIBResponse[] = await response.json();
        
        if (results && results.length > 0) {
          const firstResult = results[0];
          
          console.log(`[LYRICS] Se encontró resultado por keywords en lrclib.net: "${firstResult.trackName}" por "${firstResult.artistName}"`);
          
          return {
            plainLyrics: firstResult.plainLyrics || null,
            syncedLyrics: firstResult.syncedLyrics || null,
          };
        }
      }
    } catch (err) {
      console.error('[LYRICS] Error en búsqueda por keywords en lrclib.net:', err);
    }
    
    // 4.2 Último intento: YouTube Music con palabras aún más simplificadas
    console.log(`[LYRICS] Intento final con YouTube Music: "${searchTitle.split(' ')[0]}" / "${searchArtist.split(' ')[0]}"`);
    
    // Usar solo la primera palabra del título y artista como último recurso
    const lastResortTitle = searchTitle.split(' ')[0];
    const lastResortArtist = searchArtist.split(' ')[0];
    
    return await getYouTubeMusicLyrics(lastResortTitle, lastResortArtist);
  } catch (error) {
    console.error('[LYRICS] Error final en búsqueda de letras:', error);
    return { plainLyrics: null, syncedLyrics: null };
  }
};

/**
 * Obtiene letras de una canción usando la API de YouTube Music
 * 
 * @param title Título de la canción
 * @param artist Nombre del artista
 * @returns Objeto con letras planas y/o sincronizadas
 */
const getYouTubeMusicLyrics = async (title: string, artist: string): Promise<{
  plainLyrics: string | null;
  syncedLyrics: string | null;
}> => {
  try {
    console.log(`[LYRICS] Buscando letras en YouTube Music: "${title}" por "${artist}"`);
    
    // Primero necesitamos obtener el browseId para la canción a través de una búsqueda en YouTube Music
    // Paso 1: Buscar la canción en YouTube Music para obtener el videoId
    const searchResponse = await fetch(`${NODE_SERVER_URL}/youtube/search?query=${encodeURIComponent(title + ' ' + artist)}&filter=songs&limit=1`);
    
    if (!searchResponse.ok) {
      console.error('[LYRICS] Error al buscar en YouTube Music:', searchResponse.status);
      return { plainLyrics: null, syncedLyrics: null };
    }
    
    const searchResults = await searchResponse.json();
    
    if (!searchResults || !searchResults.length || !searchResults[0].videoId) {
      console.log('[LYRICS] No se encontraron resultados en YouTube Music');
      return { plainLyrics: null, syncedLyrics: null };
    }
    
    const videoId = searchResults[0].videoId;
    console.log(`[LYRICS] Video encontrado en YouTube Music (ID: ${videoId})`);
    
    // Paso 2: Obtener la playlist de reproducción que contiene el browseId de letras
    const watchPlaylistResponse = await fetch(`${NODE_SERVER_URL}/youtube/get-watch-playlist?videoId=${videoId}`);
    
    if (!watchPlaylistResponse.ok) {
      console.error('[LYRICS] Error al obtener la playlist de reproducción:', watchPlaylistResponse.status);
      return { plainLyrics: null, syncedLyrics: null };
    }
    
    const watchPlaylistData = await watchPlaylistResponse.json();
    
    // El watchPlaylist debería contener un browseId para letras (comienza con "MPLYT")
    if (!watchPlaylistData || !watchPlaylistData.lyrics || !watchPlaylistData.lyrics.browseId) {
      console.log('[LYRICS] No se encontró browseId de letras en la respuesta');
      return { plainLyrics: null, syncedLyrics: null };
    }
    
    const lyricsBrowseId = watchPlaylistData.lyrics.browseId;
    console.log(`[LYRICS] BrowseId de letras encontrado: ${lyricsBrowseId}`);
    
    // Paso 3: Obtener letras con timestamps si es posible
    const lyricsResponse = await fetch(`${NODE_SERVER_URL}/youtube/get-lyrics?browseId=${lyricsBrowseId}&timestamps=true`);
    
    if (!lyricsResponse.ok) {
      console.error('[LYRICS] Error al obtener letras:', lyricsResponse.status);
      return { plainLyrics: null, syncedLyrics: null };
    }
    
    const lyricsData: YTMusicLyrics = await lyricsResponse.json();
    
    // Procesar las letras según el formato (con o sin timestamps)
    if (lyricsData.hasTimestamps && Array.isArray(lyricsData.lyrics)) {
      // Convertir las letras con timestamps al formato LRC
      const syncedLines = (lyricsData.lyrics as LyricLine[]).map(line => {
        const time = line.start_time / 1000; // Convertir a segundos
        const minutes = Math.floor(time / 60);
        const seconds = (time % 60).toFixed(2);
        // Formato [mm:ss.xx]
        return `[${String(minutes).padStart(2, '0')}:${seconds.padStart(5, '0')}]${line.text}`;
      });
      
      const syncedLyrics = syncedLines.join('\n');
      
      // También crear una versión de texto plano
      const plainLyrics = (lyricsData.lyrics as LyricLine[]).map(line => line.text).join('\n');
      
      console.log('[LYRICS] Letras sincronizadas obtenidas de YouTube Music');
      
      return {
        plainLyrics,
        syncedLyrics
      };
    } else if (typeof lyricsData.lyrics === 'string') {
      // Solo hay letras de texto plano
      console.log('[LYRICS] Letras planas obtenidas de YouTube Music');
    
    return {
        plainLyrics: lyricsData.lyrics,
        syncedLyrics: null
    };
    }
    
    return { plainLyrics: null, syncedLyrics: null };
  } catch (error) {
    console.error('[LYRICS] Error al obtener letras de YouTube Music:', error);
    return { plainLyrics: null, syncedLyrics: null };
  }
};

/**
 * Convierte el formato de letras sincronizadas LRC a un array de objetos
 * con tiempo y texto para facilitar la sincronización
 */
export const parseSyncedLyrics = (syncedLyrics: string | null): Array<{time: number, text: string}> => {
  if (!syncedLyrics) return [];
  
  const lines = syncedLyrics.split('\n');
  const result = [];
  
  // Regex para extraer los tiempos [mm:ss.xx]
  const timeRegex = /\[(\d+):(\d+\.\d+)\]/;
  
  for (const line of lines) {
    const match = timeRegex.exec(line);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseFloat(match[2]);
      const time = minutes * 60 + seconds;
      
      // Extraer el texto después del timestamp
      const text = line.replace(timeRegex, '').trim();
      
      result.push({ time, text });
    }
  }
  
  return result.sort((a, b) => a.time - b.time);
}; 