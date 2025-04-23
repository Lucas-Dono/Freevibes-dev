import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json(
      { error: 'Se requiere un término de búsqueda' },
      { status: 400 }
    );
  }

  try {

    // Verificar que la API key está configurada
    const apiKey = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
    if (!apiKey) {
      console.error('[YouTube API] Error: API key no configurada');
      return NextResponse.json(
        { error: 'API key de YouTube no configurada' },
        { status: 500 }
      );
    }

    // Inicializar el cliente de YouTube
    const youtube = google.youtube({
      version: 'v3',
      auth: apiKey
    });

    // Realizar la búsqueda
    const response = await youtube.search.list({
      part: ['snippet'],
      q: `${query} music artist`, // Mejoramos los resultados añadiendo "music artist"
      type: ['channel'],
      maxResults: 10,
    });

    // Verificar si hay resultados
    if (!response.data.items || response.data.items.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Transformar los resultados al formato esperado por la aplicación
    const channels = response.data.items.map(item => ({
      id: item.id?.channelId,
      browseId: item.id?.channelId, // Para mantener compatibilidad con tu sistema actual
      title: item.snippet?.title || 'Canal sin título',
      description: item.snippet?.description || '',
      thumbnails: item.snippet?.thumbnails ?
        Object.values(item.snippet.thumbnails).map(thumb => ({
          url: thumb.url,
          width: thumb.width,
          height: thumb.height
        })) : [],
      publishedAt: item.snippet?.publishedAt,
      source: 'youtube_api'
    }));


    return NextResponse.json({ results: channels });
  } catch (error) {
    console.error('[YouTube API] Error al buscar canales:', error);
    return NextResponse.json(
      {
        error: 'Error al buscar canales en YouTube',
        message: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}
