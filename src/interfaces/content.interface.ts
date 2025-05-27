export type SpotifyContentType = 'track' | 'album' | 'artist' | 'playlist';

export interface ContentMapping {
  id: string;
  spotifyId: string;
  spotifyType: SpotifyContentType;
  spotifyData: {
    title: string;
    artist: string;
    duration: number;
    albumName?: string;
    releaseDate?: Date;
  };
  youtubeId: string;
  youtubeData: {
    title: string;
    channelId: string;
    duration: number;
    viewCount?: number;
  };
  confidenceScore: number; // 0-100
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  userFeedback: {
    positive: number;
    negative: number;
  };
}

export interface SearchCache {
  id: string;
  query: string;
  serviceType: 'spotify' | 'youtube';
  resultHash: string; // Hash de los resultados
  results: any; // Resultados de búsqueda serializados
  createdAt: Date;
  expiresAt: Date;
  hitCount: number;
}
