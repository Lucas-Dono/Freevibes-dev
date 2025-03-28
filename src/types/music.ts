/**
 * Interfaz para una pista musical
 */
export interface Track {
  id: string;
  name: string;
  artists: Array<{ id: string; name: string }>;
  album?: {
    id?: string;
    name: string;
    images: Array<{ url: string; width?: number; height?: number }>;
  };
  duration_ms?: number;
  popularity?: number;
  uri?: string;
  preview_url?: string;
  explicit?: boolean;
  sourceWeight?: number; // Para sistema de combinación de fuentes
}

/**
 * Interfaz para un artista
 */
export interface Artist {
  id: string;
  name: string;
  genres?: string[];
  images?: Array<{ url: string; width?: number; height?: number }>;
  popularity?: number;
  uri?: string;
  followers?: number;
}

/**
 * Interfaz para un álbum
 */
export interface Album {
  id: string;
  name: string;
  artists: Array<{ id: string; name: string }>;
  images: Array<{ url: string; width?: number; height?: number }>;
  release_date?: string;
  total_tracks?: number;
  uri?: string;
  album_type?: 'album' | 'single' | 'compilation';
}

/**
 * Interfaz para una lista de reproducción
 */
export interface Playlist {
  id: string;
  name: string;
  description?: string;
  owner?: {
    id: string;
    display_name?: string;
  };
  images: Array<{ url: string; width?: number; height?: number }>;
  tracks: {
    total: number;
    items?: Array<{
      track: Track;
      added_at?: string;
    }>;
  };
  uri?: string;
  public?: boolean;
}

/**
 * Interfaz para resultados de búsqueda
 */
export interface SearchResults {
  tracks?: {
    items: Track[];
    total: number;
  };
  artists?: {
    items: Artist[];
    total: number;
  };
  albums?: {
    items: Album[];
    total: number;
  };
  playlists?: {
    items: Playlist[];
    total: number;
  };
}

/**
 * Opciones para obtener recomendaciones
 */
export interface GetRecommendationsOptions {
  combine?: boolean;
  preferredSource?: string;
  timeout?: number;
} 