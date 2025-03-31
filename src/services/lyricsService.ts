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

/**
 * Sanitizar texto para búsqueda de letras
 * Elimina caracteres especiales, remix, feat, etc.
 */
const sanitizeLyricsSearchText = (text: string): string => {
  if (!text) return '';
  
  return text
    .replace(/\([^)]*\)/g, '') // Eliminar texto entre paréntesis (feat, remix, etc)
    .replace(/\[[^\]]*\]/g, '') // Eliminar texto entre corchetes
    .replace(/feat\.|ft\./gi, '') // Eliminar feat. o ft.
    .replace(/remix|version|edit|extended|original/gi, '') // Eliminar palabras comunes en remixes
    .replace(/\s+/g, ' ') // Reemplazar múltiples espacios con uno solo
    .trim(); // Eliminar espacios al inicio y final
};

/**
 * Servicio para obtener letras sincronizadas desde la API de LRCLIB
 * Con manejo silencioso de errores para evitar mensajes en consola
 */
export const getLyrics = async (track: Track): Promise<{
  plainLyrics: string | null;
  syncedLyrics: string | null;
}> => {
  try {
    // Sanitizar los parámetros de búsqueda
    const trackName = sanitizeLyricsSearchText(track.title);
    const artistName = sanitizeLyricsSearchText(track.artist);
    const albumName = track.album ? sanitizeLyricsSearchText(track.album) : '';
    
    // Verificar que tenemos datos suficientes para buscar
    if (!trackName || !artistName) {
      return { plainLyrics: null, syncedLyrics: null };
    }
    
    // Construir la URL con los parámetros necesarios
    const params = new URLSearchParams({
      track_name: trackName,
      artist_name: artistName,
    });

    // Añadir parámetros opcionales si están disponibles
    if (albumName) {
      params.append('album_name', albumName);
    }
    if (track.duration) {
      params.append('duration', Math.min(track.duration, 60 * 5 * 1000).toString()); // Limitar a 5 minutos máximo
    }

    // Llamar a la API de LRCLIB con tiempo de espera
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos de timeout
    
    try {
      const response = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
        headers: {
          'Lrclib-Client': 'YoutubeMusic-Player v1.0.0',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
  
      if (!response.ok) {
        if (response.status === 404 || response.status === 400) {
          // Intentar una búsqueda simplificada con menos parámetros solo si es 400
          if (response.status === 400) {
            const simpleParams = new URLSearchParams({
              track_name: trackName.split(' ').slice(0, 2).join(' '), // Solo primeras palabras
              artist_name: artistName.split(' ')[0], // Solo primer nombre
            });
            
            try {
              const retryResponse = await fetch(`https://lrclib.net/api/get?${simpleParams.toString()}`, {
                headers: {
                  'Lrclib-Client': 'YoutubeMusic-Player v1.0.0',
                },
              });
              
              if (!retryResponse.ok) {
                return { plainLyrics: null, syncedLyrics: null };
              }
              
              const data: LRCLIBResponse = await retryResponse.json();
              return {
                plainLyrics: data.plainLyrics || null,
                syncedLyrics: data.syncedLyrics || null,
              };
            } catch (retryError) {
              return { plainLyrics: null, syncedLyrics: null };
            }
          }
          
          // Si es 404 o cualquier otro error en el retry
          return { plainLyrics: null, syncedLyrics: null };
        }
        
        // Otro tipo de error, responder con valores nulos
        return { plainLyrics: null, syncedLyrics: null };
      }
  
      const data: LRCLIBResponse = await response.json();
      
      return {
        plainLyrics: data.plainLyrics || null,
        syncedLyrics: data.syncedLyrics || null,
      };
    } catch (fetchError) {
      // Capturar errores de red o timeout
      clearTimeout(timeoutId);
      return { plainLyrics: null, syncedLyrics: null };
    }
  } catch (error) {
    // Error general, responder con valores nulos
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