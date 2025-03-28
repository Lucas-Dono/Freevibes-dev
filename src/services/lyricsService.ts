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
 * Servicio para obtener letras sincronizadas desde la API de LRCLIB
 */
export const getLyrics = async (track: Track): Promise<{
  plainLyrics: string | null;
  syncedLyrics: string | null;
}> => {
  try {
    // Construir la URL con los parámetros necesarios
    const params = new URLSearchParams({
      track_name: track.title,
      artist_name: track.artist,
    });

    // Añadir parámetros opcionales si están disponibles
    if (track.album) {
      params.append('album_name', track.album);
    }
    if (track.duration) {
      params.append('duration', track.duration.toString());
    }

    // Llamar a la API de LRCLIB
    const response = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      headers: {
        'Lrclib-Client': 'YoutubeMusic-Player v1.0.0',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`No se encontraron letras para: ${track.title} - ${track.artist}`);
        return { plainLyrics: null, syncedLyrics: null };
      }
      throw new Error(`Error al obtener letras: ${response.statusText}`);
    }

    const data: LRCLIBResponse = await response.json();
    
    return {
      plainLyrics: data.plainLyrics || null,
      syncedLyrics: data.syncedLyrics || null,
    };
  } catch (error) {
    console.error('Error al obtener letras:', error);
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