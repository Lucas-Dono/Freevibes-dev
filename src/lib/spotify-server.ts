// src/lib/spotify-server.ts

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  retrieved_at?: number; // Timestamp (ms) when token was retrieved
}

export interface SpotifyArtistSearchResult {
  artists: {
    items: Array<{ id: string; name: string; images: Array<{ url: string }> }>;
  };
}

export interface SpotifyTopTracksResponse {
  tracks: SpotifyTrack[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ id: string; name: string }>;
  album: {
    id: string;
    name: string;
    images: Array<{ url: string; height: number; width: number }>;
  };
  duration_ms: number;
  explicit: boolean;
  popularity: number;
  uri: string;
  external_urls: {
    spotify: string;
  };
}

// Simple in-memory cache for the access token
let tokenCache: SpotifyTokenResponse | null = null;

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_ACCOUNTS_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

/**
 * Gets a Spotify API access token using Client Credentials Flow.
 * Handles basic in-memory caching.
 */
async function getSpotifyAccessToken(): Promise<string | null> {
  const now = Date.now();

  // Check cache first (token valid for expires_in seconds, check with 60s buffer)
  if (tokenCache && tokenCache.retrieved_at && (now - tokenCache.retrieved_at < (tokenCache.expires_in - 60) * 1000)) {
    // console.log('[Spotify Server] Using cached access token.');
    return tokenCache.access_token;
  }

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.error('[Spotify Server] Missing Spotify Client ID or Secret in environment variables.');
    return null;
  }

  console.log('[Spotify Server] Requesting new access token...');
  try {
    const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const response = await fetch(SPOTIFY_ACCOUNTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
      },
      body: 'grant_type=client_credentials',
      cache: 'no-store', // Ensure fresh token request
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Spotify Server] Error fetching token: ${response.status} ${response.statusText}`, errorBody);
      tokenCache = null; // Clear cache on error
      return null;
    }

    const tokenData = (await response.json()) as SpotifyTokenResponse;
    tokenData.retrieved_at = now; // Store retrieval time in milliseconds
    tokenCache = tokenData; // Update cache
    console.log('[Spotify Server] New access token obtained.');
    return tokenData.access_token;

  } catch (error) {
    console.error('[Spotify Server] Exception fetching access token:', error);
    tokenCache = null; // Clear cache on error
    return null;
  }
}

/**
 * Searches for an artist on Spotify and returns the ID of the first match.
 */
export async function searchSpotifyArtistId(name: string): Promise<string | null> {
    console.log('[Spotify Server] searchSpotifyArtistId called with name:', name);
    const token = await getSpotifyAccessToken();
    if (!token) {
        console.log('[Spotify Server] searchSpotifyArtistId: No token obtained.');
        return null;
    }
    console.log('[Spotify Server] searchSpotifyArtistId: Token obtained.');

    const query = encodeURIComponent(name);
    const market = 'ES';
    const url = `${SPOTIFY_API_BASE_URL}/search?q=${query}&type=artist&market=${market}&limit=1`;
    console.log(`[Spotify Server] Searching Spotify API: ${url}`);

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` },
            cache: 'no-store'
        });
        console.log(`[Spotify Server] Spotify API response status: ${response.status}`);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[Spotify Server] Error searching artist '${name}': ${response.status} ${response.statusText}`, errorBody);
            return null;
        }

        const data = await response.json() as SpotifyArtistSearchResult;
        console.log(`[Spotify Server] Spotify API response data parsed.`);
        const artists = data?.artists?.items;

        if (artists && artists.length > 0) {
            console.log(`[Spotify Server] Found Spotify artist ID for '${name}': ${artists[0].id}`);
            return artists[0].id;
        } else {
            console.log(`[Spotify Server] Artist '${name}' not found in Spotify API response.`);
            return null;
        }
    } catch (error) {
        console.error(`[Spotify Server] Exception during fetch/processing for artist '${name}':`, error);
        return null;
    }
}

/**
 * Gets the top tracks for a given Spotify artist ID.
 */
export async function getSpotifyArtistTopTracks(artistId: string): Promise<SpotifyTrack[]> {
  const token = await getSpotifyAccessToken();
  if (!token) return [];

  // Specify market 'ES' for Spain as an example, adjust as needed or make dynamic
  const market = 'ES';
  const url = `${SPOTIFY_API_BASE_URL}/artists/${artistId}/top-tracks?market=${market}`;
  console.log(`[Spotify Server] Fetching top tracks for artist: ${url}`);

  try {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
      cache: 'no-store' // Don't cache this here, let frontend handle caching if needed
    });

    if (!response.ok) {
      console.error(`[Spotify Server] Error fetching top tracks for artist ${artistId}: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json() as SpotifyTopTracksResponse;
    console.log(`[Spotify Server] Fetched ${data?.tracks?.length ?? 0} top tracks for artist ${artistId}`);
    return (data?.tracks || []) as SpotifyTrack[];

  } catch (error) {
    console.error(`[Spotify Server] Exception fetching top tracks for artist ${artistId}:`, error);
    return [];
  }
}

/**
 * Selects the best image URL from Spotify's image array.
 * Prefers images closer to a target height (e.g., 300px).
 */
function selectBestImage(images: Array<{ url: string; height: number; width: number }>, targetHeight: number = 300): string {
    if (!images || images.length === 0) {
        return '/placeholder-album.jpg'; // Default placeholder
    }

    // Sort images by how close their height is to the target height
    const sortedImages = [...images].sort((a, b) => {
        const diffA = Math.abs((a.height || 0) - targetHeight);
        const diffB = Math.abs((b.height || 0) - targetHeight);
        return diffA - diffB;
    });

    return sortedImages[0]?.url || '/placeholder-album.jpg';
}

/**
 * Formats a Spotify track object into our application's Track structure.
 * Replace 'any' with your actual Track interface type imported from types.
 */
export function formatSpotifyTrack(spotifyTrack: SpotifyTrack): any /* YourTrackInterface */ {
  if (!spotifyTrack) return null;

  const imageUrl = selectBestImage(spotifyTrack.album?.images);

  return {
    id: spotifyTrack.id, // Use Spotify ID
    title: spotifyTrack.name,
    artist: spotifyTrack.artists?.map((a) => a.name).join(', ') || 'Unknown Artist',
    album: spotifyTrack.album?.name || 'Unknown Album',
    cover: imageUrl,
    albumCover: imageUrl,
    duration: spotifyTrack.duration_ms / 1000, // Convert ms to seconds
    source: 'spotify',
    spotifyId: spotifyTrack.id, // Keep spotify ID explicitly
    youtubeId: undefined, // Needs separate lookup if required
    // --- Add any other fields your Track interface requires --- 
    // Example: popularity: spotifyTrack.popularity,
    // Example: previewUrl: spotifyTrack.preview_url, 
    // Example: externalUrl: spotifyTrack.external_urls?.spotify,
  };
}

/**
 * Obtiene detalles de un artista desde Spotify usando Client Credentials.
 * @param artistId El ID del artista de Spotify.
 * @returns Los detalles del artista o null si hay error.
 */
export async function getSpotifyArtistDetails(artistId: string): Promise<any | null> {
  console.log(`[Spotify Server] getSpotifyArtistDetails llamado para ID: ${artistId}`);
  const token = await getSpotifyAccessToken();

  if (!token) {
    console.error('[Spotify Server] No se pudo obtener token para getSpotifyArtistDetails');
    return null;
  }

  const url = `https://api.spotify.com/v1/artists/${artistId}`;
  console.log(`[Spotify Server] Solicitando detalles del artista a: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`[Spotify Server] Respuesta de Spotify API para detalles: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[Spotify Server] Error al obtener detalles del artista ${artistId}: ${response.status}`, errorData);
      return null;
    }

    const data = await response.json();
    console.log(`[Spotify Server] Detalles del artista ${artistId} obtenidos correctamente.`);
    return data;

  } catch (error) {
    console.error(`[Spotify Server] Excepción al obtener detalles del artista ${artistId}:`, error);
    return null;
  }
}

/**
 * Obtiene los álbumes de un artista desde Spotify usando Client Credentials.
 * @param artistId El ID del artista de Spotify.
 * @param limit Límite de álbumes a obtener.
 * @returns Un array con los álbumes o null si hay error.
 */
export async function getSpotifyArtistAlbums(artistId: string, limit: number = 20): Promise<any[] | null> {
  console.log(`[Spotify Server] getSpotifyArtistAlbums llamado para ID: ${artistId}, limit: ${limit}`);
  const token = await getSpotifyAccessToken();

  if (!token) {
    console.error('[Spotify Server] No se pudo obtener token para getSpotifyArtistAlbums');
    return null;
  }

  // Incluir álbumes y sencillos, ordenar por fecha
  const url = `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&limit=${limit}&market=ES`; 
  console.log(`[Spotify Server] Solicitando álbumes del artista a: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`[Spotify Server] Respuesta de Spotify API para álbumes: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[Spotify Server] Error al obtener álbumes del artista ${artistId}: ${response.status}`, errorData);
      return null;
    }

    const data = await response.json();
    console.log(`[Spotify Server] Álbumes del artista ${artistId} obtenidos: ${data.items?.length || 0}`);
    return data.items || []; // Devolver el array de álbumes

  } catch (error) {
    console.error(`[Spotify Server] Excepción al obtener álbumes del artista ${artistId}:`, error);
    return null;
  }
}

/**
 * Obtiene artistas relacionados a un artista dado desde Spotify usando Client Credentials.
 * @param artistId El ID del artista de Spotify.
 * @returns Un array con los artistas relacionados o null si hay error.
 */
export async function getSpotifyRelatedArtists(artistId: string): Promise<any[] | null> {
  console.log(`[Spotify Server] getSpotifyRelatedArtists llamado para ID: ${artistId}`);
  const token = await getSpotifyAccessToken();

  if (!token) {
    console.error('[Spotify Server] No se pudo obtener token para getSpotifyRelatedArtists');
    return null;
  }

  const url = `https://api.spotify.com/v1/artists/${artistId}/related-artists`;
  console.log(`[Spotify Server] Solicitando artistas relacionados a: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`[Spotify Server] Respuesta de Spotify API para relacionados: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[Spotify Server] Error al obtener relacionados para ${artistId}: ${response.status}`, errorData);
      // Si es un 404, significa que no hay relacionados, devolver array vacío
      if (response.status === 404) {
        console.log(`[Spotify Server] Artista ${artistId} no tiene relacionados según Spotify API (404).`);
        return []; 
      }
      return null; // Para otros errores (500, 401, 403, etc.), devolver null
    }

    const data = await response.json();
    console.log(`[Spotify Server] Artistas relacionados para ${artistId} obtenidos: ${data.artists?.length || 0}`);
    return data.artists || []; // Devolver el array de artistas

  } catch (error) {
    console.error(`[Spotify Server] Excepción al obtener relacionados para ${artistId}:`, error);
    return null;
  }
}

/**
 * Obtiene detalles de un álbum desde Spotify usando Client Credentials.
 * @param albumId El ID del álbum de Spotify.
 * @returns Los detalles del álbum o null si hay error.
 */
export async function getSpotifyAlbumDetails(albumId: string): Promise<any | null> {
  console.log(`[Spotify Server] getSpotifyAlbumDetails llamado para ID: ${albumId}`);
  const token = await getSpotifyAccessToken();

  if (!token) {
    console.error('[Spotify Server] No se pudo obtener token para getSpotifyAlbumDetails');
    return null;
  }

  const url = `${SPOTIFY_API_BASE_URL}/albums/${albumId}`;
  console.log(`[Spotify Server] Solicitando detalles del álbum a: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      cache: 'no-store'
    });

    console.log(`[Spotify Server] Respuesta de Spotify API para detalles del álbum: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[Spotify Server] Error al obtener detalles del álbum ${albumId}: ${response.status}`, errorData);
      return null;
    }

    const albumData = await response.json();
    console.log(`[Spotify Server] Detalles del álbum ${albumId} obtenidos.`);
    // Puedes añadir aquí formateo si es necesario antes de devolver
    return albumData;

  } catch (error) {
    console.error(`[Spotify Server] Excepción al obtener detalles del álbum ${albumId}:`, error);
    return null;
  }
}

/**
 * Obtiene las pistas de un álbum desde Spotify usando Client Credentials.
 * @param albumId El ID del álbum de Spotify.
 * @param limit Límite de pistas a obtener (Spotify por defecto 50 máx).
 * @returns Un array de pistas formateadas o un array vacío si hay error.
 */
export async function getSpotifyAlbumTracks(albumId: string, limit: number = 50): Promise<any[]> {
  console.log(`[Spotify Server] getSpotifyAlbumTracks llamado para ID: ${albumId}`);
  const token = await getSpotifyAccessToken();

  if (!token) {
    console.error('[Spotify Server] No se pudo obtener token para getSpotifyAlbumTracks');
    return [];
  }

  const url = `${SPOTIFY_API_BASE_URL}/albums/${albumId}/tracks?limit=${limit}`;
  console.log(`[Spotify Server] Solicitando pistas del álbum a: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      cache: 'no-store'
    });

    console.log(`[Spotify Server] Respuesta de Spotify API para pistas del álbum: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[Spotify Server] Error al obtener pistas del álbum ${albumId}: ${response.status}`, errorData);
      return [];
    }

    const tracksData = await response.json();
    console.log(`[Spotify Server] Pistas del álbum ${albumId} obtenidas: ${tracksData?.items?.length ?? 0}`);

    // Formatear las pistas si es necesario (usando formatSpotifyTrack si aplica)
    // Spotify devuelve un objeto con { items: [trackSimplificado] }
    // Necesitamos asegurarnos de que formatSpotifyTrack funcione con trackSimplificado
    // o ajustar el formateo aquí. Por ahora, devolvemos los items directamente.
    // Si formatSpotifyTrack espera un objeto Track completo, podríamos necesitar otra llamada por pista o ajustar.
    // *** Consideración: El objeto Track simplificado puede no tener toda la info que formatSpotifyTrack espera (ej: album.images) ***
    // Por simplicidad inicial, devolvemos los items. Adaptar el frontend o el formateo si es necesario.
    const formattedTracks = (tracksData?.items || []).map((track: any) => {
       // ¡Ojo! track aquí es un SimplifiedTrackObject de Spotify.
       // Puede que necesitemos enriquecerlo o ajustar formatSpotifyTrack.
       // Por ahora, intentamos un formateo básico si tenemos la función.
       // return formatSpotifyTrack ? formatSpotifyTrack(track) : track;
       // Devolver el track simplificado por ahora para evitar errores si formatSpotifyTrack falla.
       // El frontend tendrá que adaptarse a este formato simplificado o hacemos llamadas adicionales.
       return {
        id: track.id,
        title: track.name,
        artist: track.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
        duration: track.duration_ms / 1000,
        spotifyId: track.id,
        // Faltan cover/albumCover/album name porque no están en SimplifiedTrackObject
        source: 'spotify'
       };
    });


    return formattedTracks;

  } catch (error) {
    console.error(`[Spotify Server] Excepción al obtener pistas del álbum ${albumId}:`, error);
    return [];
  }
} 