/**
 * Orquestador de Carga Inteligente
 *
 * Este servicio implementa un sistema avanzado de priorización para la carga
 * de contenido musical, optimizando tanto la experiencia del usuario como
 * la utilización de cuotas de API.
 */
import { Track } from '@/types/types';
import { searchMultiSource } from '@/services/recommendations/search';
import { youtube } from '@/services/youtube';
import { enhanceTracksWithYouTubeIds } from '@/services/recommendations/multi-source-recommender';

// Tipos de secciones para priorización
export type SectionType = 'paraTi' | 'tendencias' | 'generos' | 'descubrimiento' | 'otros';
export type PageType = 'home' | 'explore' | 'search' | 'library' | 'otros';

// Interfaz para el estado de carga
interface LoadingState {
  isLoading: boolean;
  currentPriority: {
    page: PageType;
    section: SectionType;
  } | null;
  queue: {
    tracks: Track[];
    priority: number;
    onComplete: (tracks: Track[]) => void;
    preferSpotify: boolean;
  }[];
  activeRequests: number;
}

// Configuración de distribución de API por sección
interface ApiDistribution {
  spotify: number;
  lastfm: number;
  deezer: number;
  youtube: number;
}

// Configuración de prioridades
const PRIORITIES = {
  VISIBLE_HIGH: 100,
  VISIBLE_MEDIUM: 80,
  VISIBLE_LOW: 60,
  OFFSCREEN_HIGH: 40,
  OFFSCREEN_MEDIUM: 20,
  OFFSCREEN_LOW: 10
};

// Distribución de API por tipo de sección
const API_DISTRIBUTION: Record<SectionType, ApiDistribution> = {
  paraTi: { spotify: 60, lastfm: 0, deezer: 0, youtube: 40 },
  tendencias: { spotify: 70, lastfm: 0, deezer: 0, youtube: 30 },
  generos: { spotify: 50, lastfm: 0, deezer: 0, youtube: 50 },
  descubrimiento: { spotify: 40, lastfm: 0, deezer: 0, youtube: 60 },
  otros: { spotify: 50, lastfm: 0, deezer: 0, youtube: 50 }
};

/**
 * Clase para orquestar la carga de contenido musical de forma inteligente
 */
export class LoadOrchestrator {
  private static instance: LoadOrchestrator;
  private state: LoadingState;
  private MAX_CONCURRENT_REQUESTS = 5;
  private isProcessingQueue = false;
  private DEBUG = process.env.DEBUG_LOADER === 'true';

  private constructor() {
    this.state = {
      isLoading: false,
      currentPriority: null,
      queue: [],
      activeRequests: 0
    };

    // Procesar la cola periódicamente
    setInterval(() => this.processQueue(), 300);
  }

  static getInstance(): LoadOrchestrator {
    if (!LoadOrchestrator.instance) {
      LoadOrchestrator.instance = new LoadOrchestrator();
    }
    return LoadOrchestrator.instance;
  }

  /**
   * Establece la prioridad actual basada en lo que está viendo el usuario
   */
  setPriority(page: PageType, section: SectionType): void {
    this.state.currentPriority = { page, section };

    // Reordenar la cola basado en nuevas prioridades
    if (this.state.queue.length > 0) {
      this.reorderQueue();
    }

    if (this.DEBUG) {
      console.log(`[Orchestrator] Prioridad establecida: ${page} - ${section}`);
    }
  }

  /**
   * Reordena la cola de carga según la prioridad actual
   */
  private reorderQueue(): void {
    // Ordenar por prioridad (mayor primero)
    this.state.queue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Encola una solicitud de carga de tracks con datos faltantes
   */
  enqueueLoad(
    tracks: Track[],
    options: {
      page: PageType,
      section: SectionType,
      isVisible: boolean,
      completeImages?: boolean,
      completeYoutubeIds?: boolean,
      preferSpotify?: boolean
    },
    onComplete: (tracks: Track[]) => void
  ): void {
    // Determinar la prioridad basada en la sección y visibilidad
    const basePriority = this.calculatePriority(options.page, options.section, options.isVisible);

    // Añadir a la cola con la prioridad calculada
    this.state.queue.push({
      tracks,
      priority: basePriority,
      onComplete,
      preferSpotify: options.preferSpotify || false
    });

    if (this.DEBUG) {
      console.log(`[Orchestrator] Encolada carga para ${tracks.length} tracks (prioridad: ${basePriority})`);
    }

    // Iniciar procesamiento si no está en curso
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  /**
   * Calcula la prioridad basada en criterios de visibilidad y ubicación
   */
  private calculatePriority(page: PageType, section: SectionType, isVisible: boolean): number {
    // Prioridad base según visibilidad
    let priority = isVisible ? PRIORITIES.VISIBLE_MEDIUM : PRIORITIES.OFFSCREEN_MEDIUM;

    // Modificar prioridad según el tipo de página
    if (page === this.state.currentPriority?.page) {
      priority += 20; // Aumentar prioridad para la página actual
    }

    // Modificar prioridad según el tipo de sección
    if (section === this.state.currentPriority?.section) {
      priority += 30; // Aumentar aún más para la sección actual
    }

    // Prioridades específicas por sección
    switch (section) {
      case 'paraTi':
        priority += 15;
        break;
      case 'tendencias':
        priority += 10;
        break;
      case 'generos':
        priority += 5;
        break;
      default:
        break;
    }

    return priority;
  }

  /**
   * Procesa la cola de carga según disponibilidad y prioridades
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.state.queue.length === 0 ||
        this.state.activeRequests >= this.MAX_CONCURRENT_REQUESTS) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Ordenar la cola por prioridad
      this.reorderQueue();

      // Procesar el elemento con mayor prioridad
      const nextItem = this.state.queue.shift();
      if (!nextItem) {
        this.isProcessingQueue = false;
        return;
      }

      this.state.activeRequests++;

      // Procesar los tracks
      const completedTracks = await this.processTracks(nextItem.tracks, nextItem.preferSpotify);

      // Llamar al callback con los tracks completados
      nextItem.onComplete(completedTracks);

      this.state.activeRequests--;

      if (this.DEBUG) {
        console.log(`[Orchestrator] Procesados ${completedTracks.length} tracks. Cola: ${this.state.queue.length}`);
      }
    } catch (error) {
      console.error('[Orchestrator] Error procesando cola:', error);
    } finally {
      this.isProcessingQueue = false;

      // Continuar procesando si hay más elementos
      if (this.state.queue.length > 0) {
        setTimeout(() => this.processQueue(), 50);
      }
    }
  }

  /**
   * Procesa tracks para completar datos faltantes según prioridades
   */
  private async processTracks(tracks: Track[], preferSpotify: boolean = false): Promise<Track[]> {
    try {
      // Clasificar tracks según completitud
      const completelyComplete = tracks.filter(t => this.isTrackComplete(t));
      const needImages = tracks.filter(t => !this.hasValidImage(t) && this.hasValidTitles(t));
      const needTitleArtist = tracks.filter(t => !this.hasValidTitles(t));

      // Primero procesar los que necesitan título/artista (más importantes)
      const processedTitleArtists = await this.completeTitlesAndArtists(needTitleArtist, preferSpotify);

      // Luego procesar los que necesitan imágenes
      const processedImages = await this.completeImages(needImages, preferSpotify);

      // Buscar IDs de YouTube si es necesario y hay cuota
      const quotaStatus = youtube.getQuotaStatus();
      let tracksWithYoutubeId: Track[] = [...completelyComplete, ...processedTitleArtists, ...processedImages];

      if (quotaStatus.hasQuota) {
        const tracksNeedingYoutube = tracksWithYoutubeId.filter(t => !t.youtubeId);
        if (tracksNeedingYoutube.length > 0) {
          tracksWithYoutubeId = await enhanceTracksWithYouTubeIds(tracksWithYoutubeId);
        }
      }

      // Verificar si hay canciones incompletas que necesitan reemplazo
      const finalTracks = this.filterAndReplaceMissingTracks(tracksWithYoutubeId, preferSpotify);
      return finalTracks;
    } catch (error) {
      console.error('[Orchestrator] Error procesando tracks:', error);
      return tracks; // Devolver tracks originales en caso de error
    }
  }

  /**
   * Filtra canciones incompletas y las reemplaza con nuevas búsquedas
   * para garantizar resultados completos
   */
  private async filterAndReplaceMissingTracks(tracks: Track[], preferSpotify: boolean = false): Promise<Track[]> {
    // Separar tracks completos e incompletos
    const completeTracks = tracks.filter(track => this.isTrackComplete(track));
    const incompleteTracks = tracks.filter(track => !this.isTrackComplete(track));

    // Si todos los tracks están completos o no hay incompletos, devolver tal cual
    if (incompleteTracks.length === 0) {
      return tracks;
    }

    // Generar un mapa de tracks existentes para evitar duplicados
    const existingTrackMap = new Map<string, boolean>();
    completeTracks.forEach(track => {
      const key = `${track.artist?.toLowerCase()}:${track.title?.toLowerCase()}`;
      existingTrackMap.set(key, true);
      if (track.spotifyId) {
        existingTrackMap.set(`spotify:${track.spotifyId}`, true);
      }
    });

    // Intentar encontrar reemplazos para tracks incompletos
    let replacementTracks: Track[] = [];

    if (incompleteTracks.length > 0) {
      try {
        console.log(`[Orchestrator] Buscando reemplazos para ${incompleteTracks.length} canciones incompletas`);

        // Extraer artistas de los tracks existentes para buscar similares
        const artists = completeTracks
          .map(t => t.artist)
          .filter(Boolean)
          .slice(0, 3);

        // Extraer posibles géneros de los artistas en los nombres de artistas
        const possibleGenres: string[] = [];
        completeTracks.forEach(track => {
          // Intentar extraer géneros de las partes de los nombres de artistas
          const genreKeywords = ['rock', 'pop', 'hip hop', 'jazz', 'electronic', 'classical', 'metal', 'indie', 'folk'];
          for (const genre of genreKeywords) {
            if (track.artist.toLowerCase().includes(genre)) {
              possibleGenres.push(genre);
              break;
            }
          }
        });

        // Construir query basada en artistas/géneros existentes
        let searchQuery = '';

        if (artists.length > 0) {
          searchQuery = `artist:${artists[0]}`;
        } else if (possibleGenres.length > 0) {
          searchQuery = `genre:${possibleGenres[0]}`;
        } else {
          // Sin artistas ni géneros, usar un término genérico popular
          searchQuery = 'top tracks';
        }

        // Buscar tracks similares para reemplazar los incompletos
        const replacements = await searchMultiSource(searchQuery, incompleteTracks.length * 2, {
          preferredSource: preferSpotify ? 'spotify' : undefined,
          forceFresh: true
        });

        // Filtrar para evitar duplicados con los tracks existentes
        replacementTracks = replacements.filter(track => {
          const key = `${track.artist?.toLowerCase()}:${track.title?.toLowerCase()}`;
          const spotifyKey = track.spotifyId ? `spotify:${track.spotifyId}` : null;

          // Si el track ya existe (por nombre o ID), no usarlo como reemplazo
          if (existingTrackMap.has(key) || (spotifyKey && existingTrackMap.has(spotifyKey))) {
            return false;
          }

          // Solo usar tracks completos como reemplazos
          if (!track.title || !track.artist || !track.cover) {
            return false;
          }

          // Marcar como usado para no duplicar entre reemplazos
          existingTrackMap.set(key, true);
          if (spotifyKey) {
            existingTrackMap.set(spotifyKey, true);
          }

          return true;
        });
      } catch (error) {
        console.error('[Orchestrator] Error buscando reemplazos:', error);
      }
    }

    // Limitar reemplazos al número de tracks incompletos
    const finalReplacements = replacementTracks.slice(0, incompleteTracks.length);

    if (finalReplacements.length > 0) {
      console.log(`[Orchestrator] Encontrados ${finalReplacements.length} reemplazos para ${incompleteTracks.length} canciones incompletas`);
    }

    // Combinar tracks completos originales con los reemplazos
    return [...completeTracks, ...finalReplacements];
  }

  /**
   * Completa títulos y artistas faltantes usando Spotify
   */
  private async completeTitlesAndArtists(tracks: Track[], preferSpotify: boolean = false): Promise<Track[]> {
    if (tracks.length === 0) return [];

    const result: Track[] = [];

    for (const track of tracks) {
      try {
        // Determinar query de búsqueda según lo que tengamos
        let query = '';
        if (track.title && !track.artist) {
          query = track.title;
        } else if (!track.title && track.artist) {
          query = track.artist;
        } else if (track.spotifyId) {
          query = `spotify:track:${track.spotifyId}`;
        } else if (track.youtubeId) {
          query = `youtube:${track.youtubeId}`;
        } else {
          // Si no hay información suficiente, mantener el track original
          result.push(track);
          continue;
        }

        // Buscar en Spotify primero si se ha especificado
        const searchResults = await searchMultiSource(query, 1, {
          preferredSource: preferSpotify ? 'spotify' : undefined,
          forceFresh: true
        });

        if (searchResults.length > 0) {
          // Mezclar datos existentes con los nuevos
          result.push({
            ...track,
            title: searchResults[0].title || track.title,
            artist: searchResults[0].artist || track.artist,
            album: searchResults[0].album || track.album,
            cover: this.hasValidImage(track) ? track.cover : searchResults[0].cover,
            albumCover: track.albumCover || searchResults[0].albumCover,
            spotifyId: track.spotifyId || searchResults[0].spotifyId
          });
        } else {
          // Mantener el track original si no se encontraron mejoras
          result.push(track);
        }
      } catch (error) {
        console.error(`[Orchestrator] Error completando track:`, error);
        result.push(track);
      }
    }

    return result;
  }

  /**
   * Completa imágenes faltantes usando Spotify o YouTube
   */
  private async completeImages(tracks: Track[], preferSpotify: boolean = false): Promise<Track[]> {
    if (tracks.length === 0) return [];

    const result: Track[] = [];

    // Primero agrupar por artista para minimizar peticiones
    const artistGroups: Record<string, Track[]> = {};
    tracks.forEach(track => {
      if (!track.artist) {
        result.push(track);
        return;
      }

      if (!artistGroups[track.artist]) {
        artistGroups[track.artist] = [];
      }
      artistGroups[track.artist].push(track);
    });

    // Procesar cada grupo de artistas
    for (const [artist, artistTracks] of Object.entries(artistGroups)) {
      try {
        // Buscar el artista en Spotify para obtener imagen
        const searchResults = await searchMultiSource(`artist:${artist}`, 1, {
          preferredSource: preferSpotify ? 'spotify' : undefined,
          forceFresh: preferSpotify // Forzar búsqueda fresca si se prefiere Spotify
        });

        // Verificar si encontramos imagen válida (no placeholder de Last.fm)
        if (searchResults.length > 0 &&
            searchResults[0].cover &&
            (!preferSpotify || !this.isLastFmPlaceholder(searchResults[0].cover))) {
          // Aplicar la misma imagen a todos los tracks del mismo artista
          for (const track of artistTracks) {
            result.push({
              ...track,
              cover: searchResults[0].cover || track.cover,
              albumCover: track.albumCover || searchResults[0].cover
            });
          }
        } else {
          // Si no se encontró imagen del artista, o si era de Last.fm y preferimos Spotify,
          // buscar cada track individualmente
          for (const track of artistTracks) {
            // Si preferimos Spotify, usar formato de búsqueda específico para mejores resultados
            const searchQuery = preferSpotify
              ? `track:${track.title} artist:${artist}` // Formato específico para Spotify
              : `${track.title} ${artist}`; // Formato general

            const trackSearch = await searchMultiSource(searchQuery, 1, {
              preferredSource: preferSpotify ? 'spotify' : undefined,
              forceFresh: preferSpotify // Forzar búsqueda fresca si se prefiere Spotify
            });

            if (trackSearch.length > 0 &&
                trackSearch[0].cover &&
                (!preferSpotify || !this.isLastFmPlaceholder(trackSearch[0].cover))) {
              result.push({
                ...track,
                cover: trackSearch[0].cover || track.cover,
                albumCover: track.albumCover || trackSearch[0].cover,
                // Actualizar también el ID de Spotify si lo tenemos
                spotifyId: track.spotifyId || trackSearch[0].spotifyId
              });
            } else if (preferSpotify) {
              // Si preferimos Spotify pero no encontramos resultado, intentar sin formato específico
              const generalSearch = await searchMultiSource(`${track.title} ${artist}`, 1, {
                preferredSource: 'spotify',
                forceFresh: true
              });

              if (generalSearch.length > 0 &&
                  generalSearch[0].cover &&
                  !this.isLastFmPlaceholder(generalSearch[0].cover)) {
                result.push({
                  ...track,
                  cover: generalSearch[0].cover || track.cover,
                  albumCover: track.albumCover || generalSearch[0].cover,
                  spotifyId: track.spotifyId || generalSearch[0].spotifyId
                });
              } else {
                // Si sigue sin encontrar, mantener el track original
                result.push(track);
              }
            } else {
              // Mantener el track original si no se encuentra imagen
              result.push(track);
            }
          }
        }
      } catch (error) {
        console.error(`[Orchestrator] Error buscando imágenes para ${artist}:`, error);
        // Mantener tracks originales en caso de error
        result.push(...artistTracks);
      }
    }

    return result;
  }

  /**
   * Detecta si una URL es un placeholder de Last.fm
   */
  private isLastFmPlaceholder(url: string): boolean {
    if (!url) return false;

    const lastfmIndicators = [
      '2a96cbd8b46e442fc41c2b86b821562f', // ID común de placeholder de Last.fm (estrella)
      'lastfm.freetls.fastly.net/i/u/',    // URLs de Last.fm para placeholders
      'lastfm-img2.akamaized.net/i/u/',    // Otro dominio de Last.fm
      'lastfm.freetls.fastly.net/i/u/ar0/', // Formatos adicionales de Last.fm
      'lastfm-img2.akamaized.net/i/u/ar0/',
      '/174s/', // Tamaño común de placeholder
      '/300x300/', // Otro tamaño común
      '/avatar', // Avatar genérico
      'fb421c35880topadw', // Otro ID de placeholder
      'c6f59c1e5e7240a4c0d427abd71f3dbb', // Otro ID de placeholder conocido
      '4128a6eb29f94943c9d206c08e625904' // Otro ID de placeholder conocido
    ];

    return lastfmIndicators.some(indicator => url.includes(indicator));
  }

  /**
   * Verifica si un track tiene una imagen válida
   */
  private hasValidImage(track: Track): boolean {
    if (!track.cover) return false;

    // Verificar si es una imagen de marcador de posición o de Last.fm
    const placeholderIndicators = [
      'default-cover',
      'placeholder',
      'no-image',
      'unsplash.com',
      'lastfm_fallback',
      '2a96cbd8b46e442fc41c2b86b821562f',  // Imagen de placeholder de Last.fm (estrella)
      'lastfm.freetls.fastly.net/i/u/', // Patrón de URLs de Last.fm para placeholders
      'lastfm-img2.akamaized.net/i/u/',  // Otro dominio de Last.fm para placeholders
      '/174s/', // Tamaño común de placeholder
      '/300x300/', // Otro tamaño común
      '/avatar', // Avatar genérico
      'fb421c35880topadw', // Otro ID de placeholder
      'c6f59c1e5e7240a4c0d427abd71f3dbb', // Otro ID de placeholder conocido
      '4128a6eb29f94943c9d206c08e625904' // Otro ID de placeholder conocido
    ];

    return !placeholderIndicators.some(indicator =>
      track.cover?.includes(indicator)
    );
  }

  /**
   * Verifica si un track tiene título y artista válidos
   */
  private hasValidTitles(track: Track): boolean {
    // Verificar si tiene tanto título como artista con contenido válido
    const invalidTitleIndicators = ['unknown', 'untitled', 'sin título', 'track', 'genre:'];
    const invalidArtistIndicators = ['unknown', 'various', 'artist', 'artista para'];

    const hasValidTitle = Boolean(track.title) &&
      !invalidTitleIndicators.some(indicator =>
        track.title?.toLowerCase().includes(indicator)
      );

    const hasValidArtist = Boolean(track.artist) &&
      !invalidArtistIndicators.some(indicator =>
        track.artist?.toLowerCase().includes(indicator)
      );

    return hasValidTitle && hasValidArtist;
  }

  /**
   * Determina si un track está completo (tiene todos los datos importantes)
   */
  private isTrackComplete(track: Track): boolean {
    return this.hasValidTitles(track) &&
           this.hasValidImage(track) &&
           Boolean(track.spotifyId || track.youtubeId);
  }

  /**
   * Decide la distribución de API para una carga específica
   */
  getApiDistribution(section: SectionType): ApiDistribution {
    return API_DISTRIBUTION[section] || API_DISTRIBUTION.otros;
  }

  /**
   * Prioriza tracks completamente cargados al principio
   */
  sortTracksByCompleteness(tracks: Track[]): Track[] {
    // Ordenar los tracks por completitud
    return [...tracks].sort((a, b) => {
      const aComplete = this.isTrackComplete(a);
      const bComplete = this.isTrackComplete(b);

      if (aComplete && !bComplete) return -1;
      if (!aComplete && bComplete) return 1;

      // Si ambos tienen el mismo estado de completitud, priorizar los que tienen imagen
      const aHasImage = this.hasValidImage(a);
      const bHasImage = this.hasValidImage(b);

      if (aHasImage && !bHasImage) return -1;
      if (!aHasImage && bHasImage) return 1;

      return 0;
    });
  }
}

// Exportar una instancia singleton
export const loadOrchestrator = LoadOrchestrator.getInstance();
