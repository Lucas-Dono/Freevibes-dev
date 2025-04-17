// Tipos comunes utilizados en toda la aplicación

// Definición de una pista musical
export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumCover?: string;
  cover: string;
  duration: number;
  spotifyId?: string;
  youtubeId?: string;
  source?: string; // Nueva propiedad para indicar la fuente de datos (spotify, lastfm, deezer, etc.)
  sourceUrl?: string; // URL original en la fuente
  artistId?: string; // ID del artista en la plataforma original
  albumId?: string; // ID del álbum en la plataforma original
  weight?: number; // Peso para ordenar resultados cuando se combinan múltiples fuentes
  sourceData?: any; // Datos completos originales de la API fuente
  thumbnail?: string; // URL alternativa para la miniatura (puede ser diferente de cover)
  spotifyCoverUrl?: string; // URL original de la imagen de Spotify
  language?: string; // Idioma de la canción (para recomendaciones multilingües)
  subregion?: string; // Subregión o cultura musical (ej: Latinoamérica, K-Pop)
  color?: string; // Color asociado para visualización (útil para placeholders)
  itemType?: 'track' | 'album' | 'artist' | 'playlist' | 'video';
}

// Definición de una línea de letra sincronizada
export interface LyricLine {
  time: number;
  text: string;
}

// Definición de un artista
export interface Artist {
  id: string;
  name: string;
  images: Array<{ url: string }>;
  genres?: string[];
  popularity?: number;
}

// Definición de una playlist
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