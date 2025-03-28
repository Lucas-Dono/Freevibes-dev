/**
 * Proxy para la API de YouTube con control de cuota
 * 
 * Este endpoint permite acceder a la API de YouTube con control de cuota
 * y cacheo de resultados para evitar exceder los límites diarios.
 */
import { NextRequest, NextResponse } from 'next/server';
import { youtube } from '@/services/youtube';
import { SearchOptions } from '@/services/recommendations/search';

// Opciones permitidas para pasar en la solicitud
interface YouTubeProxyParams extends SearchOptions {
  query?: string;
  videoId?: string;
  limit?: number;
  type?: 'video' | 'playlist' | 'channel';
}

export async function GET(request: NextRequest) {
  try {
    // Obtener parámetros de la solicitud
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const { query, videoId, limit, type } = params as YouTubeProxyParams;
    
    // Verificar que tenemos al menos uno de los parámetros necesarios
    if (!query && !videoId) {
      return NextResponse.json(
        { error: 'Se requiere query o videoId' },
        { status: 400 }
      );
    }
    
    // Verificar el estado de la cuota
    const quotaStatus = youtube.getQuotaStatus();
    if (!quotaStatus.hasQuota) {
      // Si no hay cuota disponible, retornar error 429 (Too Many Requests)
      return NextResponse.json(
        { error: 'Límite de cuota diaria de YouTube alcanzado' },
        { status: 429 }
      );
    }
    
    // Procesar según el tipo de solicitud
    let response: any;
    
    if (videoId) {
      // Buscar detalles de un video específico
      const videoDetails = await fetchVideoDetails(videoId);
      response = { videoDetails };
    } else if (query) {
      // Buscar videos según consulta
      const maxResults = limit ? parseInt(limit.toString()) : 10;
      const searchResults = await youtube.searchVideos(query, maxResults);
      response = searchResults;
    }
    
    // Devolver resultados
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[YouTube Proxy] Error:', error);
    
    // Si es un error de cuota, devolver un estado específico
    if (error.message?.includes('quota')) {
      return NextResponse.json(
        { error: 'Límite de cuota excedido en la API de YouTube' },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error en el proxy de YouTube', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Función para obtener detalles de un video específico
 * (Esta funcionalidad aún debe implementarse en el servicio)
 */
async function fetchVideoDetails(videoId: string) {
  // Por ahora devolvemos una estructura básica
  // Esta función se implementará en una mejora futura
  const placeholderDetails = {
    id: videoId,
    title: 'Video no disponible',
    channelTitle: 'Canal desconocido',
    description: 'Detalles no disponibles',
    thumbnails: {
      high: { url: '' }
    }
  };
  
  return placeholderDetails;
}

export async function POST(request: NextRequest) {
  try {
    // Obtener el cuerpo de la solicitud
    const body = await request.json();
    const { tracks } = body as { tracks?: any[] };
    
    if (!tracks || !Array.isArray(tracks)) {
      return NextResponse.json(
        { error: 'Se requiere un array de tracks' },
        { status: 400 }
      );
    }
    
    // Verificar el estado de la cuota
    const quotaStatus = youtube.getQuotaStatus();
    if (!quotaStatus.canEnrichTracks) {
      return NextResponse.json(
        { error: 'Límite de cuota diaria de YouTube alcanzado' },
        { status: 429 }
      );
    }
    
    // Enriquecer tracks con IDs de YouTube
    const enrichedTracks = await youtube.enrichTracksWithYouTubeIds(tracks);
    
    return NextResponse.json({
      tracks: enrichedTracks,
      enriched: enrichedTracks.filter(t => t.youtubeId).length
    });
  } catch (error: any) {
    console.error('[YouTube Proxy] Error en POST:', error);
    
    return NextResponse.json(
      { error: 'Error en el proxy de YouTube', details: error.message },
      { status: 500 }
    );
  }
} 