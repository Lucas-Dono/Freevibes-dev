// Eliminamos las importaciones de fs y path que no son compatibles con el navegador
// import { promises as fs } from 'fs';
// import path from 'path';

// Definir las interfaces necesarias directamente en este archivo
interface Track {
  id: string;
  title: string;
  artist: string;
  cover?: string;
  album?: string;
  duration: number;
  type: string;
}

interface Album {
  id: string;
  title: string;
  artists: { id: string; name: string }[];
  cover?: string;
  releaseDate?: string;
  type: string;
}

interface Artist {
  id: string;
  name: string;
  image?: string;
  popularity?: number;
  genres?: string[];
  type: string;
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  image?: string;
  owner: string;
  tracks: number;
  type: string;
}

/**
 * Claves para almacenamiento en localStorage
 */
const STORAGE_KEYS = {
  ARTISTS: 'demo_accumulated_artists',
  TRACKS: 'demo_accumulated_tracks',
  ALBUMS: 'demo_accumulated_albums',
  PLAYLISTS: 'demo_accumulated_playlists',
  LAST_UPDATE: 'demo_last_update'
};

/**
 * Servicio para proporcionar datos del modo demo
 * Esta versión es compatible con el navegador y no utiliza 'fs'
 */
export class DemoDataService {
  private language: string;
  private accumulatedData: {
    artists: any[];
    tracks: any[];
    albums: any[];
    playlists: any[];
  };

  constructor() {
    this.language = 'es'; // Idioma predeterminado
    this.accumulatedData = {
      artists: [],
      tracks: [],
      albums: [],
      playlists: []
    };

    // Cargar datos acumulados del localStorage al iniciar
    this.loadAccumulatedData();
  }

  /**
   * Establece el idioma para las respuestas
   */
  setLanguage(lang: string): void {
    this.language = ['es', 'en', 'fr', 'it'].includes(lang) ? lang : 'es';
    console.log(`[Demo Data Service] Idioma establecido: ${this.language}`);
  }

  /**
   * Carga los datos acumulados desde localStorage
   */
  private loadAccumulatedData(): void {
    if (typeof window === 'undefined') return;

    try {
      // Artistas
      const artistsJson = localStorage.getItem(STORAGE_KEYS.ARTISTS);
      if (artistsJson) {
        this.accumulatedData.artists = JSON.parse(artistsJson);
        console.log(`[Demo Data Service] Cargados ${this.accumulatedData.artists.length} artistas acumulados`);
      }

      // Tracks
      const tracksJson = localStorage.getItem(STORAGE_KEYS.TRACKS);
      if (tracksJson) {
        this.accumulatedData.tracks = JSON.parse(tracksJson);
        console.log(`[Demo Data Service] Cargados ${this.accumulatedData.tracks.length} tracks acumulados`);
      }

      // Álbumes
      const albumsJson = localStorage.getItem(STORAGE_KEYS.ALBUMS);
      if (albumsJson) {
        this.accumulatedData.albums = JSON.parse(albumsJson);
        console.log(`[Demo Data Service] Cargados ${this.accumulatedData.albums.length} álbumes acumulados`);
      }

      // Playlists
      const playlistsJson = localStorage.getItem(STORAGE_KEYS.PLAYLISTS);
      if (playlistsJson) {
        this.accumulatedData.playlists = JSON.parse(playlistsJson);
        console.log(`[Demo Data Service] Cargadas ${this.accumulatedData.playlists.length} playlists acumuladas`);
      }
    } catch (error) {
      console.error('[Demo Data Service] Error al cargar datos acumulados:', error);
      this.resetAccumulatedData();
    }
  }

  /**
   * Guarda los datos acumulados en localStorage
   */
  private saveAccumulatedData(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEYS.ARTISTS, JSON.stringify(this.accumulatedData.artists));
      localStorage.setItem(STORAGE_KEYS.TRACKS, JSON.stringify(this.accumulatedData.tracks));
      localStorage.setItem(STORAGE_KEYS.ALBUMS, JSON.stringify(this.accumulatedData.albums));
      localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(this.accumulatedData.playlists));
      localStorage.setItem(STORAGE_KEYS.LAST_UPDATE, new Date().toISOString());

      console.log(`[Demo Data Service] Datos acumulados guardados con éxito. Total:`, {
        artists: this.accumulatedData.artists.length,
        tracks: this.accumulatedData.tracks.length,
        albums: this.accumulatedData.albums.length,
        playlists: this.accumulatedData.playlists.length
      });
    } catch (error) {
      console.error('[Demo Data Service] Error al guardar datos acumulados:', error);
    }
  }

  /**
   * Restablece los datos acumulados
   */
  resetAccumulatedData(): void {
    this.accumulatedData = {
      artists: [],
      tracks: [],
      albums: [],
      playlists: []
    };

    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.ARTISTS);
      localStorage.removeItem(STORAGE_KEYS.TRACKS);
      localStorage.removeItem(STORAGE_KEYS.ALBUMS);
      localStorage.removeItem(STORAGE_KEYS.PLAYLISTS);
      localStorage.removeItem(STORAGE_KEYS.LAST_UPDATE);
      console.log('[Demo Data Service] Datos acumulados eliminados');
    }
  }

  /**
   * Agrega artistas a la colección acumulada, evitando duplicados
   */
  private accumulateArtists(newArtists: any[]): void {
    if (!newArtists || !Array.isArray(newArtists)) return;

    const artistsWithImages = newArtists.filter(artist =>
      artist && artist.id && artist.name && artist.images && artist.images.length > 0
    );

    if (artistsWithImages.length === 0) return;

    // Combinar con los artistas existentes, evitando duplicados por ID
    const existingIds = new Set(this.accumulatedData.artists.map(a => a.id));
    const uniqueNewArtists = artistsWithImages.filter(a => !existingIds.has(a.id));

    if (uniqueNewArtists.length > 0) {
      this.accumulatedData.artists = [...this.accumulatedData.artists, ...uniqueNewArtists];
      console.log(`[Demo Data Service] Añadidos ${uniqueNewArtists.length} nuevos artistas únicos`);
      this.saveAccumulatedData();
    }
  }

  /**
   * Agrega tracks a la colección acumulada, evitando duplicados
   */
  private accumulateTracks(newTracks: any[]): void {
    if (!newTracks || !Array.isArray(newTracks)) return;

    const tracksWithImages = newTracks.filter(track =>
      track &&
      track.id &&
      track.name &&
      ((track.album && track.album.images && track.album.images.length > 0) ||
       (track.thumbnails && track.thumbnails.length > 0))
    );

    if (tracksWithImages.length === 0) return;

    // Combinar con los tracks existentes, evitando duplicados por ID
    const existingIds = new Set(this.accumulatedData.tracks.map(t => t.id));
    const uniqueNewTracks = tracksWithImages.filter(t => !existingIds.has(t.id));

    if (uniqueNewTracks.length > 0) {
      this.accumulatedData.tracks = [...this.accumulatedData.tracks, ...uniqueNewTracks];
      console.log(`[Demo Data Service] Añadidos ${uniqueNewTracks.length} nuevos tracks únicos`);
      this.saveAccumulatedData();
    }
  }

  /**
   * Agrega álbumes a la colección acumulada, evitando duplicados
   */
  private accumulateAlbums(newAlbums: any[]): void {
    if (!newAlbums || !Array.isArray(newAlbums)) return;

    const albumsWithImages = newAlbums.filter(album =>
      album &&
      album.id &&
      (album.name || album.title) &&
      ((album.images && album.images.length > 0) ||
       (album.thumbnails && album.thumbnails.length > 0))
    );

    if (albumsWithImages.length === 0) return;

    // Combinar con los álbumes existentes, evitando duplicados por ID
    const existingIds = new Set(this.accumulatedData.albums.map(a => a.id));
    const uniqueNewAlbums = albumsWithImages.filter(a => !existingIds.has(a.id));

    if (uniqueNewAlbums.length > 0) {
      this.accumulatedData.albums = [...this.accumulatedData.albums, ...uniqueNewAlbums];
      console.log(`[Demo Data Service] Añadidos ${uniqueNewAlbums.length} nuevos álbumes únicos`);
      this.saveAccumulatedData();
    }
  }

  /**
   * Carga datos demo haciendo una petición a la API
   */
  private async fetchDemoData(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    try {
      // Construir la URL con los parámetros
      const url = new URL('/api/demo/data', window.location.origin);
      url.searchParams.append('language', this.language);
      url.searchParams.append('endpoint', endpoint);

      // Añadir parámetros adicionales
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });

      console.log(`[Demo Data Service] Solicitando datos de: ${url.toString()}`);

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Error ${response.status} al obtener datos demo`);
      }

      const data = await response.json();

      // Acumular datos según el endpoint
      if (data) {
        // Procesar artistas
        if (endpoint === 'featured-artists' || endpoint === 'search-artists' || endpoint === 'top-artists') {
          if (data.items && Array.isArray(data.items)) {
            this.accumulateArtists(data.items);
          }
        }
        // Procesar resultados de búsqueda
        else if (endpoint === 'search') {
          const type = params.type || 'track';
          if (type === 'artist' && data.artists && data.artists.items) {
            this.accumulateArtists(data.artists.items);
          } else if (type === 'track' && data.tracks && data.tracks.items) {
            this.accumulateTracks(data.tracks.items);
          } else if (type === 'album' && data.albums && data.albums.items) {
            this.accumulateAlbums(data.albums.items);
          }
        }
        // Procesar tracks
        else if ((endpoint === 'top-tracks' || endpoint === 'saved-tracks') && data.items) {
          const tracks = data.items.map((item: any) => item.track || item);
          this.accumulateTracks(tracks);
        }
        // Procesar nuevos lanzamientos (álbumes)
        else if (endpoint === 'new-releases' && data.albums && data.albums.items) {
          this.accumulateAlbums(data.albums.items);
        }
      }

      return data;
    } catch (error) {
      console.error('[Demo Data Service] Error al obtener datos demo:', error);
      return null;
    }
  }

  /**
   * Obtiene las listas de reproducción destacadas
   */
  async getFeaturedPlaylists(): Promise<any> {
    try {
      const data = await this.fetchDemoData('featured-playlists');
      return data || { playlists: { items: [] } };
    } catch (error) {
      console.error('[Demo Data Service] Error al obtener playlists destacadas:', error);
      return { playlists: { items: [] } };
    }
  }

  /**
   * Obtiene los artistas destacados
   * Devuelve artistas acumulados si hay suficientes, o busca nuevos
   */
  async getFeaturedArtists(limit: number = 10): Promise<any> {
    try {
      console.log(`[Demo Data Service] Obteniendo artistas destacados (limit=${limit})...`);

      // Si ya tenemos suficientes artistas acumulados, usarlos
      if (this.accumulatedData.artists.length >= limit) {
        console.log(`[Demo Data Service] Usando ${limit} artistas de la colección acumulada (total: ${this.accumulatedData.artists.length})`);

        // Obtener una selección aleatoria de artistas
        const randomArtists = this.getRandomItems(this.accumulatedData.artists, limit);
        return { items: randomArtists };
      }

      // Si no tenemos suficientes, solicitar más
      const data = await this.fetchDemoData('featured-artists', { limit: (limit * 2).toString() });

      if (!data || !data.items) {
        console.warn('[Demo Data Service] No se obtuvieron artistas destacados válidos');
        return { items: this.accumulatedData.artists.slice(0, limit) };
      }

      // Filtrar para asegurar que solo se incluyen artistas con imágenes
      const filteredArtists = data.items.filter((artist: any) =>
        artist && artist.images && artist.images.length > 0
      );

      console.log(`[Demo Data Service] ${filteredArtists.length} artistas destacados con imágenes obtenidos`);
      return { items: filteredArtists };
    } catch (error) {
      console.error('[Demo Data Service] Error al obtener artistas destacados:', error);
      // Devolver los artistas acumulados si hay un error
      return { items: this.accumulatedData.artists.slice(0, limit) };
    }
  }

  /**
   * Obtener elementos aleatorios de un array
   */
  private getRandomItems<T>(array: T[], count: number): T[] {
    if (array.length <= count) return [...array];

    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  /**
   * Obtiene los nuevos lanzamientos
   */
  async getNewReleases(): Promise<any> {
    try {
      const data = await this.fetchDemoData('new-releases');
      return data || { albums: { items: [] } };
    } catch (error) {
      console.error('[Demo Data Service] Error al obtener nuevos lanzamientos:', error);
      return { albums: { items: [] } };
    }
  }

  /**
   * Obtiene las pistas más escuchadas del usuario
   */
  async getTopTracks(): Promise<any> {
    try {
      const data = await this.fetchDemoData('top-tracks');
      return data || { items: [] };
    } catch (error) {
      console.error('[Demo Data Service] Error al obtener top tracks:', error);
      return { items: [] };
    }
  }

  /**
   * Obtiene pistas guardadas del usuario
   * En modo demo usamos top tracks o datos de búsqueda para evitar usar información personal
   */
  async getSavedTracks(): Promise<any> {
    try {

      // Intentar usar top_tracks primero
      try {
        const topTracksData = await this.fetchDemoData('top-tracks');
        if (topTracksData && topTracksData.items && topTracksData.items.length > 0) {
          console.log('[Demo Data Service] Usando top tracks como fuente para saved tracks');

          // Convertir el formato de top tracks al formato de saved tracks
          return {
            href: "https://api.spotify.com/v1/me/tracks",
            items: topTracksData.items.map((track: any) => ({
              added_at: new Date().toISOString(),
              track: track
            })),
            limit: topTracksData.items.length,
            next: null,
            offset: 0,
            previous: null,
            total: topTracksData.items.length
          };
        }
      } catch (err) {
        console.warn('[Demo Data Service] No se pudieron cargar top tracks, intentando con datos de búsqueda');
      }

      // Si no hay top tracks, usar datos de búsqueda
      try {
        const searchData = await this.fetchDemoData('search', { type: 'track' });
        if (searchData && searchData.tracks && searchData.tracks.items && searchData.tracks.items.length > 0) {
          console.log('[Demo Data Service] Usando resultados de búsqueda como fuente para saved tracks');

          // Convertir resultados de búsqueda al formato de saved tracks
          return {
            href: "https://api.spotify.com/v1/me/tracks",
            items: searchData.tracks.items.map((track: any) => ({
              added_at: new Date().toISOString(),
              track: track
            })),
            limit: searchData.tracks.items.length,
            next: null,
            offset: 0,
            previous: null,
            total: searchData.tracks.items.length
          };
        }
      } catch (err) {
        console.warn('[Demo Data Service] No se pudieron cargar datos de búsqueda');
      }

      // Si todo falla, generar tracks aleatorios
      console.log('[Demo Data Service] Generando tracks aleatorios para saved tracks');
      const randomTracks = this.generateRandomTracks(20);

      return {
        href: "https://api.spotify.com/v1/me/tracks",
        items: randomTracks.tracks.map((track: any) => ({
          added_at: new Date().toISOString(),
          track: track
        })),
        limit: randomTracks.tracks.length,
        next: null,
        offset: 0,
        previous: null,
        total: randomTracks.tracks.length
      };
    } catch (error) {
      console.error('[Demo Data Service] Error al obtener pistas guardadas:', error);
      return { items: [] };
    }
  }

  /**
   * Obtener recomendaciones generales sin género específico
   */
  async getRecommendations(): Promise<any> {
    try {
      // Primero intentar cargar recomendaciones multilingüe para tener datos más variados
      try {
        const multilangData = await this.fetchDemoData('recommendations-multilanguage');
        if (multilangData && multilangData.tracks && multilangData.tracks.length > 0) {
          console.log(`[DemoData] Cargadas ${multilangData.tracks.length} recomendaciones multilingüe`);

          // Función para determinar el idioma más probable de una canción
          const determineLanguage = (track: any): string => {
            // Si ya tiene un idioma definido, usarlo
            if (track.language) return track.language;

            // Nombres de artistas conocidos por país/idioma
            const artistsByLanguage: {[language: string]: string[]} = {
              'Español': ['bad bunny', 'j balvin', 'rosalía', 'maluma', 'ozuna', 'karol g', 'shakira', 'enrique iglesias',
                          'daddy yankee', 'becky g', 'nicky jam', 'anuel aa', 'rauw alejandro', 'manuel turizo', 'sebastián yatra',
                          'c. tangana', 'duki', 'bizarrap', 'mora', 'quevedo', 'myke towers', 'feid'],
              'English': ['taylor swift', 'ed sheeran', 'adele', 'justin bieber', 'ariana grande', 'beyoncé', 'drake', 'the weeknd',
                          'billie eilish', 'post malone', 'rihanna', 'eminem', 'coldplay', 'harry styles', 'dua lipa', 'bruno mars'],
              'Português': ['anitta', 'alok', 'ludmilla', 'pabllo vittar', 'marília mendonça', 'gusttavo lima', 'pedro sampaio',
                           'luísa sonza', 'dennis dj', 'matheus & kauan', 'zé neto & cristiano'],
              'Français': ['stromae', 'aya nakamura', 'angèle', 'jul', 'booba', 'maître gims', 'pnl', 'damso', 'nekfeu',
                          'soprano', 'orelsan', 'niska', 'mc solaar', 'indila'],
              'Italiano': ['maneskin', 'fedez', 'mahmood', 'elodie', 'blanco', 'madame', 'geolier', 'tananai', 'irama',
                          'gianna nannini', 'zucchero', 'laura pausini', 'eros ramazzotti', 'andrea bocelli']
            };

            // Palabras comunes por idioma para detectar en títulos de canciones
            const wordsByLanguage: {[language: string]: string[]} = {
              'Español': ['de', 'la', 'el', 'mi', 'tu', 'amor', 'corazón', 'vida', 'noche', 'día', 'como', 'sin', 'con'],
              'English': ['the', 'a', 'my', 'your', 'love', 'heart', 'life', 'night', 'day', 'like', 'without'],
              'Português': ['meu', 'você', 'amor', 'coração', 'vida', 'noite', 'dia', 'como', 'sem', 'com', 'saudade'],
              'Français': ['mon', 'ma', 'ton', 'ta', 'amour', 'coeur', 'vie', 'nuit', 'jour', 'comme', 'sans', 'avec'],
              'Italiano': ['il', 'la', 'mio', 'tuo', 'amore', 'cuore', 'vita', 'notte', 'giorno', 'come', 'senza', 'con']
            };

            // Mercados principales por idioma
            const marketsByLanguage: {[language: string]: string[]} = {
              'Español': ['ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'UY', 'PA', 'CR', 'DO', 'BO', 'PY', 'SV', 'HN', 'NI', 'GT'],
              'English': ['US', 'GB', 'CA', 'AU', 'NZ', 'IE', 'ZA'],
              'Português': ['BR', 'PT', 'AO'],
              'Français': ['FR', 'BE', 'CH', 'MC', 'LU', 'CA', 'MA', 'TN', 'DZ', 'SN'],
              'Italiano': ['IT', 'CH', 'SM', 'VA']
            };

            // Sistema de puntuación para cada idioma
            const scores: {[language: string]: number} = {
              'Español': 0,
              'English': 0,
              'Português': 0,
              'Français': 0,
              'Italiano': 0
            };

            // 1. Evaluar por nombre de artista
            if (track.artists && track.artists.length > 0) {
              const artistName = track.artists[0].name.toLowerCase();
              Object.entries(artistsByLanguage).forEach(([language, artists]) => {
                if (artists.some(artist => artistName.includes(artist))) {
                  scores[language] += 5; // Peso importante
                }
              });
            }

            // 2. Evaluar por título de canción
            if (track.name) {
              const title = track.name.toLowerCase();
              Object.entries(wordsByLanguage).forEach(([language, words]) => {
                const titleWords = title.split(/\s+|[.,;:!?"'()[\]{}]/);
                const matchCount = words.filter(word => titleWords.includes(word)).length;
                scores[language] += matchCount * 2;
              });
            }

            // 3. Evaluar por mercados disponibles
            if (track.available_markets && Array.isArray(track.available_markets)) {
              Object.entries(marketsByLanguage).forEach(([language, markets]) => {
                // Intersección entre mercados disponibles y mercados de este idioma
                const matchCount = markets.filter(market => track.available_markets.includes(market)).length;
                const coverage = matchCount / markets.length; // Proporción de cobertura
                scores[language] += coverage * 3;
              });
            }

            // Géneros asociados a idiomas
            if (track.genres && Array.isArray(track.genres)) {
              const genreMap: {[genre: string]: string} = {
                'reggaeton': 'Español',
                'latin': 'Español',
                'latin pop': 'Español',
                'trap latino': 'Español',
                'urbano latino': 'Español',
                'k-pop': 'Korean',
                'j-pop': 'Japanese',
                'j-rock': 'Japanese',
                'cantopop': 'Chinese',
                'german pop': 'German',
                'german hip hop': 'German',
                'french pop': 'Français',
                'chanson': 'Français',
                'italian pop': 'Italiano',
                'italo disco': 'Italiano',
                'brazilian pop': 'Português',
                'sertanejo': 'Português',
                'pagode': 'Português',
                'funk carioca': 'Português',
                'mpb': 'Português'
              };

              track.genres.forEach((genre: string) => {
                const lowerGenre = genre.toLowerCase();
                Object.entries(genreMap).forEach(([genreKeyword, language]) => {
                  if (lowerGenre.includes(genreKeyword)) {
                    if (language in scores) {
                      scores[language] += 4;
                    }
                  }
                });
              });
            }

            // Asignar un valor predeterminado para English/Español si no hay una clara determinación
            if (Object.values(scores).every(score => score === 0)) {
              // Si no hay pistas, asignar Español o English con una probabilidad del 70%
              return Math.random() < 0.5 ? 'Español' : 'English';
            }

            // Devolver el idioma con la puntuación más alta
            return Object.entries(scores)
              .sort((a, b) => b[1] - a[1])[0][0]; // Ordenar por puntuación y tomar el primero
          };

          // Aplicar la función a cada track
          const tracksWithLanguage = multilangData.tracks.map((track: any) => {
            track.language = determineLanguage(track);
            return track;
          });

          // Contar cuántas canciones hay de cada idioma para diagnóstico
          const languageCounts = tracksWithLanguage.reduce((counts: {[key: string]: number}, track: any) => {
            counts[track.language] = (counts[track.language] || 0) + 1;
            return counts;
          }, {});

          console.log(`[DemoData] Distribución de idiomas en recomendaciones:`, languageCounts);

          return { tracks: tracksWithLanguage };
        }
      } catch (err) {
        console.warn('[DemoData] No se pudieron cargar recomendaciones multilingüe, continuando con general');
      }

      // Si no hay multilingüe, usar recomendaciones generales
      const data = await this.fetchDemoData('recommendations');

      // Verificar que tenemos datos de calidad
      if (data && data.tracks && data.tracks.length > 0) {
        // Filtrar solo tracks con imágenes válidas para mejorar experiencia visual
        const validTracks = data.tracks.filter((track: any) => {
          return track &&
                 track.id &&
                 track.name &&
                 (track.artists || track.artist) &&
                 ((track.album && track.album.images && track.album.images.length > 0) || track.cover);
        });

        if (validTracks.length > 0) {
          console.log(`[DemoData] Cargadas ${validTracks.length} recomendaciones con imágenes válidas`);
          return { tracks: validTracks };
        }
      }

      // Si todavía no tenemos datos, usar saved_tracks como fallback
      console.warn('[DemoData] No se encontraron tracks válidos en recommendations, usando saved-tracks');
      const savedData = await this.fetchDemoData('saved-tracks');

      if (savedData && savedData.items && savedData.items.length > 0) {
        const validSavedTracks = savedData.items
          .filter((item: any) => item.track && item.track.album && item.track.album.images && item.track.album.images.length > 0)
          .map((item: any) => item.track);

        if (validSavedTracks.length > 0) {
          return { tracks: validSavedTracks };
        }
      }

      // Si todo falla, generar datos aleatorios de calidad con imágenes de ejemplo
      console.warn('[DemoData] Todos los intentos de obtener tracks fallaron, generando datos sintéticos');
      return this.generateRandomTracks(30);
    } catch (error) {
      console.error('[DemoData] Error obteniendo recomendaciones:', error);
      return this.generateRandomTracks(20);
    }
  }

  /**
   * Generar tracks aleatorios con imágenes de ejemplo para cuando todo falla
   */
  private generateRandomTracks(count: number): any {
    const languages = ['Español', 'English', 'Português', 'Français', 'Italiano'];
    const genres = ['Pop', 'Rock', 'Electrónica', 'Hip Hop', 'R&B', 'Jazz', 'Indie'];
    const tracks = [];

    for (let i = 0; i < count; i++) {
      const language = languages[i % languages.length];
      const genre = genres[Math.floor(Math.random() * genres.length)];

      // Usar colores que coincidan con el idioma
      const colorMap: Record<string, string> = {
        'Español': 'ff5252',      // Rojo
        'English': '4a90e2',      // Azul
        'Português': '5cb85c',    // Verde
        'Français': '9c27b0',     // Púrpura
        'Italiano': 'ffa726'      // Ámbar
      };

      const color = colorMap[language] || 'cccccc';

      tracks.push({
        id: `demo-track-${i}`,
        name: `${language} ${genre} Track ${i+1}`,
        album: {
          name: `Demo Album ${Math.floor(i/5) + 1}`,
          images: [
            {
              url: `https://placehold.co/300x300/${color}/ffffff?text=${encodeURIComponent(language)}`,
              height: 300,
              width: 300
            }
          ]
        },
        artists: [
          {
            id: `demo-artist-${Math.floor(i/3)}`,
            name: `Demo Artist ${Math.floor(i/3) + 1}`
          }
        ],
        duration_ms: 180000 + (i * 10000),
        language: language
      });
    }

    return { tracks };
  }

  /**
   * Obtiene resultados de búsqueda según el tipo
   */
  async getSearchResults(type: 'track' | 'album' | 'artist' | 'playlist'): Promise<any> {
    try {
      const data = await this.fetchDemoData('search', { type });
      if (!data) {
        // Devolver estructura vacía según el tipo
        switch (type) {
          case 'track':
            return { tracks: { items: [] } };
          case 'album':
            return { albums: { items: [] } };
          case 'artist':
            return { artists: { items: [] } };
          case 'playlist':
            return { playlists: { items: [] } };
          default:
            return {};
        }
      }
      return data;
    } catch (error) {
      console.error(`[Demo Data Service] Error al obtener resultados de búsqueda para ${type}:`, error);
      return type === 'track'
        ? { tracks: { items: [] } }
        : type === 'album'
          ? { albums: { items: [] } }
          : type === 'artist'
            ? { artists: { items: [] } }
            : { playlists: { items: [] } };
    }
  }

  /**
   * Busca un artista específico por ID
   */
  async getArtist(artistId: string): Promise<any> {
    try {
      const data = await this.fetchDemoData('artist', { artistId });
      return data || {
        id: artistId,
        name: 'Artista Demo',
        images: [{ url: '/placeholder-artist.jpg' }],
        followers: { total: 1000 },
        popularity: 50,
        genres: ['pop']
      };
    } catch (error) {
      console.error(`[Demo Data Service] Error al obtener artista ${artistId}:`, error);
      return {
        id: artistId,
        name: 'Artista Demo',
        images: [{ url: '/placeholder-artist.jpg' }],
        followers: { total: 1000 },
        popularity: 50,
        genres: ['pop']
      };
    }
  }

  /**
   * Obtiene los álbumes de un artista específico
   */
  async getArtistAlbums(artistId: string): Promise<any> {
    try {
      const data = await this.fetchDemoData('artist-albums', { artistId });
      return data || { items: [] };
    } catch (error) {
      console.error(`[Demo Data Service] Error al obtener álbumes de artista ${artistId}:`, error);
      return { items: [] };
    }
  }

  /**
   * Obtiene las pistas más populares de un artista específico
   */
  async getArtistTopTracks(artistId: string): Promise<any> {
    try {
      const data = await this.fetchDemoData('artist-top-tracks', { artistId });
      return data || { tracks: [] };
    } catch (error) {
      console.error(`[Demo Data Service] Error al obtener top tracks de artista ${artistId}:`, error);
      return { tracks: [] };
    }
  }

  /**
   * Verifica si los datos de demo están disponibles
   */
  async isDemoDataAvailable(): Promise<boolean> {
    try {
      const response = await fetch('/api/demo/status');
      if (!response.ok) return false;
      const data = await response.json();
      return data.available === true;
    } catch (error) {
      console.error('[Demo Data Service] Error al verificar disponibilidad de datos demo:', error);
      return false;
    }
  }

  /**
   * Busca artistas con un término específico
   * Combina resultados de búsqueda con artistas acumulados
   */
  async searchArtists(query: string, limit: number = 20): Promise<any> {
    try {
      console.log(`[Demo Data Service] Buscando artistas con término: "${query}" (limit=${limit})...`);

      // Buscar en la colección acumulada primero
      const lowercaseQuery = query.toLowerCase();
      const matchingAccumulatedArtists = this.accumulatedData.artists.filter(artist =>
        artist.name.toLowerCase().includes(lowercaseQuery)
      );

      console.log(`[Demo Data Service] Encontrados ${matchingAccumulatedArtists.length} artistas coincidentes en la colección acumulada`);

      // Si tenemos suficientes coincidencias, devolverlas
      if (matchingAccumulatedArtists.length >= limit) {
        return { items: matchingAccumulatedArtists.slice(0, limit) };
      }

      // Si no tenemos suficientes, solicitar más
      const data = await this.fetchDemoData('search-artists', {
        query,
        limit: (limit * 2).toString()
      });

      const apiArtists = data?.items || [];

      // Filtrar para que solo incluya artistas con imágenes
      const filteredApiArtists = apiArtists.filter((artist: any) =>
        artist && artist.images && artist.images.length > 0
      );

      // Combinar artistas de API y acumulados, eliminando duplicados
      const combinedArtists = [...matchingAccumulatedArtists];
      const existingIds = new Set(combinedArtists.map(a => a.id));

      for (const artist of filteredApiArtists) {
        if (!existingIds.has(artist.id)) {
          combinedArtists.push(artist);
          existingIds.add(artist.id);

          if (combinedArtists.length >= limit) break;
        }
      }

      console.log(`[Demo Data Service] Devolviendo ${combinedArtists.length} artistas combinados para "${query}"`);
      return { items: combinedArtists };
    } catch (error) {
      console.error('[Demo Data Service] Error al buscar artistas:', error);
      // Devolver los artistas acumulados que coincidan en caso de error
      const matchingAccumulatedArtists = this.accumulatedData.artists.filter(artist =>
        artist.name.toLowerCase().includes(query.toLowerCase())
      );
      return { items: matchingAccumulatedArtists.slice(0, limit) };
    }
  }
}

// Exportar una instancia única del servicio
const demoDataService = new DemoDataService();
export default demoDataService;
