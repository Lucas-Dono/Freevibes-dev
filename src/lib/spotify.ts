import { cookies } from 'next/headers';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

interface SpotifyOptions {
    limit?: number;
    offset?: number;
    time_range?: 'short_term' | 'medium_term' | 'long_term';
    market?: string;
    locale?: string;
    country?: string;
}

interface SpotifyRecommendationOptions extends SpotifyOptions {
    seed_genres?: string[];
    seed_tracks?: string[];
    seed_artists?: string[];
    min_popularity?: number;
    max_popularity?: number;
    target_popularity?: number;
}

// Lista de géneros populares por defecto para usar cuando no hay datos del usuario
const DEFAULT_GENRES = ['pop', 'rock', 'electronic', 'hip-hop', 'latin'];

// Lista extendida de géneros disponibles en Spotify (pre-cargada para evitar llamadas a la API)
const SPOTIFY_GENRES = [
    'acoustic', 'afrobeat', 'alt-rock', 'alternative', 'ambient', 'anime', 
    'black-metal', 'bluegrass', 'blues', 'bossanova', 'brazil', 'breakbeat',
    'british', 'cantopop', 'chicago-house', 'children', 'chill', 'classical',
    'club', 'comedy', 'country', 'dance', 'dancehall', 'death-metal', 'deep-house',
    'detroit-techno', 'disco', 'disney', 'drum-and-bass', 'dub', 'dubstep', 'edm',
    'electro', 'electronic', 'emo', 'folk', 'forro', 'french', 'funk', 'garage',
    'german', 'gospel', 'goth', 'grindcore', 'groove', 'grunge', 'guitar',
    'happy', 'hard-rock', 'hardcore', 'hardstyle', 'heavy-metal', 'hip-hop', 'house',
    'idm', 'indian', 'indie', 'indie-pop', 'industrial', 'iranian', 'j-dance',
    'j-idol', 'j-pop', 'j-rock', 'jazz', 'k-pop', 'kids', 'latin', 'latino',
    'malay', 'mandopop', 'metal', 'metal-misc', 'metalcore', 'minimal-techno',
    'movies', 'mpb', 'new-age', 'new-release', 'opera', 'pagode', 'party',
    'philippines-opm', 'piano', 'pop', 'pop-film', 'post-dubstep', 'power-pop',
    'progressive-house', 'psych-rock', 'punk', 'punk-rock', 'r-n-b', 'rainy-day',
    'reggae', 'reggaeton', 'road-trip', 'rock', 'rock-n-roll', 'rockabilly', 'romance',
    'sad', 'salsa', 'samba', 'sertanejo', 'show-tunes', 'singer-songwriter', 'ska',
    'sleep', 'songwriter', 'soul', 'soundtracks', 'spanish', 'study', 'summer',
    'swedish', 'synth-pop', 'tango', 'techno', 'trance', 'trip-hop', 'turkish',
    'work-out', 'world-music'
];

// Sistema simple de caché para reducir llamadas a la API
const apiCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos en milisegundos

// Sistema de rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 segundo entre solicitudes

// Función mejorada para llamadas a la API de Spotify con caché y rate limiting
export async function fetchFromSpotify(endpoint: string, token: string, options = {}) {
  try {
    // Verificar cache
    const cacheKey = `${endpoint}:${JSON.stringify(options)}`;
    const cachedData = apiCache.get(cacheKey);
    
    if (cachedData && cachedData.expiry > Date.now()) {
      console.log(`[Spotify] Usando datos en caché para: ${endpoint}`);
      return cachedData.data;
    }
    
    // Rate limiting - esperar si la última solicitud fue muy reciente
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      console.log(`[Spotify] Rate limiting: esperando ${waitTime}ms antes de la solicitud a ${endpoint}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // Actualizar timestamp para rate limiting
    lastRequestTime = Date.now();
    
    // Construir URL completa
    const url = `https://api.spotify.com/v1${endpoint}`;
    console.log(`[Spotify] Iniciando solicitud a: ${url}`);
    
    const startTime = Date.now();
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    const elapsedTime = Date.now() - startTime;
    console.log(`[Spotify] Tiempo de respuesta: ${elapsedTime}ms para ${endpoint}`);
    
    // Si el token ha expirado, intentar refrescarlo
    if (response.status === 401) {
      console.log('[Spotify] Token expirado, intentando refrescar...');
      const refreshResponse = await fetch('/api/auth/spotify/refresh');
      
      if (refreshResponse.ok) {
        const { access_token } = await refreshResponse.json();
        console.log('[Spotify] Token refrescado exitosamente, reintentando solicitud original');
        
        // Reintentar la solicitud con el nuevo token
        const retryResponse = await fetch(url, {
          ...options,
          headers: {
            Authorization: `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!retryResponse.ok) {
          const errorText = await retryResponse.text();
          console.error(`[Spotify] Error ${retryResponse.status} en reintento:`, errorText);
          throw new Error(`Error ${retryResponse.status}: ${errorText}`);
        }
        
        const data = await retryResponse.json();
        apiCache.set(cacheKey, {
          data,
          expiry: Date.now() + CACHE_DURATION
        });
        return data;
      } else {
        console.error('[Spotify] Error al refrescar token:', await refreshResponse.text());
        throw new Error('Error al refrescar el token de acceso');
      }
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Spotify] Error ${response.status} en solicitud a ${endpoint}:`, errorText);
      throw new Error(`Error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`[Spotify] Solicitud completada exitosamente: ${endpoint}`);
    
    apiCache.set(cacheKey, {
      data,
      expiry: Date.now() + CACHE_DURATION
    });
    
    return data;
  } catch (error) {
    console.error('[Spotify] Error en fetchFromSpotify:', error);
    throw error;
  }
}

/**
 * Crea una instancia de cliente para la API de Spotify con el token de acceso proporcionado
 * @param accessToken Token de acceso válido para la API de Spotify
 * @returns Objeto con métodos para interactuar con la API de Spotify
 */
export function createSpotifyApi(accessToken: string) {
    /**
     * Obtiene información del perfil del usuario actual
     */
    const getProfile = async () => {
        return fetchFromSpotify('/me', accessToken);
    };
    
    /**
     * Busca pistas en Spotify
     * @param query Texto de búsqueda
     * @param options Opciones adicionales (límite, etc.)
     */
    const searchTracks = async (query: string, options: SpotifyOptions = {}) => {
        const params = new URLSearchParams({
            q: query,
            type: 'track',
            limit: options.limit?.toString() || '20',
            market: options.market || 'ES'
        });
        return fetchFromSpotify(`/search?${params.toString()}`, accessToken);
    };

    /**
     * Obtiene las pistas guardadas del usuario
     * @param options Opciones adicionales (límite, offset, etc.)
     */
    const getMySavedTracks = async (options: SpotifyOptions = {}) => {
        const params = new URLSearchParams({
            limit: options.limit?.toString() || '20',
            market: options.market || 'ES'
        });
        
        // Añadir offset si está definido
        if (options.offset !== undefined) {
            params.append('offset', options.offset.toString());
        }
        
        return fetchFromSpotify(`/me/tracks?${params.toString()}`, accessToken);
    };

    /**
     * Obtiene las pistas más reproducidas por el usuario
     * @param options Opciones adicionales (límite, offset, rango de tiempo, etc.)
     */
    const getMyTopTracks = async (options: SpotifyOptions = {}) => {
        const params = new URLSearchParams({
            limit: options.limit?.toString() || '20',
            time_range: options.time_range || 'medium_term',
            market: options.market || 'ES'
        });
        
        // Añadir offset si está definido
        if (options.offset !== undefined) {
            params.append('offset', options.offset.toString());
        }
        
        return fetchFromSpotify(`/me/top/tracks?${params.toString()}`, accessToken);
    };

    /**
     * Obtiene los artistas más escuchados por el usuario
     * @param options Opciones adicionales (límite, rango de tiempo, etc.)
     */
    const getMyTopArtists = async (options: SpotifyOptions = {}) => {
        const params = new URLSearchParams({
            limit: options.limit?.toString() || '10',
            time_range: options.time_range || 'medium_term'
        });
        return fetchFromSpotify(`/me/top/artists?${params.toString()}`, accessToken);
    };

    /**
     * Obtiene las playlists destacadas
     * @param options Opciones adicionales (límite, offset, locale, etc.)
     */
    const getFeaturedPlaylists = async (options: SpotifyOptions = {}) => {
        console.log('Iniciando solicitud de playlists destacadas con opciones:', options);
        const params = new URLSearchParams({
            limit: options.limit?.toString() || '20',
            market: options.market || 'ES'
        });
        
        // Añadir offset si está definido
        if (options.offset !== undefined) {
            params.append('offset', options.offset.toString());
        }
        
        // Añadir locale si está definido
        if (options.locale) {
            params.append('locale', options.locale);
        }
        
        try {
            console.log(`Intentando obtener playlists destacadas con URL: /browse/featured-playlists?${params.toString()}`);
            const featuredData = await fetchFromSpotify(`/browse/featured-playlists?${params.toString()}`, accessToken);
            console.log('Respuesta de playlists destacadas recibida correctamente');
            return featuredData;
        } catch (error) {
            console.error('Error al obtener playlists destacadas, intentando alternativa:', error);
            
            // Plan B: Intentar obtener playlists del usuario
            try {
                console.log('Intentando obtener playlists del usuario como alternativa');
                const userPlaylists = await fetchFromSpotify(`/me/playlists?limit=${options.limit || 20}`, accessToken);
                
                // Transformar formato para que coincida con el de featured playlists
                return {
                    message: "Playlists alternativas",
                    playlists: {
                        href: userPlaylists.href,
                        items: userPlaylists.items || [],
                        limit: userPlaylists.limit,
                        next: userPlaylists.next,
                        offset: userPlaylists.offset,
                        previous: userPlaylists.previous,
                        total: userPlaylists.total
                    }
                };
            } catch (fallbackError) {
                console.error('También falló la alternativa de playlists de usuario:', fallbackError);
                
                // Plan C: Si todo falla, devolver un conjunto de datos mockeados
                console.log('Devolviendo datos mockeados de playlists destacadas');
                return {
                    message: "Playlists recomendadas",
                    playlists: {
                        href: "https://api.spotify.com/v1/browse/featured-playlists",
                        items: [
                            {
                                collaborative: false,
                                description: "Playlist recomendada (datos fallback)",
                                id: "fallback_playlist_1",
                                images: [{ url: "https://placehold.co/600x600/orange/white?text=Musica+Popular", height: 600, width: 600 }],
                                name: "Música Popular",
                                owner: { display_name: "Spotify" },
                                public: true,
                                tracks: { total: 50 }
                            },
                            {
                                collaborative: false,
                                description: "Lo mejor de la música latina (datos fallback)",
                                id: "fallback_playlist_2",
                                images: [{ url: "https://placehold.co/600x600/green/white?text=Exitos+Latinos", height: 600, width: 600 }],
                                name: "Éxitos Latinos",
                                owner: { display_name: "Spotify" },
                                public: true,
                                tracks: { total: 50 }
                            },
                            {
                                collaborative: false,
                                description: "Rock clásico y contemporáneo (datos fallback)",
                                id: "fallback_playlist_3",
                                images: [{ url: "https://placehold.co/600x600/red/white?text=Rock+Classics", height: 600, width: 600 }],
                                name: "Rock Classics",
                                owner: { display_name: "Spotify" },
                                public: true,
                                tracks: { total: 50 }
                            }
                        ],
                        limit: parseInt(options.limit?.toString() || "20"),
                        next: null,
                        offset: parseInt(options.offset?.toString() || "0"),
                        previous: null,
                        total: 3
                    }
                };
            }
        }
    };

    /**
     * Obtiene las canciones reproducidas recientemente
     * @param options Opciones adicionales (límite, etc.)
     */
    const getRecentlyPlayed = async (options: SpotifyOptions = {}) => {
        const params = new URLSearchParams({
            limit: options.limit?.toString() || '20'
        });
        
        // Añadir after (usado en lugar de offset para recently played)
        if (options.offset !== undefined) {
            // La API de Spotify usa timestamps en lugar de offset numérico para paginación
            // Esto es una simulación simplificada para compatibilidad con la interfaz
            const now = new Date();
            // Simular paginación restando horas según el offset
            const timestampMs = now.getTime() - (options.offset * 3600000);
            params.append('after', timestampMs.toString());
        }
        
        return fetchFromSpotify(`/me/player/recently-played?${params.toString()}`, accessToken);
    };

    /**
     * Obtiene los géneros disponibles para seeds de recomendaciones
     * Nota: En lugar de hacer una llamada a la API, devuelve una lista predefinida
     * de géneros conocidos para evitar problemas con el endpoint.
     */
    const getAvailableGenreSeeds = async () => {
        console.log('Usando lista predefinida de géneros en lugar de llamar a la API');
        return { 
            genres: SPOTIFY_GENRES,
            source: 'cached'
        };
    };

    /**
     * Obtiene recomendaciones de pistas basadas en seeds
     * @param options Opciones de recomendación (seeds de artistas, géneros, pistas, etc.)
     */
    const getRecommendations = async (options: SpotifyRecommendationOptions = {}) => {
        console.log('Iniciando solicitud de recomendaciones alternativa');
        
        // Si no hay seeds definidos o hay errores, intentaremos usar una búsqueda
        // en lugar del endpoint de recomendaciones
        
        // Determinar el género a usar como semilla para la búsqueda
        let searchGenre = 'pop'; // género por defecto
        
        if (options.seed_genres && options.seed_genres.length > 0) {
            searchGenre = options.seed_genres[0]; // usar el primer género como semilla
            console.log('Usando género para búsqueda alternativa:', searchGenre);
        }
        
        // Construir una búsqueda de tracks con el género
        const params = new URLSearchParams({
            q: `genre:${searchGenre}`,
            type: 'track',
            limit: (options.limit || 20).toString(),
            market: options.market || 'ES'
        });
        
        console.log('Realizando búsqueda alternativa:', `/search?${params.toString()}`);
        try {
            // Usar búsqueda en lugar de recomendaciones
            const searchResults = await fetchFromSpotify(`/search?${params.toString()}`, accessToken);
            
            // Transformar los resultados de búsqueda en formato similar al de recomendaciones
            return {
                tracks: searchResults.tracks?.items || [],
                seeds: [
                    {
                        id: searchGenre,
                        type: 'GENRE',
                        initialPoolSize: searchResults.tracks?.items?.length || 0,
                        afterFilteringSize: searchResults.tracks?.items?.length || 0,
                        afterRelinkingSize: searchResults.tracks?.items?.length || 0
                    }
                ]
            };
        } catch (error) {
            console.error('Error en la búsqueda alternativa:', error);
            
            // Si todo falla, intentar con una búsqueda por popularidad
            console.log('Intentando búsqueda general por popularidad');
            const fallbackParams = new URLSearchParams({
                q: 'year:2023',
                type: 'track',
                limit: (options.limit || 20).toString(),
                market: options.market || 'ES'
            });
            
            try {
                const fallbackResults = await fetchFromSpotify(`/search?${fallbackParams.toString()}`, accessToken);
                return {
                    tracks: fallbackResults.tracks?.items || [],
                    seeds: [
                        {
                            id: 'popular',
                            type: 'FALLBACK',
                            initialPoolSize: fallbackResults.tracks?.items?.length || 0,
                            afterFilteringSize: fallbackResults.tracks?.items?.length || 0,
                            afterRelinkingSize: fallbackResults.tracks?.items?.length || 0
                        }
                    ]
                };
            } catch (fallbackError) {
                console.error('Error en búsqueda de respaldo:', fallbackError);
                throw new Error('No fue posible obtener recomendaciones ni realizar búsquedas alternativas');
            }
        }
    };

    /**
     * Obtiene las pistas de una playlist
     * @param playlistId ID de la playlist
     * @param options Opciones adicionales (límite, etc.)
     */
    const getPlaylistTracks = async (playlistId: string, options: SpotifyOptions = {}) => {
        const params = new URLSearchParams({
            limit: options.limit?.toString() || '20',
            market: options.market || 'ES'
        });
        return fetchFromSpotify(`/playlists/${playlistId}/tracks?${params.toString()}`, accessToken);
    };

    /**
     * Obtiene los nuevos lanzamientos
     * @param options Opciones adicionales (límite, etc.)
     */
    const getNewReleases = async (options: SpotifyOptions = {}) => {
        try {
            console.log('[API] Intentando obtener nuevos lanzamientos');
            const params = new URLSearchParams({
                limit: options.limit?.toString() || '20',
                market: options.market || 'ES'
            });
            const releasesData = await fetchFromSpotify(`/browse/new-releases?${params.toString()}`, accessToken);
            console.log(`[API] Obtenidos ${releasesData.albums?.items?.length || 0} nuevos lanzamientos`);
            return releasesData;
        } catch (error) {
            console.error('[API] Error al obtener nuevos lanzamientos, usando datos de respaldo:', error);
            // Devolver datos fallback si hay error
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
                    ],
                    total: 2
                }
            };
        }
    };

    /**
     * Obtiene las playlists del usuario actual
     * @param options Opciones adicionales (límite, etc.)
     */
    const getUserPlaylists = async (options: SpotifyOptions = {}) => {
        const params = new URLSearchParams({
            limit: options.limit?.toString() || '20'
        });
        return fetchFromSpotify(`/me/playlists?${params.toString()}`, accessToken);
    };

    /**
     * Obtiene información detallada de una playlist
     * @param playlistId ID de la playlist
     * @param options Opciones adicionales
     */
    const getPlaylist = async (playlistId: string, options: SpotifyOptions = {}) => {
        const params = new URLSearchParams({
            market: options.market || 'ES'
        });
        return fetchFromSpotify(`/playlists/${playlistId}?${params.toString()}`, accessToken);
    };

    /**
     * Obtiene información detallada de una canción
     * @param trackId ID de la canción en Spotify
     * @param options Opciones adicionales
     */
    const getTrack = async (trackId: string, options: SpotifyOptions = {}) => {
        const params = new URLSearchParams({
            market: options.market || 'ES'
        });
        return fetchFromSpotify(`/tracks/${trackId}?${params.toString()}`, accessToken);
    };

    /**
     * Obtiene información de un artista
     * @param artistId ID del artista
     */
    const getArtist = async (artistId: string) => {
        return fetchFromSpotify(`/artists/${artistId}`, accessToken);
    };

    /**
     * Obtiene las canciones más populares de un artista
     * @param artistId ID del artista
     * @param options Opciones adicionales
     */
    const getArtistTopTracks = async (artistId: string, options: SpotifyOptions = {}) => {
        const params = new URLSearchParams({
            market: options.market || 'ES'
        });
        return fetchFromSpotify(`/artists/${artistId}/top-tracks?${params.toString()}`, accessToken);
    };

    /**
     * Obtiene los álbumes de un artista
     * @param artistId ID del artista
     * @param options Opciones adicionales
     */
    const getArtistAlbums = async (artistId: string, options: SpotifyOptions = {}) => {
        const params = new URLSearchParams({
            limit: options.limit?.toString() || '20',
            market: options.market || 'ES'
        });
        return fetchFromSpotify(`/artists/${artistId}/albums?${params.toString()}`, accessToken);
    };

    /**
     * Obtiene artistas relacionados con un artista
     * @param artistId ID del artista
     */
    const getRelatedArtists = async (artistId: string) => {
        return fetchFromSpotify(`/artists/${artistId}/related-artists`, accessToken);
    };

    /**
     * Busca artistas en Spotify
     * @param query Texto de búsqueda
     * @param options Opciones adicionales (límite, etc.)
     */
    const searchArtists = async (query: string, options: SpotifyOptions = {}) => {
        const params = new URLSearchParams({
            q: query,
            type: 'artist',
            limit: options.limit?.toString() || '20',
            market: options.market || 'ES'
        });
        return fetchFromSpotify(`/search?${params.toString()}`, accessToken);
    };

    /**
     * Busca playlists en Spotify
     * @param query Texto de búsqueda
     * @param options Opciones adicionales (límite, etc.)
     */
    const searchPlaylists = async (query: string, options: SpotifyOptions = {}) => {
        const params = new URLSearchParams({
            q: query,
            type: 'playlist',
            limit: options.limit?.toString() || '20',
            market: options.market || 'ES'
        });
        return fetchFromSpotify(`/search?${params.toString()}`, accessToken);
    };

    /**
     * Obtiene categorías de Spotify
     * @param options Opciones adicionales (límite, etc.)
     */
    const getCategories = async (options: SpotifyOptions = {}) => {
        const params = new URLSearchParams({
            limit: options.limit?.toString() || '20',
            country: options.market || 'ES'
        });
        return fetchFromSpotify(`/browse/categories?${params.toString()}`, accessToken);
    };

    /**
     * Obtiene playlists de una categoría
     * @param categoryId ID de la categoría
     * @param options Opciones adicionales (límite, etc.)
     */
    const getCategoryPlaylists = async (categoryId: string, options: SpotifyOptions = {}) => {
        const params = new URLSearchParams({
            limit: options.limit?.toString() || '20',
            country: options.market || 'ES'
        });
        return fetchFromSpotify(`/browse/categories/${categoryId}/playlists?${params.toString()}`, accessToken);
    };

    /**
     * Realiza una solicitud directa a cualquier endpoint de la API de Spotify
     * @param endpoint Endpoint de la API de Spotify (con o sin / inicial)
     * @returns Respuesta JSON de la API
     */
    const makeRequest = async (endpoint: string) => {
        // Normalizar el endpoint para asegurar formato correcto
        const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        
        // Verificar si es una búsqueda y si tiene el parámetro type
        if (normalizedEndpoint.includes('/search') && !normalizedEndpoint.includes('type=')) {
            console.error('[Spotify] Error: Solicitud a /search sin parámetro type');
            throw new Error('El parámetro type es obligatorio para búsquedas en Spotify');
        }
        
        return fetchFromSpotify(normalizedEndpoint, accessToken);
    };

    /**
     * Realiza una búsqueda multi-tipo que combina diferentes tipos de contenido en una sola llamada API
     * @param query Término de búsqueda
     * @param types Tipos de contenido a buscar (track, artist, album, playlist)
     * @param options Opciones adicionales para la búsqueda
     */
    const searchMultiType = async (query: string, types: ('track' | 'artist' | 'album' | 'playlist')[], options: { limit?: number } = {}) => {
      if (!query) {
        console.warn('[Spotify] searchMultiType: La consulta está vacía');
        return {};
      }
      
      const limit = options.limit || 20;
      
      try {
        // Unir los tipos como string separado por comas (formato requerido por Spotify)
        const typesParam = types.join(',');
        console.log(`[Spotify] Búsqueda multi-tipo: "${query}" (tipos: ${typesParam}, límite: ${limit})`);
        
        const response = await makeRequest(`/search?q=${encodeURIComponent(query)}&type=${typesParam}&limit=${limit}`);
        
        if (!response) {
          console.error(`[Spotify] Error en búsqueda multi-tipo: sin respuesta`);
          return {};
        }
        
        // Mapear la respuesta por tipo
        const result: Record<string, any> = {};
        
        // Extraer resultados para cada tipo solicitado
        types.forEach(type => {
          const key = `${type}s`; // Spotify usa plural (tracks, artists, etc.)
          if (response[key] && response[key].items) {
            result[type] = response[key].items;
          } else {
            result[type] = [];
          }
        });
        
        return result;
      } catch (error) {
        console.error(`[Spotify] Error en búsqueda multi-tipo:`, error);
        return {};
      }
    };

    return {
        getProfile,
        searchTracks,
        getMySavedTracks,
        getMyTopTracks,
        getMyTopArtists,
        getFeaturedPlaylists,
        getRecentlyPlayed,
        getAvailableGenreSeeds,
        getRecommendations,
        getPlaylistTracks,
        getNewReleases,
        getUserPlaylists,
        getPlaylist,
        getTrack,
        getArtist,
        getArtistTopTracks,
        getArtistAlbums,
        getRelatedArtists,
        searchArtists,
        searchPlaylists,
        getCategories,
        getCategoryPlaylists,
        makeRequest,
        searchMultiType
    };
}

/**
 * Obtiene un cliente de Spotify con el token de acceso de las cookies
 * @returns Cliente de Spotify con funciones para llamar a la API
 */
export async function getSpotify() {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('spotify_access_token')?.value;

    if (!accessToken) {
        throw new Error('No se encontró el token de acceso de Spotify');
    }

    console.log('Token de acceso obtenido de cookies');
    return createSpotifyApi(accessToken);
}