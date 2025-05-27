import { Track } from '@/types/types';

interface ImageResolverOptions {
  delay?: number;
  retryCount?: number;
}

class ImageResolverService {
  private tracksWithMissingImages: Map<string, Track> = new Map();
  private resolvedImages: Map<string, string> = new Map();
  private isProcessing: boolean = false;
  private options: Required<ImageResolverOptions> = {
    delay: 5000,
    retryCount: 2
  };

  constructor(options?: ImageResolverOptions) {
    if (options) {
      this.options = { ...this.options, ...options };
    }

    // Escuchar eventos de error de imágenes si estamos en el cliente
    if (typeof window !== 'undefined') {
      window.addEventListener('imageLoadError', this.handleImageLoadError.bind(this));
    }
  }

  /**
   * Registra una pista con imagen faltante para resolver más tarde
   */
  public registerTrackWithMissingImage(track: Track): void {
    if (!track.id) return;

    // Solo registrar si no está ya en proceso o resuelta
    if (!this.resolvedImages.has(track.id) && !this.tracksWithMissingImages.has(track.id)) {
      this.tracksWithMissingImages.set(track.id, track);

      // Iniciar procesamiento si no está en curso
      if (!this.isProcessing) {
        this.scheduleImageResolution();
      }
    }
  }

  /**
   * Programa la resolución de imágenes después del retraso configurado
   */
  private scheduleImageResolution(): void {
    this.isProcessing = true;

    setTimeout(() => {
      this.resolveAllMissingImages();
    }, this.options.delay);
  }

  /**
   * Maneja eventos de error de carga de imágenes
   */
  private handleImageLoadError(event: Event): void {
    const customEvent = event as CustomEvent;
    const trackId = customEvent.detail?.trackId;
    const track = customEvent.detail?.track;

    if (trackId && track) {
      this.registerTrackWithMissingImage(track);
    }
  }

  /**
   * Resuelve todas las imágenes faltantes usando la API de Spotify
   */
  private async resolveAllMissingImages(): Promise<void> {
    if (this.tracksWithMissingImages.size === 0) {
      this.isProcessing = false;
      return;
    }


    // Procesar en lotes de 5 para no sobrecargar la API
    const tracks = Array.from(this.tracksWithMissingImages.values());
    const batchSize = 5;
    const batches = Math.ceil(tracks.length / batchSize);

    for (let i = 0; i < batches; i++) {
      const batchTracks = tracks.slice(i * batchSize, (i + 1) * batchSize);
      const promises = batchTracks.map(track => this.resolveImageForTrack(track));

      // Esperar a que se completen todas las promesas del lote
      await Promise.all(promises);

      // Pequeña pausa entre lotes para no sobrecargar la API
      if (i < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Limpiar mapa de pistas pendientes
    this.tracksWithMissingImages.clear();
    this.isProcessing = false;


    // Notificar que las imágenes han sido resueltas
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('imagesResolved', {
        detail: { resolvedImages: this.resolvedImages }
      }));
    }
  }

  /**
   * Resuelve la imagen para una pista individual usando la API de Spotify
   */
  private async resolveImageForTrack(track: Track): Promise<void> {
    try {

      // Construir consulta de búsqueda
      const searchQuery = `${track.title} ${track.artist}`.trim();
      const encodedQuery = encodeURIComponent(searchQuery);

      // Llamar a la API de Spotify para buscar la pista
      const response = await fetch(`/api/spotify/search?q=${encodedQuery}&type=track&limit=1`);

      if (!response.ok) {
        throw new Error(`Error en la búsqueda: ${response.statusText}`);
      }

      const data = await response.json();

      // Verificar si encontramos resultados válidos
      if (data && data.tracks && data.tracks.items && data.tracks.items.length > 0) {
        const spotifyTrack = data.tracks.items[0];

        // Verificar si hay imágenes disponibles
        if (spotifyTrack.album && spotifyTrack.album.images && spotifyTrack.album.images.length > 0) {
          const imageUrl = spotifyTrack.album.images[0].url;

          // Guardar la URL de la imagen resuelta
          this.resolvedImages.set(track.id, imageUrl);

          // Actualizar la imagen en la pista
          track.cover = imageUrl;

          // Si hay un elemento con este ID en el DOM, actualizar su src
          if (typeof document !== 'undefined') {
            const imgElements = document.querySelectorAll(`[data-track-id="${track.id}"] img`);
            imgElements.forEach(img => {
              (img as HTMLImageElement).src = imageUrl;
            });
          }

          return;
        }
      }

      console.warn(`[ImageResolver] No se encontró imagen para: ${track.title} - ${track.artist}`);
    } catch (error) {
      console.error(`[ImageResolver] Error al resolver imagen para ${track.title}:`, error);
    }
  }

  /**
   * Obtiene una imagen resuelta por ID de pista
   */
  public getResolvedImage(trackId: string): string | undefined {
    return this.resolvedImages.get(trackId);
  }

  /**
   * Verifica si hay una imagen resuelta para un ID de pista
   */
  public hasResolvedImage(trackId: string): boolean {
    return this.resolvedImages.has(trackId);
  }
}

// Exportar instancia singleton
export const ImageResolver = new ImageResolverService();

// Exportar el tipo para uso en otros archivos
export type { ImageResolverOptions };
