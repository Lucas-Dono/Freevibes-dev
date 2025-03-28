export interface Playlist {
    id: string;
    name: string;
    description?: string;
    coverImageUrl?: string;
    ownerId: string;
    isPublic: boolean;
    collaborators: {
      userId: string;
      permissions: 'view' | 'edit' | 'manage';
      addedAt: Date;
    }[];
    tracks: {
      id: string;
      spotifyId?: string;
      youtubeId?: string;
      title: string;
      artist: string;
      albumName?: string;
      duration: number;
      addedAt: Date;
      addedBy: string;
    }[];
    stats: {
      totalTracks: number;
      totalDuration: number;
      plays: number;
      followers: number;
      lastModified: Date;
    };
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
  }
  
  export interface PlayHistory {
    id: string;
    userId: string;
    track: {
      id: string;
      spotifyId?: string;
      youtubeId?: string;
      title: string;
      artist: string;
      albumName?: string;
    };
    playedAt: Date;
    playDuration: number; // duración real reproducida en ms
    completionRate: number; // 0-1, qué porcentaje se reprodujo
    source: 'playlist' | 'search' | 'recommendation' | 'radio';
    sourceId?: string; // ID de playlist, etc. si aplica
    deviceInfo: {
      type: 'desktop' | 'mobile' | 'tablet' | 'web';
      os?: string;
      browser?: string;
    };
  }