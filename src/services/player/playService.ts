// Servicio universal para reproducción de música
// Este servicio centraliza la lógica de reproducción para todas las páginas de la aplicación

import { Track } from '@/contexts/PlayerContext';
import { executeWithPriority, OperationType } from '../youtube/youtube-api-priority';
import { apiKeyManager } from '../youtube/youtube-api-keys';

// Mapeo de fallback por si falla completamente la búsqueda en YouTube
const demoYoutubeIds: Record<string, string> = {
  // Usamos una canción general como fallback predeterminado, no "Never Gonna Give You Up"
  'default': 'JGwWNGJdvx8', // Ed Sheeran - Shape of You como fallback universal
  'bad bunny': 'TmKh7lAwnBI',
  'taylor swift': '6DP4q_1EgQQ',
  'billie eilish': 'Fvj6PE3gN4o',
  'bts': '5Wn85Ge22FQ',
  'arctic monkeys': 'bpOSxM0rNPM',
  'dua lipa': '8EJ-vZyBzOQ',
  'ed sheeran': 'JGwWNGJdvx8',
  'harry styles': 'H5v3kku4y6Q',
  'the weeknd': '4NRXx6U8ABQ',
  'lady gaga': 'bo_efYhYU2A',
  'justin bieber': 'DK_0jXPuIr0',
  'travis scott': 'ttVwq4J88YE',
  'olivia rodrigo': 'ZmDBbnmKpqQ',
  'post malone': 'wXhTHyIgQ_U',
  'bruno mars': 'PMivT7MJ41M',
  'drake': 'b8M6N0FTpNc',
  'ariana grande': 'QYh6mYIJG2Y',
  // Añadir más artistas en español e italiano
  'rosalía': '6M6TKG-jH-Q',
  'c tangana': 'OEQZ9Up1uVM',
  'j balvin': 'LjxulQ1bEWg',
  'rauw alejandro': 'mIMAv9tagxw',
  'bad gyal': 'lBR6vXeZA0Y',
  'quevedo': 'wbzBniWvQg4',
  'maneskin': 'RLXOYcmZ1IO',
  'eros ramazzotti': 'I1Xp4H0p4WQ',
  'laura pausini': 'vEVq2MIhYMM',
  // Añadir fallbacks por géneros
  'pop': 'JGwWNGJdvx8',    // Ed Sheeran - Shape of You
  'rock': 'fJ9rUzIMcZQ',   // Queen - Bohemian Rhapsody
  'rap': 'yvHYWnxrpG8',    // Eminem - Lose Yourself
  'latino': '47YClVMlthI', // Daddy Yankee - Gasolina
  'indie': 'SN4MLMHPBW0',  // The Killers - Mr. Brightside
  'electronica': 'LsFrfvjurmE', // Avicii - Levels
  'r&b': 'DU6ApL84qnc',   // The Weeknd - Blinding Lights
  'k-pop': 'gdZLi9oWNZg',  // BTS - Dynamite
};

/**
 * Busca un ID de YouTube basado en palabras clave del título y artista
 * @param title - Título de la canción
 * @param artist - Nombre del artista
 * @returns Un ID de YouTube del mapeo de demo o el ID por defecto
 */
const findDemoYoutubeId = (title: string, artist: string): string => {
  // Convertir título y artista a minúsculas para búsqueda insensible a mayúsculas
  const searchString = (title + ' ' + artist).toLowerCase();

  // Buscar en el mapeo de canciones populares
  for (const [keyword, youtubeId] of Object.entries(demoYoutubeIds)) {
    if (searchString.includes(keyword)) {
      console.log(`[PlayService] Encontrado ID de YouTube de demo para "${title} - ${artist}": ${youtubeId}`);
      return youtubeId;
    }
  }

  // Si no encontramos una coincidencia específica, usar el ID por defecto
  console.log(`[PlayService] Usando ID de YouTube por defecto para "${title} - ${artist}"`);
  return demoYoutubeIds.default;
};

/**
 * Busca una canción en YouTube por su título y artista
 * @param title - Título de la canción
 * @param artist - Nombre del artista
 * @returns Objeto con la información del video de YouTube
 */
const searchYouTube = async (title: string, artist: string): Promise<any> => {
  if (!title || !artist) {
    console.error('[PlayService - searchYouTube] Título o artista vacío, cancelando búsqueda.', { title, artist });
    throw new Error('Título o artista vacío para la búsqueda en YouTube');
  }

  try {
    // Normalizar la consulta para mejorar resultados
    const cleanTitle = title.trim().replace(/\(.*?\)|\[.*?\]/g, '').trim();
    const cleanArtist = artist.trim();

    // Crear la consulta con formato: "título artista audio"
    // Quitar "official" puede dar más resultados a veces, aunque "official audio" suele ser bueno.
    // Probemos sin "official" primero.
    const query = `${cleanTitle} ${cleanArtist} audio`;
    console.log(`[PlayService] Buscando en YouTube: "${query}"`);

    // Usar la clave API dedicada para reproducción
    return await apiKeyManager.withApiKey(
      async (apiKey, cacheKey) => {
        // Aumentar el límite para tener más opciones en caso de que la primera no funcione
        const response = await fetch(`/api/youtube/search?query=${encodeURIComponent(query)}&filter=songs&limit=3&api_key=${apiKey}`);

        if (!response.ok) {
          throw new Error(`Error en API de YouTube: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`[PlayService] Resultados de búsqueda: ${data.length || 0} elementos`);

        if (Array.isArray(data) && data.length > 0) {
          // Filtrar resultados que contienen "karaoke", "cover", "live" o "remix"
          // a menos que esas palabras estén en el título original
          const filteredResults = data.filter((result: any) => {
            const resultTitle = (result.title || '').toLowerCase();
            const isKaraoke = resultTitle.includes('karaoke') && !cleanTitle.toLowerCase().includes('karaoke');
            const isCover = resultTitle.includes('cover') && !cleanTitle.toLowerCase().includes('cover');
            const isLive = resultTitle.includes('live') && !cleanTitle.toLowerCase().includes('live');
            const isRemix = resultTitle.includes('remix') && !cleanTitle.toLowerCase().includes('remix');

            return !(isKaraoke || isCover || isLive || isRemix);
          });

          if (filteredResults.length > 0) {
            console.log(`[PlayService] Usando resultado filtrado: "${filteredResults[0].title}"`);
            return filteredResults[0];
          }

          // Si no hay resultados filtrados, usar el primer resultado original
          console.log(`[PlayService] Usando primer resultado sin filtrar: "${data[0].title}"`);
          return data[0];
        } else {
          console.error('[PlayService] No se encontraron resultados para la consulta:', query);
          throw new Error('No se encontraron resultados en YouTube');
        }
      },
      `search_play_${cleanTitle}_${cleanArtist}`,
      true // Indicar que es para reproducción de música
    );
  } catch (error) {
    console.error('[PlayService] Error buscando en YouTube:', error);

    // Intentar una búsqueda alternativa con menos palabras
    try {
      console.log('[PlayService] Intentando búsqueda alternativa con menos términos...');
      const simpleQuery = `${title.split(' ').slice(0, 2).join(' ')} ${artist.split(' ')[0]}`;

      return await apiKeyManager.withApiKey(
        async (apiKey) => {
          const response = await fetch(`/api/youtube/search?query=${encodeURIComponent(simpleQuery)}&filter=songs&limit=1&api_key=${apiKey}`);

          if (!response.ok) {
            throw new Error(`Error en API alternativa: ${response.status}`);
          }

          const data = await response.json();

          if (Array.isArray(data) && data.length > 0) {
            console.log(`[PlayService] Resultado alternativo encontrado: "${data[0].title}"`);
            return data[0];
          } else {
            throw new Error('No se encontraron resultados en búsqueda alternativa');
          }
        },
        `search_alt_${simpleQuery}`,
        true
      );
    } catch (altError) {
      console.error('[PlayService] Búsqueda alternativa también falló:', altError);
      throw error; // Lanzar el error original
    }
  }
};

/**
 * Función universal para reproducir una pista, independientemente de la fuente
 * @param track - La pista a reproducir, puede ser de varios formatos
 */
export const playTrack = async (track: any): Promise<void> => {
  try {
    // Normalizar los datos de la pista
    let normalizedTrack: Track;

    // Verificar si estamos en modo demo (mejorando la detección)
    const isInDemoMode =
      document.cookie.includes('demo-mode=true') ||
      document.cookie.includes('demoMode=true') ||
      window.location.href.includes('demo=true') ||
      localStorage.getItem('demoMode') === 'true';

    // Eliminar el forzado de modo demo para la versión final
    const forceDemo = false;

    console.log(`[PlayService] Modo demo detectado: ${isInDemoMode} (Cookies: ${document.cookie})`);

    // Si ya recibimos un objeto Track formateado (como en la página de búsqueda)
    if (track.youtubeId && track.title) {
      normalizedTrack = {
        id: track.id || track.youtubeId,
        title: track.title || track.name || '',
        artist: track.artist || (track.artists?.map((a: any) => a.name).join(', ')) || '',
        album: track.album || '',
        cover: track.cover || track.thumbnail || (track.album?.images?.[0]?.url) || '/placeholder-album.jpg',
        duration: track.duration || (track.duration_ms ? track.duration_ms / 1000 : 0),
        youtubeId: track.youtubeId || track.videoId || track.id,
        source: track.source || 'youtube'
      };

      // Disparar evento para reproducir la pista directamente
      const event = new CustomEvent('playTrack', { detail: normalizedTrack });
      window.dispatchEvent(event);
      return;
    }

    // Si recibimos un objeto en formato Spotify (como en la biblioteca o álbum)
    if (track.artists && (track.id || track.uri)) {
      const trackId = track.id || (track.uri ? track.uri.split(':').pop() : '');
      const artistNames = track.artists.map((a: any) => a.name).join(', ');
      const trackTitle = track.title || track.name || '';

      if (!trackTitle) {
        console.error('[PlayService] Error: No se pudo determinar el título de la canción para la búsqueda.', track);
        return;
      }

      console.log(`[PlayService] Procesando canción: "${trackTitle}" por "${artistNames}"`);

      try {
        let youtubeId = '';
        let youtubeThumbnail = '';
        let youtubeTitle = '';

        // Determinar qué método usar según el modo
        if (isInDemoMode || forceDemo) {
          try {
            console.log(`[PlayService] Buscando en YouTube directamente (modo demo): "${trackTitle} ${artistNames}"`);
            // Buscar la canción en YouTube
            const youtubeResult = await searchYouTube(trackTitle, artistNames);

            // ---> Log para depurar la estructura del resultado seleccionado
            console.log('[PlayService] Resultado seleccionado de searchYouTube:', JSON.stringify(youtubeResult, null, 2));

            youtubeId = youtubeResult.id || youtubeResult.videoId;
            youtubeThumbnail = youtubeResult.thumbnail || '';
            youtubeTitle = youtubeResult.title || trackTitle;

            if (!youtubeId) {
              throw new Error('ID de YouTube no encontrado');
            }

            console.log(`[PlayService] Encontrado en YouTube: "${youtubeTitle}" (ID: ${youtubeId})`);
          } catch (youtubeError) {
            console.error('[PlayService] Error buscando en YouTube, usando fallback:', youtubeError);
            youtubeId = findDemoYoutubeId(trackTitle, artistNames);
            console.log(`[PlayService] Usando ID de fallback: ${youtubeId}`);
          }
        } else {
          // En modo normal, usar la API de Spotify
          console.log(`[PlayService] Usando API de Spotify (modo normal) para "${trackTitle}"`);
          try {
            const response = await fetch('/api/spotify/play', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                trackId: trackId,
                name: trackTitle,
                artist: artistNames
              }),
            });

            if (!response.ok) {
              throw new Error(`Error al reproducir canción: ${response.status}`);
            }

            const data = await response.json();
            youtubeId = data.videoId;

            if (!youtubeId) {
              throw new Error('No se encontró video en YouTube');
            }

            console.log(`[PlayService] API de Spotify devolvió YouTube ID: ${youtubeId}`);
          } catch (spotifyError) {
            console.error('[PlayService] Error en API de Spotify, intentando directamente con YouTube:', spotifyError);

            // Si falla Spotify, intentar búsqueda directa en YouTube como fallback
            try {
              const youtubeResult = await searchYouTube(trackTitle, artistNames);
              youtubeId = youtubeResult.videoId;
              youtubeThumbnail = youtubeResult.thumbnail || '';
              youtubeTitle = youtubeResult.title || trackTitle;

              if (!youtubeId) {
                throw new Error('Fallback: ID de YouTube no encontrado');
              }
            } catch (fallbackError) {
              console.error('[PlayService] Error en fallback de YouTube, usando ID predefinido:', fallbackError);
              youtubeId = findDemoYoutubeId(trackTitle, artistNames);
            }
          }
        }

        // Crear el objeto normalizado
        normalizedTrack = {
          id: trackId,
          title: youtubeTitle || trackTitle,
          artist: artistNames,
          album: track.album?.name || '',
          cover: youtubeThumbnail || track.album?.images?.[0]?.url || '/placeholder-album.jpg',
          duration: track.duration_ms ? track.duration_ms / 1000 : 0,
          youtubeId: youtubeId,
          source: isInDemoMode ? 'youtube' : 'spotify'
        };

        console.log(`[PlayService] Enviando track para reproducción:`, normalizedTrack);

        // Disparar evento para reproducir la pista
        const event = new CustomEvent('playTrack', { detail: normalizedTrack });
        window.dispatchEvent(event);
      } catch (error) {
        console.error('[PlayService] Error en reproducción:', error);

        // Si hay un error, intentar usando la búsqueda de YouTube o el fallback
        try {
          console.log('[PlayService] Intentando fallback para reproducción');
          // Intentar buscar en YouTube una última vez con un enfoque diferente
          try {
            // Intentar con una búsqueda más general
            const generalQuery = `${trackTitle} ${artistNames.split(' ')[0]} audio`;
            console.log(`[PlayService] Intentando búsqueda general: "${generalQuery}"`);

            const response = await fetch(`/api/youtube/search?query=${encodeURIComponent(generalQuery)}&filter=songs&limit=1`);

            if (response.ok) {
              const data = await response.json();

              if (Array.isArray(data) && data.length > 0) {
                console.log(`[PlayService] Resultado de búsqueda general:`, data[0]);

                const fallbackTrack = {
                  id: trackId,
                  title: data[0].title || trackTitle,
                  artist: artistNames,
                  album: track.album?.name || '',
                  cover: data[0].thumbnail || track.album?.images?.[0]?.url || '/placeholder-album.jpg',
                  duration: track.duration_ms ? track.duration_ms / 1000 : 0,
                  youtubeId: data[0].videoId,
                  source: 'youtube-fallback'
                };

                console.log('[PlayService] Usando track de fallback:', fallbackTrack);
                const event = new CustomEvent('playTrack', { detail: fallbackTrack });
                window.dispatchEvent(event);
                return;
              }
            }

            throw new Error('No se encontraron resultados en búsqueda general');
          } catch (generalError) {
            console.error('[PlayService] Error en búsqueda general:', generalError);

            // Si falla la búsqueda general, usar el fallback predefinido
            const fallbackYoutubeId = findDemoYoutubeId(trackTitle, artistNames);

            const fallbackTrack = {
              id: trackId,
              title: trackTitle,
              artist: artistNames,
              album: track.album?.name || '',
              cover: track.album?.images?.[0]?.url || '/placeholder-album.jpg',
              duration: track.duration_ms ? track.duration_ms / 1000 : 0,
              youtubeId: fallbackYoutubeId,
              source: 'fallback'
            };

            console.log('[PlayService] Usando fallback final:', fallbackTrack);
            const event = new CustomEvent('playTrack', { detail: fallbackTrack });
            window.dispatchEvent(event);
          }
        } catch (finalError) {
          console.error('[PlayService] Error fatal en reproducción de fallback:', finalError);
          // Usar el fallback final con ID predefinido
          const defaultTrack = {
            id: 'default-track',
            title: trackTitle || 'Canción',
            artist: artistNames || 'Artista',
            album: track.album?.name || 'Álbum',
            cover: track.album?.images?.[0]?.url || '/placeholder-album.jpg',
            duration: track.duration_ms ? track.duration_ms / 1000 : 180,
            youtubeId: demoYoutubeIds.default,
            source: 'ultimate-fallback'
          };

          console.log('[PlayService] Usando fallback de último recurso:', defaultTrack);
          const event = new CustomEvent('playTrack', { detail: defaultTrack });
          window.dispatchEvent(event);
        }
      }
      return;
    }

    // Para otros formatos desconocidos, intentar con un método genérico
    console.warn('Formato de pista no reconocido, intentando método genérico', track);

    // Intentar extraer información básica
    const trackId = track.id || track.videoId || track.uri || 'unknown';
    const title = track.title || track.name || 'Desconocido';
    const artist = track.artist || (track.artists?.[0]?.name) || '';

    // En modo demo buscar directamente en YouTube, en modo normal intentar primero Spotify
    if (isInDemoMode) {
      try {
        // Buscar la canción en YouTube
        console.log(`[PlayService] Buscando formato genérico en YouTube (modo demo): "${title} ${artist}"`);
        const youtubeResult = await searchYouTube(title, artist);

        normalizedTrack = {
          id: trackId,
          title: youtubeResult.title || title,
          artist: artist,
          album: track.album?.name || '',
          cover: youtubeResult.thumbnail || track.cover || track.thumbnail || '/placeholder-album.jpg',
          duration: track.duration || (track.duration_ms ? track.duration_ms / 1000 : 0),
          youtubeId: youtubeResult.videoId,
          source: 'youtube'
        };

        console.log('[PlayService] Reproduciendo formato genérico:', normalizedTrack);
        const event = new CustomEvent('playTrack', { detail: normalizedTrack });
        window.dispatchEvent(event);
        return;
      } catch (youtubeError) {
        console.error('[PlayService] Error en búsqueda directa de YouTube, usando fallback:', youtubeError);

        // Usar ID predefinido como fallback
        const demoYoutubeId = findDemoYoutubeId(title, artist);

        normalizedTrack = {
          id: trackId,
          title: title,
          artist: artist,
          album: track.album?.name || '',
          cover: track.cover || track.thumbnail || track.album?.images?.[0]?.url || '/placeholder-album.jpg',
          duration: track.duration || (track.duration_ms ? track.duration_ms / 1000 : 0),
          youtubeId: demoYoutubeId,
          source: 'demo-fallback'
        };

        console.log('[PlayService] Reproduciendo fallback para formato genérico:', normalizedTrack);
        const event = new CustomEvent('playTrack', { detail: normalizedTrack });
        window.dispatchEvent(event);
        return;
      }
    } else {
      // En modo normal, intentar primero buscar con Spotify API
      try {
        console.log(`[PlayService] Buscando en Spotify API (modo normal): "${title} by ${artist}"`);
        const response = await fetch('/api/spotify/play', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            trackId: trackId,
            name: title,
            artist: artist
          }),
        });

        if (!response.ok) {
          throw new Error(`Error en API de Spotify: ${response.status}`);
        }

        const data = await response.json();
        if (data.videoId) {
          normalizedTrack = {
            id: trackId,
            title: title,
            artist: artist,
            album: track.album?.name || '',
            cover: track.cover || track.thumbnail || track.album?.images?.[0]?.url || '/placeholder-album.jpg',
            duration: track.duration || (track.duration_ms ? track.duration_ms / 1000 : 0),
            youtubeId: data.videoId,
            source: 'spotify'
          };

          // Disparar evento para reproducir la pista
          console.log('[PlayService] Reproduciendo usando Spotify API:', normalizedTrack);
          const event = new CustomEvent('playTrack', { detail: normalizedTrack });
          window.dispatchEvent(event);
          return;
        } else {
          throw new Error('No se encontró un ID de YouTube en la respuesta');
        }
      } catch (spotifyError) {
        console.error('[PlayService] Error en Spotify API, intentando YouTube:', spotifyError);

        // Si falla Spotify, intentar con YouTube como fallback
        try {
          const youtubeResult = await searchYouTube(title, artist);

          normalizedTrack = {
            id: trackId,
            title: youtubeResult.title || title,
            artist: artist,
            album: track.album?.name || '',
            cover: youtubeResult.thumbnail || track.cover || track.thumbnail || '/placeholder-album.jpg',
            duration: track.duration || (track.duration_ms ? track.duration_ms / 1000 : 0),
            youtubeId: youtubeResult.videoId,
            source: 'youtube-fallback'
          };

          console.log('[PlayService] Reproduciendo fallback YouTube (modo normal):', normalizedTrack);
          const event = new CustomEvent('playTrack', { detail: normalizedTrack });
          window.dispatchEvent(event);
          return;
        } catch (finalError) {
          console.error('[PlayService] Error total, usando ID predefinido:', finalError);

          // Si todo falla, usar ID predefinido como último recurso
          const fallbackYoutubeId = findDemoYoutubeId(title, artist);

          normalizedTrack = {
            id: trackId,
            title: title,
            artist: artist,
            album: track.album?.name || '',
            cover: track.cover || track.thumbnail || track.album?.images?.[0]?.url || '/placeholder-album.jpg',
            duration: track.duration || (track.duration_ms ? track.duration_ms / 1000 : 0),
            youtubeId: fallbackYoutubeId,
            source: 'last-resort'
          };

          console.log('[PlayService] Último recurso de reproducción:', normalizedTrack);
          const event = new CustomEvent('playTrack', { detail: normalizedTrack });
          window.dispatchEvent(event);
          return;
        }
      }
    }

    // Código de respaldo final - no debería llegarse a este punto con los cambios anteriores
    console.warn('[PlayService] Llegando a código de respaldo final (no debería suceder)');
    const fallbackYoutubeId = track.youtubeId || track.videoId || findDemoYoutubeId(title, artist);

    normalizedTrack = {
      id: trackId,
      title: title,
      artist: artist,
      album: track.album?.name || '',
      cover: track.cover || track.thumbnail || track.album?.images?.[0]?.url || '/placeholder-album.jpg',
      duration: track.duration || (track.duration_ms ? track.duration_ms / 1000 : 0),
      youtubeId: fallbackYoutubeId,
      source: track.source || 'fallback'
    };

    console.log('[PlayService] Usando fallback final absoluto');
    const event = new CustomEvent('playTrack', { detail: normalizedTrack });
    window.dispatchEvent(event);
  } catch (error) {
    console.error('Error en el servicio de reproducción:', error);

    // Intentar una última reproducción de fallback en caso de error general
    try {
      const fallbackTrack = {
        id: 'fallback-track',
        title: 'Música de Fallback',
        artist: 'Sistema',
        album: 'Fallback',
        cover: '/placeholder-album.jpg',
        duration: 180,
        youtubeId: demoYoutubeIds.default, // Usar el ID por defecto
        source: 'fallback'
      };

      console.log('[PlayService] Usando track de emergencia por error general');
      const event = new CustomEvent('playTrack', { detail: fallbackTrack });
      window.dispatchEvent(event);
    } catch (finalError) {
      console.error('Error grave en reproducción de fallback:', finalError);
      alert('No se pudo reproducir la música. Por favor, intenta más tarde.');
    }
  }
};

export default {
  playTrack
};
