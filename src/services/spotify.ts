// Importar el sistema de throttling
import { withThrottle } from '@/lib/request-throttler';
import { throttleApiCalls, ThrottleOptions } from '@/lib/api-throttle';

// Variable global para controlar el modo demo
let IS_DEMO_MODE = false;
let DEMO_LANGUAGE = 'es';

/**
 * Configura el modo demo para el servicio de Spotify
 * @param isDemo Si el usuario está en modo demo o no
 * @param language Idioma para los datos de demo (opcional, por defecto 'es')
 */
export function setDemoMode(isDemo: boolean, language: string = 'es'): void {
  console.log(`[Spotify Service] Configurando modo demo: ${isDemo}${isDemo ? `, idioma: ${language}` : ''}`);
  IS_DEMO_MODE = isDemo;
  DEMO_LANGUAGE = language;
}

/**
 * Obtiene si el modo demo está activado
 * @returns true si el modo demo está activado
 */
export function isDemoMode(): boolean {
  return IS_DEMO_MODE;
}

/**
 * Obtiene el idioma configurado para el modo demo
 * @returns Código de idioma (ej: 'es', 'en')
 */
export function getDemoLanguage(): string {
  return DEMO_LANGUAGE;
}

// Configuración de throttling adaptativo para Spotify API
const spotifyThrottleOptions: ThrottleOptions = {
  initialDelay: 150, // 150ms entre llamadas por defecto
  maxDelay: 2000, // Máximo 2 segundos entre llamadas
  adaptiveMode: true, // Ajustar dinámicamente basado en respuestas
  errorMultiplier: 1.5, // Aumentar delay x1.5 cuando hay errores
  maxRetries: 3 // Máximo número de reintentos por llamada
};

// Función helper para obtener la URL base de la API
function getApiBaseUrl() {
  // Usar la variable de entorno definida en el archivo .env de la raíz
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return `${process.env.NEXT_PUBLIC_APP_URL}/api`;
  }

  // Si no está definida la variable de entorno, usar el puerto actual del navegador
  if (typeof window !== 'undefined' && window.location) {
    // Obtener el puerto actual del navegador
    const currentPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
    // Construir la URL base con el puerto actual
    return `${window.location.protocol}//${window.location.hostname}:${currentPort}/api`;
  }

  // Valor por defecto
  return '/api';
}

/**
 * Comprueba si un texto parece ser un título de canción y no un género
 * @param text Texto a verificar
 * @returns true si parece ser un título de canción
 */
function isSongTitle(text: string): boolean {
  // Un título de canción típicamente:
  // 1. Contiene más de una palabra
  // 2. Puede contener caracteres como ' ! ? , .
  // 3. A menudo incluye el nombre del artista

  // Verificar si tiene formato "Canción - Artista" o "Artista - Canción"
  if (text.includes(' - ')) return true;

  // Verificar si tiene caracteres típicos de títulos
  if (/['",!?().]/.test(text)) return true;

  // Verificar si tiene más de 3 palabras (probablemente no es un género)
  if (text.split(' ').length > 3) return true;

  // Si tiene palabras comunes de títulos
  const songWords = ['love', 'heart', 'baby', 'you', 'me', 'we', 'night', 'day', 'life', 'song'];
  if (songWords.some(word => text.toLowerCase().includes(word))) return true;

  return false;
}

// Función auxiliar para obtener el país del usuario
async function getUserCountry(): Promise<string> {
  // Intentar obtener país del navegador si está disponible
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      const languageParts = navigator.language.split('-');
      if (languageParts.length > 1) {
        return languageParts[1].toUpperCase();
      }
    }
  } catch (e) {
    console.error('Error al obtener país del usuario:', e);
  }

  // País por defecto
  return 'ES';
}

// Función auxiliar para realizar peticiones autenticadas a Spotify
async function requestWithToken(endpoint: string): Promise<Response> {
    const apiBaseUrl = getApiBaseUrl();
  // Usamos la API proxy en lugar de llamar directamente a Spotify
  const url = `${apiBaseUrl}/spotify?action=direct&endpoint=${encodeURIComponent(endpoint)}`;
  return fetch(url);
}

// Función auxiliar para transformar tracks de Spotify al formato de la app
function transformTrack(spotifyTrack: any): any {
  // Obtener la URL de la imagen de la portada
  let coverUrl = 'https://placehold.co/400x400/2b2b2b/FFFFFF?text=No+Image';

  // Intentar obtener la imagen del álbum si existe
  if (spotifyTrack.album?.images && spotifyTrack.album.images.length > 0) {
    coverUrl = spotifyTrack.album.images[0].url;
    // Log para depuración de URLs de imágenes
    console.log(`[Spotify API] URL de imagen para track ${spotifyTrack.name}: ${coverUrl}`);
  }
  // Si no hay imagen de álbum pero hay imágenes directas, usar la primera
  else if (spotifyTrack.images && spotifyTrack.images.length > 0) {
    coverUrl = spotifyTrack.images[0].url;
    console.log(`[Spotify API] Usando imagen directa para track ${spotifyTrack.name}: ${coverUrl}`);
  }

  // Crear el objeto track con toda la información necesaria
  return {
    id: spotifyTrack.id,
    title: spotifyTrack.name,
    artist: spotifyTrack.artists?.map((a: any) => a.name).join(', ') || 'Artista desconocido',
    album: spotifyTrack.album?.name || 'Álbum desconocido',
    albumId: spotifyTrack.album?.id,
    cover: coverUrl,
    // Guardar también la URL original de Spotify para ser usada directamente por el componente
    spotifyCoverUrl: coverUrl,
    duration: spotifyTrack.duration_ms,
    source: 'spotify',
    spotifyId: spotifyTrack.id,
    uri: spotifyTrack.uri,
    preview: spotifyTrack.preview_url,
    // Mantener propiedades originales
    ...spotifyTrack
  };
}

// Búsqueda de pistas en Spotify
async function _searchTracks(query: string, limit: number = 20, offset: number = 0): Promise<any[]> {
  try {
    // Determinar si necesitamos limpiar un prefijo "genre:" incorrecto
    let cleanQuery = query;

    // Si comienza con "genre:" pero parece ser un título de canción, quitamos el prefijo
    if (query.startsWith('genre:')) {
      const textAfterPrefix = query.substring(6).trim();

      if (isSongTitle(textAfterPrefix)) {
        cleanQuery = textAfterPrefix;
        console.log(`[Spotify API] Quitando prefijo 'genre:' de título de canción: "${cleanQuery}"`);
      }
    }

    // Estos logs se mantienen porque son búsquedas reales a la API
    console.log(`[Spotify API] Buscando "${cleanQuery}" (type=track, limit=${limit}, offset=${offset})`);

    const url = `/search?q=${encodeURIComponent(cleanQuery)}&type=track&limit=${limit}&market=${await getUserCountry()}`;

    const response = await requestWithToken(url);

    if (!response.ok) {
      // Si hay error, podríamos intentar con la API proxy
      throw new Error(`Error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log(`[Spotify API] Búsqueda completada para "${cleanQuery}": ${data.tracks?.items?.length || 0} resultados`);

    if (!data.tracks || !data.tracks.items || !Array.isArray(data.tracks.items)) {
      console.warn('[Spotify API] No se encontraron pistas en la respuesta');
        return [];
      }

    return data.tracks.items.map(transformTrack);
  } catch (error) {
    console.error('[Spotify API] Error en searchTracks:', error);

    // Intentar usar la API proxy como fallback
    try {
      const apiBaseUrl = getApiBaseUrl();
      console.log(`[Spotify API] Intentando búsqueda fallback para "${query}"`);

      const response = await fetch(
        `${apiBaseUrl}/spotify?action=search&query=${encodeURIComponent(query)}&limit=${limit}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data && data.tracks && data.tracks.items) {
          console.log(`[Spotify API] Búsqueda fallback exitosa: ${data.tracks.items.length} resultados`);
          return data.tracks.items.map(transformTrack);
        }
      }
      console.warn('[Spotify API] La búsqueda fallback no devolvió resultados');
    } catch (fallbackError) {
      console.error('[Spotify API] Error en búsqueda fallback:', fallbackError);
    }

    // Si todo falla, devolvemos un array vacío
    return [];
  }
}

// Búsqueda de pistas por género - versión mejorada que combina ambas implementaciones
async function _getTracksByGenre(genre: string, limit: number = 20): Promise<any[]> {
  try {
    console.log(`[Spotify API] Buscando canciones del género: "${genre}"`);

    // Si no parece ser un género válido, hacer una búsqueda normal
    if (isSongTitle(genre)) {
      console.log(`[Spotify API] "${genre}" parece ser un título, realizando búsqueda normal`);
      return _searchTracks(genre, limit);
    }

    // Validar el género para evitar buscar canciones con "genre:canción completa"
    // Un género normalmente no contiene espacios ni caracteres especiales
    const isValidGenre = /^[a-zA-Z0-9-&]+$/.test(genre.trim());

    // Eliminar el prefijo 'genre:' si existe
    const cleanGenre = genre.startsWith('genre:')
      ? genre.substring(6).trim()
      : genre.trim();

    // Construir la consulta dependiendo de si parece un género válido
    const searchQuery = isValidGenre ? `genre:${cleanGenre}` : cleanGenre;
    console.log(`[Spotify API] Usando query de búsqueda: "${searchQuery}"`);

    // Intentar primero con la API directa
    try {
      return await _searchTracks(searchQuery, limit);
    } catch (directApiError) {
      console.error(`Error en búsqueda directa: ${directApiError}`);

      // Si falla, usar la API proxy como fallback
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(
        `${apiBaseUrl}/spotify?action=search&query=${encodeURIComponent(searchQuery)}&limit=${limit}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error en getTracksByGenre:', errorData);

      if (response.status === 401 && errorData.redirect) {
        window.location.href = errorData.redirect;
          return [];
      }

      throw new Error(errorData.error || `Error al buscar canciones del género ${genre}`);
    }

    const data = await response.json();
    return data.tracks.items;
    }
  } catch (error) {
    console.error(`Error en getTracksByGenre para ${genre}:`, error);

    // Devolvemos un array vacío como fallback
    return [];
  }
}

// Función interna para obtener géneros disponibles (sin throttling)
async function _getAvailableGenres() {
  try {
    console.log('Obteniendo géneros disponibles');
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(
      `${apiBaseUrl}/spotify?action=available-genres`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error en getAvailableGenres:', errorData);

      if (response.status === 401 && errorData.redirect) {
        window.location.href = errorData.redirect;
        return;
      }

      throw new Error(errorData.error || 'Error al obtener géneros disponibles');
    }

    const data = await response.json();
    return data.genres;
  } catch (error) {
    console.error('Error en getAvailableGenres:', error);
    // En caso de error, devolvemos algunos géneros por defecto
    return ['pop', 'rock', 'hip-hop', 'electronic', 'latin', 'jazz', 'classical', 'indie', 'metal', 'r&b'];
  }
}

// Función interna para obtener las canciones guardadas del usuario (sin throttling)
async function _getSavedTracks(limit: number = 20) {
  try {
    console.log('[Service] Obteniendo canciones guardadas');
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(
      `${apiBaseUrl}/spotify?action=saved-tracks&limit=${limit}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Service] Error en getSavedTracks:', errorData);

      if (response.status === 401 && errorData.redirectTo) {
        window.location.href = errorData.redirectTo;
        return [];
      }

      // Datos mockeados para caso de error
      console.log('[Service] Devolviendo datos mockeados para canciones guardadas');
      return [
        {
          id: "fallback_saved_1",
          name: "Canción Favorita (Fallback)",
          artists: [{ name: "Artista Favorito", id: "artist_1" }],
          album: {
            name: "Colección Personal",
            id: "album_1",
            images: [{ url: "https://placehold.co/300x300/green/white?text=Saved+1", height: 300, width: 300 }]
          },
          duration_ms: 195000
        },
        {
          id: "fallback_saved_2",
          name: "Mi Playlist (Fallback)",
          artists: [{ name: "Artista Descubierto", id: "artist_2" }],
          album: {
            name: "Descubrimientos",
            id: "album_2",
            images: [{ url: "https://placehold.co/300x300/gold/black?text=Saved+2", height: 300, width: 300 }]
          },
          duration_ms: 225000
        }
      ];
    }

    const data = await response.json();
    return data.items.map((item: any) => item.track);
  } catch (error) {
    console.error('[Service] Error en getSavedTracks:', error);
    // Datos mockeados para caso de error
    return [
      {
        id: "fallback_saved_1",
        name: "Canción Favorita (Fallback)",
        artists: [{ name: "Artista Favorito", id: "artist_1" }],
        album: {
          name: "Colección Personal",
          id: "album_1",
          images: [{ url: "https://placehold.co/300x300/green/white?text=Saved+1", height: 300, width: 300 }]
        },
        duration_ms: 195000
      }
    ];
  }
}

// Función interna para obtener las canciones top del usuario (sin throttling)
async function _getTopTracks(limit: number = 20) {
  try {
    // Si el usuario está en modo demo, usar datos de demo
    if (isDemoMode()) {
      console.log(`[SPOTIFY SERVICE] Obteniendo top tracks (MODO DEMO)`);
      const apiBaseUrl = getApiBaseUrl();
      const language = getDemoLanguage();

      // Obtener los datos de demo desde el endpoint correspondiente
      const requestUrl = `${apiBaseUrl}/demo/data?endpoint=top-tracks&language=${language}&limit=${limit}`;
      console.log(`[SPOTIFY SERVICE] Solicitando URL: ${requestUrl}`);

      const response = await fetch(requestUrl);

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[SPOTIFY SERVICE] Error al obtener top tracks en demo:`, errorData);
        throw new Error(errorData.error || 'Error al obtener datos de demo');
      }

      const data = await response.json();
      console.log(`[SPOTIFY SERVICE] DEMO: ${data.items?.length || 0} top tracks obtenidos`);
      return data;
    }

    // Código original
    console.log('Obteniendo canciones top');
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(
      `${apiBaseUrl}/spotify?action=top&limit=${limit}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error en getTopTracks:', errorData);

      if (response.status === 401 && errorData.redirect) {
        window.location.href = errorData.redirect;
        return [];
      }

      throw new Error(errorData.error || 'Error al obtener canciones más escuchadas');
    }

    const data = await response.json();

    // Marcar estas canciones como top tracks para poder diferenciarlas
    if (data && data.items) {
      data.items.forEach((item: any) => {
        item.isTopTrack = true;
      });
    }

    return data;
  } catch (error) {
    console.error('Error en getTopTracks:', error);
    // Datos mockeados para caso de error
    return {
      tracks: [
        {
          id: "fallback_top_1",
          name: "Tu Top Hit (Fallback)",
          isTopTrack: true,
          artists: [{ name: "Artista Popular", id: "popular_1" }],
          album: {
            name: "Tus Favoritos",
            id: "fav_album_1",
            images: [{ url: "https://placehold.co/300x300/purple/white?text=Top+Hit", height: 300, width: 300 }]
          },
          duration_ms: 210000
        }
      ]
    };
  }
}

// Función interna para obtener playlists destacadas (sin throttling)
async function _getFeaturedPlaylists(limit: number = 20, offset: number = 0) {
  try {
    // Si el usuario está en modo demo, usar datos de demo
    if (isDemoMode()) {
      console.log('[SPOTIFY SERVICE] Obteniendo playlists destacadas en MODO DEMO');
      const apiBaseUrl = getApiBaseUrl();
      const language = getDemoLanguage();

      // Obtener los datos de demo desde el endpoint correspondiente
      const requestUrl = `${apiBaseUrl}/demo/data?endpoint=featured-playlists&language=${language}`;
      console.log(`[SPOTIFY SERVICE] Solicitando URL: ${requestUrl}`);

      const response = await fetch(requestUrl);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[SPOTIFY SERVICE] Error al obtener playlists destacadas en demo:', errorData);
        throw new Error(errorData.error || 'Error al obtener datos de demo');
      }

      const data = await response.json();
      console.log(`[SPOTIFY SERVICE] DEMO: ${data.playlists?.items?.length || 0} playlists destacadas obtenidas`);

      // Validar estructura de datos
      if (data.playlists && data.playlists.items && data.playlists.items.length > 0) {
        const sampleItem = data.playlists.items[0];
        console.log(`[SPOTIFY SERVICE] Ejemplo primer elemento:`, {
          id: sampleItem.id,
          name: sampleItem.name,
          owner: sampleItem.owner?.display_name || 'No owner'
        });
      }

      return data;
    }

    // Código original para modo normal
    console.log('[API] Obteniendo playlists destacadas');
    const apiBaseUrl = getApiBaseUrl();

    // Obtener el código de país del navegador para mostrar contenido localizado
    let userCountry = 'ES'; // país por defecto

    try {
      if (typeof navigator !== 'undefined' && navigator.language) {
        // Intentar extraer el código de país de la configuración del navegador
        const languageParts = navigator.language.split('-');
        if (languageParts.length > 1) {
          userCountry = languageParts[1].toUpperCase();
        }
      }
    } catch (e) {
      console.error('Error al obtener país del usuario:', e);
    }

    // Incluir país y offset en la solicitud
    const response = await fetch(
      `${apiBaseUrl}/spotify?action=featured&limit=${limit}&offset=${offset}&country=${userCountry}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[API] Error al obtener playlists destacadas:', errorData);

      if (response.status === 401 && errorData.redirect) {
        window.location.href = errorData.redirect;
        return {
          message: "Error de autenticación",
          playlists: { items: [] }
        };
      }

      // Si hay un error, usar datos mockeados
      return {
        message: "Playlists recomendadas (Datos fallback)",
        playlists: {
          items: [
            {
              id: "fallback_playlist_1",
              name: "Música Popular",
              description: "Los éxitos más populares del momento",
              images: [{ url: "https://placehold.co/600x600/orange/white?text=Popular+Music", height: 600, width: 600 }],
              owner: { display_name: "Spotify" },
              public: true,
              tracks: { total: 50 }
            },
            {
              id: "fallback_playlist_2",
              name: "Éxitos Latinos",
              description: "Lo mejor de la música latina",
              images: [{ url: "https://placehold.co/600x600/green/white?text=Latin+Hits", height: 600, width: 600 }],
              owner: { display_name: "Spotify" },
              public: true,
              tracks: { total: 50 }
            }
          ]
        }
      };
    }

    const data = await response.json();
    console.log(`[API] ${data.playlists?.items?.length || 0} playlists destacadas obtenidas`);
    return data;
  } catch (error) {
    console.error('[API] Error al obtener playlists destacadas:', error);
    // Datos mockeados para caso de error
    return {
      message: "Playlists recomendadas (Datos fallback)",
      playlists: {
        items: [
          {
            id: "error_playlist_1",
            name: "Música Popular",
            description: "Los éxitos más populares del momento",
            images: [{ url: "https://placehold.co/600x600/orange/white?text=Popular+Music", height: 600, width: 600 }],
            owner: { display_name: "Spotify" },
            public: true,
            tracks: { total: 50 }
          }
        ]
      }
    };
  }
}

// Función interna para obtener nuevos lanzamientos (sin throttling)
async function _getNewReleases(limit: number = 20) {
  try {
    // Si el usuario está en modo demo, usar datos de demo
    if (isDemoMode()) {
      console.log('[API] Obteniendo nuevos lanzamientos (MODO DEMO)');
      const apiBaseUrl = getApiBaseUrl();

      // Obtener los datos de demo desde el endpoint correspondiente
      const response = await fetch(
        `${apiBaseUrl}/demo/data?endpoint=new-releases&language=${getDemoLanguage()}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[API Demo] Error al obtener nuevos lanzamientos:', errorData);
        throw new Error(errorData.error || 'Error al obtener datos de demo');
      }

      const data = await response.json();
      console.log(`[API Demo] ${data.albums?.items?.length || 0} nuevos lanzamientos obtenidos del modo demo`);
      return data;
    }

    // Código original para modo normal
    console.log('[API] Obteniendo nuevos lanzamientos');
    const apiBaseUrl = getApiBaseUrl();

    // Intentar obtener país del usuario
    let userCountry = 'US';
    try {
      userCountry = await getUserCountry();
    } catch (e) {
      console.error('Error al obtener país del usuario:', e);
    }

    const response = await fetch(
      `${apiBaseUrl}/spotify?action=new-releases&limit=${limit}&country=${userCountry}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[API] Error al obtener nuevos lanzamientos:', errorData);

      if (response.status === 401 && errorData.redirect) {
        // En lugar de redirigir automáticamente, lanzar un error con información
        console.warn('[API] Error de autenticación, se requiere iniciar sesión');
        throw new Error('No autenticado');
      }

      // Si hay un error, usar datos mockeados
      return {
        albums: {
          items: [
            {
              id: "fallback_album_1",
              name: "Álbum Popular (Fallback)",
              artists: [{ name: "Artista Popular" }],
              images: [{ url: "https://placehold.co/600x600/blue/white?text=Album+Popular", height: 600, width: 600 }]
            },
            {
              id: "fallback_album_2",
              name: "Éxitos del Momento (Fallback)",
              artists: [{ name: "Artista Trending" }],
              images: [{ url: "https://placehold.co/600x600/purple/white?text=Exitos+Momento", height: 600, width: 600 }]
            }
          ]
        }
      };
    }

    const data = await response.json();
    console.log(`[API] ${data.albums?.items?.length || 0} nuevos lanzamientos obtenidos`);
    return data;
  } catch (error) {
    console.error('[API] Error al obtener nuevos lanzamientos:', error);
    // Datos mockeados para caso de error
    return {
      albums: {
        items: [
          {
            id: "error_album_1",
            name: "Álbum Popular (Fallback por Error)",
            artists: [{ name: "Artista Popular" }],
            images: [{ url: "https://placehold.co/600x600/blue/white?text=Error", height: 600, width: 600 }]
          }
        ]
      }
    };
  }
}

// Función interna para obtener recomendaciones del usuario (sin throttling)
async function _getUserPersonalRotation(limit: number = 10): Promise<any[]> {
  try {
    // Si el usuario está en modo demo, usar datos de demo
    if (isDemoMode()) {
      console.log('[Service] Obteniendo rotación personal del usuario (MODO DEMO)');
      const apiBaseUrl = getApiBaseUrl();

      // En modo demo, usaremos una combinación de canciones recientes y tops
      try {
        // Obtener historial de reproducción reciente aleatorio
        const recentlyPlayedResponse = await fetch(
          `${apiBaseUrl}/demo/data?endpoint=recently-played&language=${getDemoLanguage()}&limit=${limit}`
        );

        if (recentlyPlayedResponse.ok) {
          const recentlyPlayedData = await recentlyPlayedResponse.json();
          // Las canciones recientes vienen con formato { track: {...}, played_at: ... }
          const recentTracks = recentlyPlayedData.map((item: any) => {
            // Añadir marcador de canción reciente
            const track = item.track;
            track.isRecentlyPlayed = true;
            return track;
          });

          console.log(`[Service Demo] Obtenidas ${recentTracks.length} canciones del historial simulado`);
          return recentTracks;
        }
      } catch (error) {
        console.error('[Service Demo] Error al obtener historial simulado:', error);
      }

      // Si fallamos con el historial simulado, intentar con top tracks
      try {
        const topTracksResponse = await fetch(
          `${apiBaseUrl}/demo/data?endpoint=top-tracks&language=${getDemoLanguage()}`
        );

        if (topTracksResponse.ok) {
          const topTracksData = await topTracksResponse.json();
          const topTracks = topTracksData.items || [];

          // Marcar como top tracks
          topTracks.forEach((track: any) => {
            track.isTopTrack = true;
          });

          console.log(`[Service Demo] Obtenidos ${topTracks.length} top tracks como fallback`);
          return topTracks.slice(0, limit);
        }
      } catch (error) {
        console.error('[Service Demo] Error al obtener top tracks como fallback:', error);
      }

      // Si todo falla, devolver array vacío
      return [];
    }

    // Código original para el modo normal
    console.log('Obteniendo rotación personal del usuario');
    const apiBaseUrl = getApiBaseUrl();

    // Obtener TOP tracks
    const topTracksResponse = await fetch(`${apiBaseUrl}/spotify?action=top&limit=${Math.floor(limit/2)}`);

    // Definir el tipo explícitamente
    let rotation: any[] = [];

    // Verificar si tenemos un error de autenticación (401)
    if (topTracksResponse.status === 401) {
      const errorData = await topTracksResponse.json();
      console.warn('Error de autenticación al obtener top tracks:', errorData);

      // En lugar de redirigir automáticamente al usuario
      if (errorData.redirect) {
        console.warn(`Se requiere autenticación para acceder a la API de Spotify`);
        throw new Error('No autenticado');
      }

      throw new Error('No autenticado'); // Para evitar continuar con el flujo
    }

    if (topTracksResponse.ok) {
      const topData = await topTracksResponse.json();
      const topTracks = topData.items || [];
      console.log(`Obtenidos ${topTracks.length} top tracks`);

      // Marcar estas canciones como top tracks para poder diferenciarlas
      topTracks.forEach((track: any) => {
        track.isTopTrack = true;
      });

      rotation = [...topTracks];
    } else {
      console.warn('No se pudieron obtener top tracks');
    }

    // Si no tenemos suficientes canciones, obtener recomendaciones en base a los top tracks
    if (rotation.length < limit) {
      const savedTracksResponse = await fetch(`${apiBaseUrl}/spotify?action=saved-tracks&limit=${limit - rotation.length}`);

      // Verificar si tenemos un error de autenticación (401)
      if (savedTracksResponse.status === 401) {
        const errorData = await savedTracksResponse.json();
        console.warn('Error de autenticación al obtener tracks guardados:', errorData);

        // En lugar de redirigir automáticamente al usuario
        if (errorData.redirect) {
          console.warn(`Se requiere autenticación para acceder a la API de Spotify`);
          throw new Error('No autenticado');
        }
      }

      if (savedTracksResponse.ok) {
        const savedData = await savedTracksResponse.json();
        const savedTracks = savedData.items?.map((item: any) => item.track) || [];
        console.log(`Obtenidos ${savedTracks.length} tracks guardados`);

        // Mezclar con los top tracks
        rotation = [...rotation, ...savedTracks];
      } else {
        console.warn('No se pudieron obtener tracks guardados');
      }
    }

    // Si aún no tenemos suficientes, añadir recomendaciones
    if (rotation.length < limit) {
      const recommendationsResponse = await fetch(`${apiBaseUrl}/spotify?action=recommendations&limit=${limit - rotation.length}`);

      // Verificar si tenemos un error de autenticación (401)
      if (recommendationsResponse.status === 401) {
        const errorData = await recommendationsResponse.json();
        console.warn('Error de autenticación al obtener recomendaciones:', errorData);

        // En lugar de redirigir automáticamente al usuario
        if (errorData.redirect) {
          console.warn(`Se requiere autenticación para acceder a la API de Spotify`);
          throw new Error('No autenticado');
        }
      }

      if (recommendationsResponse.ok) {
        const recommendationsData = await recommendationsResponse.json();
        const recommendedTracks = recommendationsData.tracks || [];
        console.log(`Obtenidos ${recommendedTracks.length} tracks recomendados`);

        // Añadir a la rotación
        rotation = [...rotation, ...recommendedTracks];
      } else {
        console.warn('No se pudieron obtener recomendaciones');
      }
    }

    console.log(`Rotación personal completa: ${rotation.length} tracks`);
    return rotation.slice(0, limit);
  } catch (error) {
    console.error('Error al obtener rotación personal:', error);

    // Si es un error de autenticación, solo registrarlo pero no redireccionar
    if (error instanceof Error && error.message.includes('No autenticado')) {
      console.warn('No autenticado para obtener rotación personal');
    }

    return [];
  }
}

// Exportar funciones con throttling
export const searchTracks = withThrottle(_searchTracks, 'spotify');
export const getTracksByGenre = withThrottle(_getTracksByGenre, 'spotify');
export const getAvailableGenres = withThrottle(_getAvailableGenres, 'spotify');
export const getSavedTracks = withThrottle(_getSavedTracks, 'spotify');
export const getTopTracks = withThrottle(_getTopTracks, 'getTopTracks', spotifyThrottleOptions);
export const getFeaturedPlaylists = withThrottle(_getFeaturedPlaylists, 'spotify');
export const getNewReleases = withThrottle(_getNewReleases, 'spotify');
export const getUserPersonalRotation = withThrottle(_getUserPersonalRotation, 'spotify');

// Función para obtener las canciones de una playlist
export async function getPlaylistTracks(playlistId: string, limit: number = 20) {
  try {
    // Usamos la API proxy en lugar de llamar directamente a Spotify
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(
      `${apiBaseUrl}/spotify?action=playlist&playlistId=${playlistId}&limit=${limit}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error en getPlaylistTracks:', errorData);

      if (response.status === 401 && errorData.redirect) {
        window.location.href = errorData.redirect;
        return;
      }

      throw new Error(errorData.error || 'Error al obtener canciones de la playlist');
    }

    const data = await response.json();
    return data.items.map((item: any) => item.track);
  } catch (error) {
    console.error('Error en getPlaylistTracks:', error);
    throw error;
  }
}

// Función para obtener las canciones recomendadas
export async function getRecommendedTracks(limit: number = 20) {
  try {
    console.log('[Service] Obteniendo canciones recomendadas');
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(
      `${apiBaseUrl}/spotify?action=recommended&limit=${limit}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Service] Error en getRecommendedTracks:', errorData);

      if (response.status === 401 && errorData.redirectTo) {
        window.location.href = errorData.redirectTo;
        return [];
      }

      // Datos mockeados para caso de error
      console.log('[Service] Devolviendo datos mockeados para canciones recomendadas');
      return [
        {
          id: "fallback_rec_1",
          name: "Recomendación Popular (Fallback)",
          artists: [{ name: "Artista Recomendado", id: "artist_1" }],
          album: {
            name: "Descubrimientos Recientes",
            id: "album_1",
            images: [{ url: "https://placehold.co/300x300/blue/white?text=Rec+1", height: 300, width: 300 }]
          },
          duration_ms: 215000
        },
        {
          id: "fallback_rec_2",
          name: "Tendencia Musical (Fallback)",
          artists: [{ name: "Artista Emergente", id: "artist_2" }],
          album: {
            name: "Lanzamientos Nuevos",
            id: "album_2",
            images: [{ url: "https://placehold.co/300x300/purple/white?text=Rec+2", height: 300, width: 300 }]
          },
          duration_ms: 185000
        }
      ];
    }

    const data = await response.json();
    // Verificar si data.items existe, si no, verificar data.tracks o devolver array vacío
    let tracks = [];
    if (data.items) {
      tracks = data.items;
    } else if (data.tracks) {
      tracks = data.tracks;
    } else {
      console.warn('[Service] Respuesta de recomendaciones no contiene tracks o items:', data);
      return [];
    }

    // Procesar los tracks para asegurar que tengan el formato correcto
    return tracks.map((track: any) => {
      const coverUrl = track.album?.images?.[0]?.url || "https://placehold.co/400x400/2b2b2b/FFFFFF?text=No+Image";
      return {
        ...track,
        title: track.title || track.name,
        artist: track.artist || (track.artists ? track.artists.map((a: any) => a.name).join(', ') : 'Artista desconocido'),
        albumCover: coverUrl,
        cover: coverUrl,
        duration: track.duration || track.duration_ms || 0
      };
    });
  } catch (error) {
    console.error('[Service] Error en getRecommendedTracks:', error);
    // Datos mockeados para caso de error
    return [
      {
        id: "fallback_rec_1",
        name: "Recomendación Popular (Fallback)",
        title: "Recomendación Popular (Fallback)",
        artists: [{ name: "Artista Recomendado", id: "artist_1" }],
        artist: "Artista Recomendado",
        album: {
          name: "Descubrimientos Recientes",
          id: "album_1",
          images: [{ url: "https://placehold.co/300x300/blue/white?text=Rec+1", height: 300, width: 300 }]
        },
        albumCover: "https://placehold.co/300x300/blue/white?text=Rec+1",
        cover: "https://placehold.co/300x300/blue/white?text=Rec+1",
        duration: 215,
        duration_ms: 215000
      }
    ];
  }
}

// Función para obtener información detallada de una playlist
export async function getPlaylistDetail(playlistId: string) {
  try {
    console.log(`Obteniendo detalles de playlist: ${playlistId}`);
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(
      `${apiBaseUrl}/spotify?action=playlist-detail&playlistId=${playlistId}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error en getPlaylistDetail:', errorData);

      if (response.status === 401 && errorData.redirect) {
        window.location.href = errorData.redirect;
        return;
      }

      throw new Error(errorData.error || 'Error al obtener detalles de la playlist');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error en getPlaylistDetail para ${playlistId}:`, error);
    throw error;
  }
}

// Función para obtener información de un artista
export async function getArtist(artistId: string) {
  // Proceder con la llamada normal...
  console.log(`[Spotify API] Obteniendo artista: ${artistId}`);

  try {
    // Si el usuario está en modo demo, usar datos de demo
    if (isDemoMode()) {
      console.log(`[SPOTIFY SERVICE] Obteniendo información del artista: ${artistId} (MODO DEMO)`);
      const apiBaseUrl = getApiBaseUrl();
      const language = getDemoLanguage();

      // Obtener los datos de demo desde el endpoint correspondiente
      const requestUrl = `${apiBaseUrl}/demo/data?endpoint=artist&artistId=${artistId}&language=${language}`;
      console.log(`[SPOTIFY SERVICE] Solicitando URL: ${requestUrl}`);

      const response = await fetch(requestUrl);

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[SPOTIFY SERVICE] Error al obtener información del artista ${artistId} en demo:`, errorData);
        throw new Error(errorData.error || 'Error al obtener datos de demo');
      }

      const data = await response.json();
      console.log(`[SPOTIFY SERVICE] DEMO: Información del artista ${artistId} obtenida correctamente`);
      return data;
    }

    // Código original para modo normal
    console.log(`Obteniendo información del artista: ${artistId}`);
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(
      `${apiBaseUrl}/spotify?action=artist&artistId=${artistId}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error en getArtist:', errorData);

      if (response.status === 401 && errorData.redirect) {
        window.location.href = errorData.redirect;
        return;
      }

      throw new Error(errorData.error || 'Error al obtener información del artista');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error en getArtist para ${artistId}:`, error);
    throw error;
  }
}

// Función para obtener las canciones más populares de un artista
export async function getArtistTopTracks(artistId: string) {
  console.log(`[Spotify API] Obteniendo top tracks para artista: ${artistId}`);

  try {
    // Si el usuario está en modo demo, usar datos de demo
    if (isDemoMode()) {
      console.log(`[SPOTIFY SERVICE] Obteniendo top tracks del artista: ${artistId} (MODO DEMO)`);
      const apiBaseUrl = getApiBaseUrl();
      const language = getDemoLanguage();

      // Obtener los datos de demo desde el endpoint correspondiente
      const requestUrl = `${apiBaseUrl}/demo/data?endpoint=artist-top-tracks&artistId=${artistId}&language=${language}`;
      console.log(`[SPOTIFY SERVICE] Solicitando URL: ${requestUrl}`);

      const response = await fetch(requestUrl);

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[SPOTIFY SERVICE] Error al obtener top tracks del artista ${artistId} en demo:`, errorData);
        throw new Error(errorData.error || 'Error al obtener datos de demo');
      }

      const data = await response.json();
      console.log(`[SPOTIFY SERVICE] DEMO: ${data.tracks?.length || 0} top tracks del artista ${artistId} obtenidos`);
      return data.tracks || [];
    }

    // Código original para modo normal
    console.log(`Obteniendo top tracks del artista: ${artistId}`);
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(
      `${apiBaseUrl}/spotify?action=artist-top-tracks&artistId=${artistId}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error en getArtistTopTracks:', errorData);

      if (response.status === 401 && errorData.redirect) {
        window.location.href = errorData.redirect;
        return;
      }

      throw new Error(errorData.error || 'Error al obtener canciones populares del artista');
    }

    const data = await response.json();
    return data.tracks;
  } catch (error) {
    console.error(`Error en getArtistTopTracks para ${artistId}:`, error);
    throw error;
  }
}

// Función para obtener los álbumes de un artista
export async function getArtistAlbums(artistId: string, limit: number = 20) {
  console.log(`[Spotify API] Obteniendo álbumes para artista: ${artistId} (limit: ${limit})`);

  try {
    // Si el usuario está en modo demo, usar datos de demo
    if (isDemoMode()) {
      console.log(`[SPOTIFY SERVICE] Obteniendo álbumes del artista: ${artistId} (MODO DEMO)`);
      const apiBaseUrl = getApiBaseUrl();
      const language = getDemoLanguage();

      // Obtener los datos de demo desde el endpoint correspondiente
      const requestUrl = `${apiBaseUrl}/demo/data?endpoint=artist-albums&artistId=${artistId}&language=${language}`;
      console.log(`[SPOTIFY SERVICE] Solicitando URL: ${requestUrl}`);

      const response = await fetch(requestUrl);

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`[SPOTIFY SERVICE] Error al obtener álbumes del artista ${artistId} en demo:`, errorData);
        throw new Error(errorData.error || 'Error al obtener datos de demo');
      }

      const data = await response.json();
      console.log(`[SPOTIFY SERVICE] DEMO: ${data.items?.length || 0} álbumes del artista ${artistId} obtenidos`);
      return data.items || [];
    }

    // Código original para modo normal
    console.log(`Obteniendo álbumes del artista: ${artistId}`);
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(
      `${apiBaseUrl}/spotify?action=artist-albums&artistId=${artistId}&limit=${limit}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error en getArtistAlbums:', errorData);

      if (response.status === 401 && errorData.redirect) {
        window.location.href = errorData.redirect;
        return;
      }

      throw new Error(errorData.error || 'Error al obtener álbumes del artista');
    }

    const data = await response.json();
    return data.items;
  } catch (error) {
    console.error(`Error en getArtistAlbums para ${artistId}:`, error);
    throw error;
  }
}

// Función para obtener artistas relacionados
export async function getRelatedArtists(artistId: string) {
  console.log(`[Spotify API] Obteniendo artistas relacionados para: ${artistId}`);

  try {
    console.log(`Obteniendo artistas relacionados con: ${artistId}`);
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(
      `${apiBaseUrl}/spotify?action=related-artists&artistId=${artistId}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error en getRelatedArtists:', errorData);

      if (response.status === 401 && errorData.redirect) {
        window.location.href = errorData.redirect;
        return;
      }

      throw new Error(errorData.error || 'Error al obtener artistas relacionados');
    }

    const data = await response.json();
    return data.artists;
  } catch (error) {
    console.error(`Error en getRelatedArtists para ${artistId}:`, error);
    throw error;
  }
}

// Función para buscar artistas
export async function searchArtists(query: string, limit: number = 20) {
  try {
    console.log(`Buscando artistas: ${query}`);
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(
      `${apiBaseUrl}/spotify?action=search-artists&query=${encodeURIComponent(query)}&limit=${limit}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error en searchArtists:', errorData);

      if (response.status === 401 && errorData.redirect) {
        // Verificar si el usuario está en modo demo
        const isDemo = localStorage.getItem('demo_mode') === 'true';
        if (!isDemo) {
          console.log('[searchArtists] Redirigiendo al login debido a error 401 (no en modo demo)');
          window.location.href = errorData.redirect;
          return;
        } else {
          console.log('[searchArtists] Error 401 ignorado en modo demo. Retornando datos de fallback.');
          // Retornar datos de fallback para el modo demo
          return [{
            id: "fallback-artist-1",
            name: `Artista para "${query}" (Fallback)`,
            images: [{ url: "https://placehold.co/300x300/purple/white?text=Artist", height: 300, width: 300 }],
            popularity: 60,
            isFallback: true
          }];
        }
      }

      throw new Error(errorData.error || 'Error al buscar artistas');
    }

    const data = await response.json();

    // Verificar si la estructura de datos es la esperada
    if (!data || !data.artists) {
      console.warn(`[searchArtists] Estructura de datos inesperada para búsqueda "${query}":`, data);
      return []; // Devolver array vacío si data.artists no existe
    }

    // Verificar si tiene la propiedad items
    if (!data.artists.items) {
      console.warn(`[searchArtists] No se encontraron items en la respuesta para "${query}":`, data.artists);

      // Si data.artists es un array en sí mismo, filtrar para garantizar estructura correcta
      if (Array.isArray(data.artists)) {
        // Filtrar artistas sin imágenes y asegurarse de tener estructura correcta
        const validArtists = data.artists
          .filter((artist: any) => artist && typeof artist === 'object')
          .map((artist: any) => ({
            ...artist,
            // Asegurar que siempre tenga un array de imágenes, aunque esté vacío
            images: Array.isArray(artist.images) ? artist.images : []
          }));
        return validArtists;
      }

      // Si no, devolver array vacío
      return [];
    }

    // Filtrar artistas sin imágenes y asegurarse de tener estructura correcta
    const validArtists = data.artists.items
      .filter((artist: any) => artist && typeof artist === 'object')
      .map((artist: any) => ({
        ...artist,
        // Asegurar que siempre tenga un array de imágenes, aunque esté vacío
        images: Array.isArray(artist.images) ? artist.images : []
      }));

    console.log(`[searchArtists] Búsqueda "${query}" retornó ${validArtists.length} artistas válidos`);
    return validArtists;
  } catch (error) {
    console.error(`Error en searchArtists para ${query}:`, error);
    // Devolver array vacío en lugar de lanzar el error para evitar que la aplicación se rompa
    return [];
  }
}

// Función para buscar playlists
export async function searchPlaylists(query: string, limit: number = 20) {
  console.log(`[Service] Buscando playlists con término: "${query}"`);
  try {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(
      `${apiBaseUrl}/spotify?action=search&type=playlist&q=${encodeURIComponent(query)}&limit=${limit}`
    );

    if (!response.ok) {
      console.error(`[Service] Error en búsqueda de playlists: ${response.status}`);

      // Datos mockeados para playlists
      return [
        {
          id: "fallback_playlist_search_1",
          name: `Resultados para "${query}" (Fallback)`,
          description: "Resultados de búsqueda generados localmente",
          images: [{ url: "https://placehold.co/300x300/orange/white?text=Search", height: 300, width: 300 }],
          owner: { display_name: "Sistema Local" },
          tracks: { total: 20 }
        },
        {
          id: "fallback_playlist_search_2",
          name: "Playlist Alternativa (Fallback)",
          description: "Generada localmente como alternativa",
          images: [{ url: "https://placehold.co/300x300/blue/white?text=Alt", height: 300, width: 300 }],
          owner: { display_name: "Sistema Local" },
          tracks: { total: 15 }
        }
      ];
    }

    const data = await response.json();
    // La respuesta puede tener diferentes formatos, adaptamos
    if (data.playlists && data.playlists.items) {
      return data.playlists.items;
    } else if (Array.isArray(data)) {
      return data;
    } else {
      console.warn('[Service] Formato de respuesta inesperado:', data);
      return [];
    }
  } catch (error) {
    console.error(`[Service] Error en searchPlaylists:`, error);

    // Datos mockeados para playlists
    return [
      {
        id: "fallback_playlist_search_1",
        name: `Resultados para "${query}" (Fallback)`,
        description: "Resultados de búsqueda generados localmente",
        images: [{ url: "https://placehold.co/300x300/orange/white?text=Search", height: 300, width: 300 }],
        owner: { display_name: "Sistema Local" },
        tracks: { total: 20 }
      }
    ];
  }
}

// Función para obtener categorías de Spotify
export async function getCategories(limit: number = 50) {
  try {
    console.log('Obteniendo categorías de Spotify');
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(
      `${apiBaseUrl}/spotify?action=categories&limit=${limit}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error en getCategories:', errorData);

      if (response.status === 401 && errorData.redirect) {
        window.location.href = errorData.redirect;
        return;
      }

      throw new Error(errorData.error || 'Error al obtener categorías');
    }

    const data = await response.json();
    return data.categories.items;
  } catch (error) {
    console.error('Error en getCategories:', error);
    throw error;
  }
}

// Función para obtener playlists de una categoría
export async function getCategoryPlaylists(categoryId: string, limit: number = 20) {
  try {
    console.log(`Obteniendo playlists de la categoría: ${categoryId}`);
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(
      `${apiBaseUrl}/spotify?action=category-playlists&categoryId=${categoryId}&limit=${limit}`
    );

    if (!response.ok) {
      console.warn(`Error en respuesta de API para categoría ${categoryId}: ${response.status}`);
      // Devolver array vacío en lugar de lanzar error
      return [];
    }

    const data = await response.json();
    return data.playlists || [];
  } catch (error) {
    console.error(`Error en getCategoryPlaylists para ${categoryId}:`, error);
    // Devolver array vacío en lugar de lanzar error
    return [];
  }
}

// Función para obtener recomendaciones por género
export async function getRecommendationsByGenre(genre: string, limit: number = 20) {
  try {
    console.log(`Obteniendo recomendaciones para el género: ${genre}`);
    // Primero intentamos con el endpoint específico de géneros
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(
        `${apiBaseUrl}/spotify?action=genre-recommendations&genre=${encodeURIComponent(genre)}&limit=${limit}`
      );

      if (response.ok) {
        const data = await response.json();
        return data.tracks;
      }
    } catch (error) {
      console.error(`Error al obtener recomendaciones específicas del género ${genre}:`, error);
      // Continuamos con el fallback si falla
    }

    // Si el endpoint específico falla, usamos búsqueda por género como fallback
    return getTracksByGenre(genre, limit);
  } catch (error) {
    console.error(`Error en getRecommendationsByGenre para ${genre}:`, error);
    throw error;
  }
}

// Función para buscar artistas por género
export async function searchArtistsByGenre(genre: string, limit: number = 20) {
  try {
    console.log(`Buscando artistas del género: ${genre}`);

    // Validar el género para evitar buscar artistas con "genre:canción completa"
    // Un género normalmente no contiene espacios ni caracteres especiales
    const isValidGenre = /^[a-zA-Z0-9-&]+$/.test(genre.trim());

    // Construir la consulta dependiendo de si parece un género válido
    const searchQuery = isValidGenre ? `genre:${genre}` : genre;
    console.log(`Usando query de búsqueda para artistas: ${searchQuery}`);

    // Usamos la API de búsqueda para encontrar artistas relacionados con el género
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(
      `${apiBaseUrl}/spotify?action=search-artists&query=${encodeURIComponent(searchQuery)}&limit=${limit}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error en searchArtistsByGenre:', errorData);

      if (response.status === 401 && errorData.redirect) {
        window.location.href = errorData.redirect;
        return;
      }

      throw new Error(errorData.error || `Error al buscar artistas del género ${genre}`);
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error(`Error en searchArtistsByGenre para ${genre}:`, error);
    throw error;
  }
}

// Definición de la interfaz Playlist
export interface Playlist {
  id: string;
  name: string;
  description?: string;
  images: Array<{ url: string }>;
  owner: { display_name: string };
  tracks?: { total: number };
  external_urls?: { spotify: string };
  uri?: string;
}

// Añadir o actualizar este mapeo
const genreToCategoryMap: Record<string, string> = {
  'pop': 'pop',
  'rock': 'rock',
  'hip-hop': 'hiphop',
  'electronic': 'edm_dance',
  'jazz': 'jazz',
  'r&b': 'rnb',
  'latin': 'latin',
  'classical': 'classical',
  'metal': 'metal',
  'indie': 'indie_alt',
  'alternative': 'indie_alt',
  'soul': 'soul_rnb',
  'blues': 'blues',
  'reggae': 'reggae',
  'country': 'country',
  'dance': 'edm_dance'
};

// Función para buscar el ID de categoría basado en el género
export const findCategoryIdByGenre = async (genre: string): Promise<string | null> => {
  try {
    // Primero intentamos un mapeo directo
    const normalizedGenre = genre.toLowerCase();

    // Si existe un mapeo directo, usamos la categoría correspondiente
    if (genreToCategoryMap[normalizedGenre]) {
      console.log(`Mapeo directo encontrado para ${normalizedGenre}: ${genreToCategoryMap[normalizedGenre]}`);
      return genreToCategoryMap[normalizedGenre];
    }

    // Si no hay mapeo, intentamos buscar la categoría
    console.log(`Buscando categoría para el género: ${normalizedGenre}`);
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/spotify?action=categories`);

    if (!response.ok) {
      console.warn(`No se pudo obtener lista de categorías: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const categories = data.categories?.items || [];

    // Buscar categoría que coincida o contenga el género
    const matchingCategory = categories.find((category: any) =>
      category.name.toLowerCase().includes(normalizedGenre) ||
      normalizedGenre.includes(category.name.toLowerCase())
    );

    if (matchingCategory) {
      console.log(`Categoría encontrada para ${normalizedGenre}: ${matchingCategory.id}`);
      return matchingCategory.id;
    }

    console.log(`No se encontró categoría para ${normalizedGenre}`);
    return null;
  } catch (error) {
    console.error(`Error al buscar categoría para el género ${genre}:`, error);
    return null;
  }
};

export const getPlaylistsByGenre = async (genre: string, limit = 10): Promise<Playlist[]> => {
  try {
    // Buscar una categoría que coincida con el género
    const categoryId = await findCategoryIdByGenre(genre);

    if (!categoryId) {
      console.log(`No se encontró categoría para el género ${genre}, buscando playlists por búsqueda`);
      // Implementa una alternativa buscando playlists por el término del género
      return searchPlaylistsByTerm(genre, limit);
    }

    return await getCategoryPlaylists(categoryId, limit);
  } catch (error) {
    console.error(`Error al buscar categoría para el género ${genre}:`, error);
    return [];
  }
}

// Función alternativa para buscar playlists por término
const searchPlaylistsByTerm = async (term: string, limit = 10): Promise<Playlist[]> => {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/spotify?action=search&type=playlist&q=${term}&limit=${limit}`);
    if (!response.ok) return [];

    const data = await response.json();
    return data.playlists?.items || [];
  } catch (error) {
    console.error(`Error al buscar playlists por término ${term}:`, error);
    return [];
  }
}

// Función para obtener artistas más escuchados
export async function getTopArtists(limit: number = 10, timeRange: string = 'medium_term') {
  console.log(`[Service] Obteniendo artistas top (limit: ${limit}, timeRange: ${timeRange})`);

  try {
    // Si el usuario está en modo demo, usar datos de demo
    if (isDemoMode()) {
      console.log('[Service] Obteniendo artistas top (MODO DEMO)');
      const apiBaseUrl = getApiBaseUrl();
      const language = getDemoLanguage();

      try {
        // En modo demo, usaremos el archivo search_artist.json que contiene artistas reales
        const requestUrl = `${apiBaseUrl}/demo/data?endpoint=search&type=artist&language=${language}`;
        console.log(`[Service DEMO] Solicitando URL para artistas: ${requestUrl}`);

        const response = await fetch(requestUrl);

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`[Service DEMO] Error al obtener artistas: ${response.status}`, errorData);
          throw new Error(`Error al obtener artistas: ${response.status}`);
        }

        const data = await response.json();

        // Validar la estructura de los datos
        if (!data.artists || !data.artists.items || !Array.isArray(data.artists.items)) {
          console.error('[Service DEMO] Formato incorrecto de datos para artistas:', data);
          throw new Error('Formato incorrecto de datos para artistas');
        }

        console.log(`[Service DEMO] Artistas obtenidos: ${data.artists.items.length}`);

        // Filtrar artistas por popularidad y asegurarse de que tengan imagen
        const validatedArtists = data.artists.items
          .filter((artist: any) => artist.popularity > 60) // Solo artistas populares
          .slice(0, limit) // Limitar al número solicitado
          .map((artist: any) => {
            // Verificar si el artista tiene imágenes
            if (!artist.images || !artist.images.length || !artist.images[0].url) {
              console.warn(`[Service DEMO] Artista sin imágenes: ${artist.name}, añadiendo placeholder`);
              artist.images = [{
                url: "https://placehold.co/300x300/purple/white?text=Artist",
                height: 300,
                width: 300
              }];
            }
            return artist;
          });

        return { items: validatedArtists };
      } catch (error) {
        console.error('[Service DEMO] Error al obtener artistas destacados:', error);

        // Generar artistas demo con datos realistas
        return {
          items: [
            {
              id: "7ltDVBr6mKbRvohxheJ9h1",
              name: "ROSALÍA",
              genres: ["latin", "pop", "flamenco"],
              images: [{
                url: "https://i.scdn.co/image/ab6761610000e5ebd7bb678bef6d2f26110cae49",
                height: 640,
                width: 640
              }],
              popularity: 82
            },
            {
              id: "1Xyo4u8uXC1ZmMpatF05PJ",
              name: "The Weeknd",
              genres: ["pop", "r&b", "canadian"],
              images: [{
                url: "https://i.scdn.co/image/ab6761610000e5eb2f71b65ef483ed75a8b40437",
                height: 640,
                width: 640
              }],
              popularity: 94
            },
            {
              id: "4q3ewBCX7sLwd24euuV69X",
              name: "Bad Bunny",
              genres: ["latin", "reggaeton", "trap latino"],
              images: [{
                url: "https://i.scdn.co/image/ab6761610000e5eb9ad50e478a469448c6f369df",
                height: 640,
                width: 640
              }],
              popularity: 89
            }
          ].slice(0, limit)
        };
      }
    }

    // Código original para modo normal
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(
      `${apiBaseUrl}/spotify?action=top-artists&limit=${limit}&timeRange=${timeRange}`
    );

    // Guardar el status code para logging
    const statusCode = response.status;
    console.log(`[Service] Respuesta de top-artists con status: ${statusCode}`);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error('[Service] Error en getTopArtists:', errorData);
      } catch (parseError) {
        console.error('[Service] Error al parsear respuesta de error:', parseError);
      }

      if (statusCode === 401 && errorData?.redirectTo) {
        window.location.href = errorData.redirectTo;
        return { items: [] };
      }

      // Devolver datos mockeados para artistas populares
      console.log('[Service] Devolviendo datos mockeados para artistas top');
      return {
        items: [
          {
            id: "fallback_artist_1",
            name: "Artista Pop (Fallback)",
            genres: ["pop", "dance pop"],
            images: [{ url: "https://placehold.co/300x300/pink/black?text=Pop+Artist", height: 300, width: 300 }],
            popularity: 90
          },
          {
            id: "fallback_artist_2",
            name: "Rockstar (Fallback)",
            genres: ["rock", "alternative rock"],
            images: [{ url: "https://placehold.co/300x300/black/white?text=Rock+Star", height: 300, width: 300 }],
            popularity: 85
          }
        ].slice(0, limit)
      };
    }

    const data = await response.json();
    console.log(`[Service] Artistas top obtenidos correctamente:`, data.items?.length || 0);
    return data || { items: [] };
  } catch (error) {
    console.error(`[Service] Error en getTopArtists:`, error);

    // Devolver datos mockeados si hay error
    return {
      items: [
        {
          id: "error_artist_1",
          name: "Artista Error (Fallback)",
          genres: ["pop"],
          images: [{ url: "https://placehold.co/300x300/red/white?text=Error", height: 300, width: 300 }],
          popularity: 75
        }
      ].slice(0, limit)
    };
  }
}

/**
 * Obtiene los géneros musicales del usuario basados en sus artistas favoritos
 * @param timeRange Rango de tiempo: 'short_term' (4 semanas), 'medium_term' (6 meses) o 'long_term' (varios años)
 * @returns Información sobre los géneros musicales del usuario
 */
export async function getUserGenres(timeRange: string = 'medium_term') {
  console.log(`[Service] Obteniendo géneros musicales del usuario (timeRange: ${timeRange})`);
  try {
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(
      `${apiBaseUrl}/user/genres?timeRange=${timeRange}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      console.error(`[Service] Error obteniendo géneros del usuario (${response.status})`);
      // Implementación de fallback - usar getTopArtists y extraer los géneros manualmente
      console.log('[Service] Intentando fallback local para géneros...');
      return getUserGenresFallback(timeRange);
    }

    const data = await response.json();
    console.log(`[Service] Géneros obtenidos correctamente:`, data.topGenres?.length || 0);

    if (!data.success) {
      console.log('[Service] Los datos devueltos indican error, usando fallback');
      return getUserGenresFallback(timeRange);
    }

    // Si la API nos indica que necesita selección manual, devolvemos eso directamente
    if (data.hasUserInput) {
      console.log('[Service] La API indica que se necesita selección manual de géneros');
      return data;
    }

    // Si no hay géneros, intentar con fallback
    if (!data.topGenres || data.topGenres.length === 0) {
      console.log('[Service] Los datos devueltos no contienen géneros, usando fallback');
      return getUserGenresFallback(timeRange);
    }

    return data;
  } catch (error) {
    console.error(`[Service] Error en getUserGenres:`, error);
    return getUserGenresFallback(timeRange);
  }
}

/**
 * Implementación de fallback para obtener géneros basados en artistas top
 * @param timeRange Rango de tiempo para los artistas
 * @returns Datos de géneros generados localmente
 */
async function getUserGenresFallback(timeRange: string = 'medium_term') {
  try {
    console.log('[Service] Generando géneros con fallback local desde artistas top');

    // Obtener artistas top
    const artistsData = await getTopArtists(50, timeRange);
    const artists = artistsData.items || [];

    if (artists.length === 0) {
      console.log('[Service] No se encontraron artistas, devolviendo géneros por defecto');
      return generateDefaultGenres();
    }

    // Extraer y contar géneros
    const genreCounts: Record<string, number> = {};

    artists.forEach((artist: any) => {
      if (artist.genres && artist.genres.length > 0) {
        artist.genres.forEach((genre: string) => {
          genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        });
      }
    });

    // Ordenar géneros por frecuencia
    const sortedGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / artists.length) * 100)
      }));

    return {
      success: true,
      message: "Géneros obtenidos con fallback local",
      topGenres: sortedGenres.slice(0, 20),
      allGenres: genreCounts,
      topArtists: artists.slice(0, 10).map((artist: any) => ({
        id: artist.id,
        name: artist.name,
        genres: artist.genres,
        images: artist.images,
        popularity: artist.popularity
      }))
    };
  } catch (error) {
    console.error('[Service] Error en fallback de géneros:', error);
    return generateDefaultGenres();
  }
}

/**
 * Genera datos de géneros por defecto cuando todo lo demás falla
 * @returns Datos de géneros por defecto
 */
function generateDefaultGenres() {
  console.log('[Service] Generando datos de géneros por defecto');

  // Géneros populares como fallback
  const defaultGenres = [
    "pop", "rock", "hip hop", "rap", "r&b", "latin",
    "electronic", "indie", "alternative", "jazz",
    "classical", "dance", "metal", "reggaeton", "folk"
  ];

  const genreCounts: Record<string, number> = {};

  // Asignar conteos ficticios descendentes
  defaultGenres.forEach((genre, index) => {
    genreCounts[genre] = 100 - (index * 5);
  });

  // Crear el formato del objeto de respuesta
  const sortedGenres = defaultGenres.map((name, index) => ({
    name,
    count: 100 - (index * 5),
    percentage: 100 - (index * 6)
  }));

    return {
    success: true,
    message: "Géneros por defecto (sin datos de usuario)",
    topGenres: sortedGenres.slice(0, 20),
    allGenres: genreCounts,
    topArtists: [
        {
          id: "fallback_artist_1",
        name: "Artista Pop (Default)",
          genres: ["pop", "dance pop"],
        images: [{ url: "https://placehold.co/300x300/pink/black?text=Default+Artist", height: 300, width: 300 }],
          popularity: 90
        },
        {
          id: "fallback_artist_2",
        name: "Rockstar (Default)",
          genres: ["rock", "alternative rock"],
        images: [{ url: "https://placehold.co/300x300/black/white?text=Default+Artist", height: 300, width: 300 }],
          popularity: 85
        }
      ]
    };
}

/**
 * Clase de servicio para interactuar con Spotify
 */
export class SpotifyService {
  /**
   * Busca tracks en Spotify
   * @param query Consulta de búsqueda
   * @param limit Límite de resultados
   * @returns Lista de tracks
   */
  async searchTracks(query: string, limit: number = 20) {
    return searchTracks(query, limit);
  }

  /**
   * Obtiene recomendaciones por género
   * @param genre Género musical
   * @param limit Límite de resultados
   * @returns Lista de tracks recomendados
   */
  async getRecommendations(genre: string, limit: number = 20) {
    return getTracksByGenre(genre, limit);
  }

  /**
   * Obtiene los géneros disponibles
   * @returns Lista de géneros disponibles
   */
  async getAvailableGenres() {
    return getAvailableGenres();
  }

  /**
   * Obtiene las canciones guardadas del usuario
   * @param limit Límite de resultados
   * @returns Lista de canciones guardadas
   */
  async getSavedTracks(limit: number = 20) {
    return getSavedTracks(limit);
  }
}

// Exportar una instancia singleton
export const spotifyService = new SpotifyService();
export default spotifyService;

/**
 * Búsqueda unificada que obtiene tracks, artists y playlists en una sola llamada API
 * Reemplaza las tres llamadas separadas con una única solicitud
 */
async function _searchMultiType(query: string, limit: number = 1): Promise<any> {
  try {
    console.log(`[Spotify API] Buscando "${query}" (búsqueda unificada, limit=${limit})`);

    const userCountry = await getUserCountry();
    const url = `/search?q=${encodeURIComponent(query)}&type=track,artist,playlist&limit=${limit}&market=${userCountry}`;

    const startTime = Date.now();
    const response = await requestWithToken(url);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log(`[Spotify API] Búsqueda unificada completada para "${query}" en ${responseTime}ms`);

    return {
      tracks: data.tracks?.items?.map(transformTrack) || [],
      artists: data.artists?.items || [],
      playlists: data.playlists?.items || []
    };
  } catch (error) {
    console.error('[Spotify API] Error en búsqueda unificada:', error);

    // Intentar usar la API proxy como fallback
    try {
      const apiBaseUrl = getApiBaseUrl();
      console.log(`[Spotify API] Intentando búsqueda fallback unificada para "${query}"`);

      const response = await fetch(
        `${apiBaseUrl}/spotify?action=search&query=${encodeURIComponent(query)}&type=track,artist,playlist&limit=${limit}`
      );

      if (response.ok) {
        const data = await response.json();
        return {
          tracks: (data.tracks?.items || []).map(transformTrack),
          artists: data.artists?.items || [],
          playlists: data.playlists?.items || []
        };
      }
    } catch (fallbackError) {
      console.error('[Spotify API] Error en búsqueda fallback unificada:', fallbackError);
    }

    // Si todo falla, devolver objetos vacíos
    return { tracks: [], artists: [], playlists: [] };
  }
}

// Exportar con throttling
export const searchMultiType = withThrottle(_searchMultiType, 'spotify');

// Función para obtener detalles de un álbum específico
export async function getAlbum(albumId: string) {
  try {
    // Si el usuario está en modo demo, usar datos de demo
    if (isDemoMode()) {
      console.log(`[SPOTIFY SERVICE] Obteniendo detalles del álbum: ${albumId} (MODO DEMO)`);
      const apiBaseUrl = getApiBaseUrl();
      const language = getDemoLanguage();

      // Obtener los datos de demo desde el endpoint correspondiente
      const requestUrl = `${apiBaseUrl}/demo/data?endpoint=album&albumId=${albumId}&language=${language}`;
      console.log(`[SPOTIFY SERVICE] Solicitando URL: ${requestUrl}`);

      const response = await fetch(requestUrl);

      if (!response.ok) {
        // Si no hay datos específicos para este álbum, intentar usar un álbum predeterminado
        console.log(`[SPOTIFY SERVICE] No se encontró álbum demo específico, usando álbum predeterminado`);

        // Usar un álbum predeterminado (After Hours de The Weeknd)
        return {
          id: albumId,
          name: "After Hours",
          artists: [{ id: "1", name: "The Weeknd" }],
          images: [{ url: "/placeholder-album.jpg" }],
          release_date: "2020-03-20",
          total_tracks: 14,
          popularity: 92,
          genres: ["R&B", "Pop"],
          label: "XO / Republic Records"
        };
      }

      const data = await response.json();
      console.log(`[SPOTIFY SERVICE] DEMO: Álbum con ID ${albumId} obtenido`);
      return data;
    }

    // Código para modo normal
    console.log(`Obteniendo detalles del álbum: ${albumId}`);
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(
      `${apiBaseUrl}/spotify?action=album&albumId=${albumId}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error en getAlbum:', errorData);

      if (response.status === 401 && errorData.redirect) {
        window.location.href = errorData.redirect;
        return null;
      }

      throw new Error(errorData.error || 'Error al obtener detalles del álbum');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error en getAlbum para ${albumId}:`, error);
    // Devolver álbum predeterminado en caso de error
    return {
      id: albumId,
      name: "After Hours",
      artists: [{ id: "1", name: "The Weeknd" }],
      images: [{ url: "/placeholder-album.jpg" }],
      release_date: "2020-03-20",
      total_tracks: 14,
      popularity: 92,
      genres: ["R&B", "Pop"],
      label: "XO / Republic Records"
    };
  }
}

// Función para obtener las canciones de un álbum
export async function getAlbumTracks(albumId: string, limit: number = 50) {
  try {
    // Si el usuario está en modo demo, usar datos de demo
    if (isDemoMode()) {
      console.log(`[SPOTIFY SERVICE] Obteniendo canciones del álbum: ${albumId} (MODO DEMO)`);
      const apiBaseUrl = getApiBaseUrl();
      const language = getDemoLanguage();

      // Obtener los datos de demo desde el endpoint correspondiente
      const requestUrl = `${apiBaseUrl}/demo/data?endpoint=album-tracks&albumId=${albumId}&language=${language}`;
      console.log(`[SPOTIFY SERVICE] Solicitando URL: ${requestUrl}`);

      const response = await fetch(requestUrl);

      if (!response.ok) {
        // Si no hay datos específicos, proporcionar datos genéricos para After Hours
        console.log(`[SPOTIFY SERVICE] No se encontraron canciones demo específicas, usando canciones predeterminadas`);

        // Canciones predeterminadas del álbum After Hours
        return [
          { id: "1", name: "Alone Again", duration_ms: 240000, track_number: 1, explicit: false },
          { id: "2", name: "Too Late", duration_ms: 234000, track_number: 2, explicit: false },
          { id: "3", name: "Hardest To Love", duration_ms: 193000, track_number: 3, explicit: false },
          { id: "4", name: "Scared To Live", duration_ms: 226000, track_number: 4, explicit: false },
          { id: "5", name: "Snowchild", duration_ms: 242000, track_number: 5, explicit: false },
          { id: "6", name: "Escape From LA", duration_ms: 352000, track_number: 6, explicit: false },
          { id: "7", name: "Heartless", duration_ms: 206000, track_number: 7, explicit: true },
          { id: "8", name: "Faith", duration_ms: 282000, track_number: 8, explicit: false },
          { id: "9", name: "Blinding Lights", duration_ms: 200000, track_number: 9, explicit: false },
          { id: "10", name: "In Your Eyes", duration_ms: 237000, track_number: 10, explicit: false },
          { id: "11", name: "Save Your Tears", duration_ms: 216000, track_number: 11, explicit: false },
          { id: "12", name: "Repeat After Me (Interlude)", duration_ms: 183000, track_number: 12, explicit: false },
          { id: "13", name: "After Hours", duration_ms: 360000, track_number: 13, explicit: false },
          { id: "14", name: "Until I Bleed Out", duration_ms: 201000, track_number: 14, explicit: false }
        ];
      }

      const data = await response.json();
      console.log(`[SPOTIFY SERVICE] DEMO: ${data.items?.length || 0} canciones del álbum ${albumId} obtenidas`);
      return data.items || [];
    }

    // Código para modo normal
    console.log(`Obteniendo canciones del álbum: ${albumId}`);
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(
      `${apiBaseUrl}/spotify?action=album-tracks&albumId=${albumId}&limit=${limit}`
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error en getAlbumTracks:', errorData);

      if (response.status === 401 && errorData.redirect) {
        window.location.href = errorData.redirect;
        return [];
      }

      throw new Error(errorData.error || 'Error al obtener canciones del álbum');
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error(`Error en getAlbumTracks para ${albumId}:`, error);
    // Devolver canciones predeterminadas en caso de error
    return [
      { id: "1", name: "Alone Again", duration_ms: 240000, track_number: 1, explicit: false },
      { id: "2", name: "Too Late", duration_ms: 234000, track_number: 2, explicit: false },
      { id: "3", name: "Hardest To Love", duration_ms: 193000, track_number: 3, explicit: false },
      { id: "4", name: "Scared To Live", duration_ms: 226000, track_number: 4, explicit: false },
      { id: "5", name: "Snowchild", duration_ms: 242000, track_number: 5, explicit: false },
      { id: "6", name: "Escape From LA", duration_ms: 352000, track_number: 6, explicit: false },
      { id: "7", name: "Heartless", duration_ms: 206000, track_number: 7, explicit: true },
      { id: "8", name: "Faith", duration_ms: 282000, track_number: 8, explicit: false },
      { id: "9", name: "Blinding Lights", duration_ms: 200000, track_number: 9, explicit: false },
      { id: "10", name: "In Your Eyes", duration_ms: 237000, track_number: 10, explicit: false },
      { id: "11", name: "Save Your Tears", duration_ms: 216000, track_number: 11, explicit: false },
      { id: "12", name: "Repeat After Me (Interlude)", duration_ms: 183000, track_number: 12, explicit: false },
      { id: "13", name: "After Hours", duration_ms: 360000, track_number: 13, explicit: false },
      { id: "14", name: "Until I Bleed Out", duration_ms: 201000, track_number: 14, explicit: false }
    ];
  }
}
