/**
 * Punto de entrada para los servicios de YouTube
 * 
 * Este módulo exporta todas las funcionalidades relacionadas con YouTube
 * de forma centralizada.
 */

import { 
  youtubeService, 
  YouTubeQuotaManager, 
  YouTubeService,
  YouTubeSearchResponse,
  YouTubeVideoItem,
  YouTubeVideoDetailsResponse,
  YouTubeVideoDetailItem,
  YouTubeThumbnail
} from './youtube-service';
import { youtubeCache, YouTubeCache } from './youtube-cache';
import { youtubeMusic } from './youtube-music';
import { youtubeMusicAPI, YouTubeMusicAPI } from './youtube-music-api';

// Exportar servicios como instancia singleton
export const youtube = youtubeService;
export { youtubeMusic, youtubeMusicAPI };

// Exportar servicio por defecto
export default youtube;

// Exportar clases
export { YouTubeService, YouTubeQuotaManager, YouTubeCache, YouTubeMusicAPI };

// Exportar tipos
export type {
  YouTubeSearchResponse,
  YouTubeVideoItem,
  YouTubeVideoDetailsResponse,
  YouTubeVideoDetailItem,
  YouTubeThumbnail
};

export interface YTMusicResult {
  videoId: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  thumbnails: {
    url: string;
    width: number;
    height: number;
  }[];
}

/**
 * Mapea los resultados de YouTube a formato YTMusic
 * @param videoItem Item de video de YouTube
 * @returns Objeto en formato YTMusic
 */
export function mapToYTMusic(videoItem: YouTubeVideoItem): YTMusicResult {
  // Extraer mejor título/artista del formato típico "Artista - Título"
  let videoTitle = videoItem.snippet.title;
  let videoArtist = videoItem.snippet.channelTitle;
  let thumbnails: any[] = [];
  
  // Intentar extraer artista y título si tiene el formato común
  const dashSplit = videoTitle.split(' - ');
  if (dashSplit.length >= 2) {
    videoArtist = dashSplit[0].trim();
    videoTitle = dashSplit.slice(1).join(' - ').trim();
  }
  
  // Limpiar título de términos comunes en videos musicales
  videoTitle = videoTitle
    .replace(/\(Official\s*(Video|Audio|Music Video|Lyric Video|Visualizer)\)/i, '')
    .replace(/\[Official\s*(Video|Audio|Music Video|Lyric Video|Visualizer)\]/i, '')
    .replace(/\(Lyric\s*Video\)/i, '')
    .replace(/\[Lyric\s*Video\]/i, '')
    .replace(/\(Audio\)/i, '')
    .replace(/\[Audio\]/i, '')
    .replace(/\(Lyrics\)/i, '')
    .replace(/\[Lyrics\]/i, '')
    .replace(/\(Official\)/i, '')
    .replace(/\[Official\]/i, '')
    .replace(/\(HD\)/i, '')
    .replace(/\[HD\]/i, '')
    .replace(/\(\d+\)/i, '')
    .replace(/\[\d+\]/i, '')
    .trim();
  
  // Mapear thumbnails para compatibilidad con YTMusic API
  if (videoItem.snippet.thumbnails) {
    const sizes = ['default', 'medium', 'high', 'standard', 'maxres'] as const;
    thumbnails = sizes
      .filter(size => videoItem.snippet.thumbnails[size])
      .map(size => {
        const thumb = videoItem.snippet.thumbnails[size];
        if (!thumb) return null;
        
        return {
          url: thumb.url,
          width: thumb.width || 0,
          height: thumb.height || 0
        };
      })
      .filter(Boolean) as any[];
  }
  
  return {
    videoId: videoItem.id.videoId,
    title: videoTitle,
    artist: videoArtist,
    album: 'YouTube Music',
    thumbnails
  };
} 