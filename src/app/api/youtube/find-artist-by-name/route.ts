import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Función para normalizar un nombre para búsqueda
const normalizeForSearch = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Eliminar acentos
    .replace(/[^\w\s]/g, '')          // Eliminar caracteres especiales
    .trim();
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const artistName = searchParams.get('name');

  if (!artistName) {
    return NextResponse.json(
      { error: 'Se requiere un nombre de artista' },
      { status: 400 }
    );
  }

  console.log(`[API] Buscando artista por nombre: "${artistName}"`);

  try {
    // Inicializar el cliente de YouTube
    const apiKey = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
    if (!apiKey) {
      console.error('[API] Error: API key de YouTube no configurada');
      return NextResponse.json(
        { error: 'API key de YouTube no configurada' },
        { status: 500 }
      );
    }

    const youtube = google.youtube({
      version: 'v3',
      auth: apiKey
    });

    // Buscar canales con el nombre del artista
    // Usamos una búsqueda optimizada para artistas musicales
    const searchQuery = `${artistName} official music artist`;

    const response = await youtube.search.list({
      part: ['snippet'],
      q: searchQuery,
      type: ['channel'],
      maxResults: 5,
    });

    // Verificar si hay resultados
    if (!response.data.items || response.data.items.length === 0) {
      console.log(`[API] No se encontraron canales para "${artistName}"`);
      return NextResponse.json({
        success: false,
        error: `No se encontraron canales para "${artistName}"`
      });
    }

    // Normalizar el nombre del artista para comparación
    const normalizedName = normalizeForSearch(artistName);

    // Intentar encontrar una coincidencia por nombre
    let bestMatch = null;
    let exactMatch = null;

    for (const item of response.data.items) {
      const channelTitle = item.snippet?.title || '';
      const normalizedTitle = normalizeForSearch(channelTitle);

      // Comprobación de coincidencia exacta
      if (normalizedTitle === normalizedName) {
        exactMatch = {
          id: item.id?.channelId,
          browseId: item.id?.channelId,
          title: item.snippet?.title,
          description: item.snippet?.description,
          thumbnails: item.snippet?.thumbnails ?
            Object.values(item.snippet.thumbnails).map(thumb => ({
              url: (thumb as any).url,
              width: (thumb as any).width,
              height: (thumb as any).height
            })) : [],
          score: 1.0
        };
        break;
      }

      // Comprobación de coincidencia parcial
      if (normalizedTitle.includes(normalizedName) || normalizedName.includes(normalizedTitle)) {
        // Calcular un puntaje simple de similitud
        const score = normalizedTitle.includes(normalizedName) ? 0.8 : 0.6;

        if (!bestMatch || score > bestMatch.score) {
          bestMatch = {
            id: item.id?.channelId,
            browseId: item.id?.channelId,
            title: item.snippet?.title,
            description: item.snippet?.description,
            thumbnails: item.snippet?.thumbnails ?
              Object.values(item.snippet.thumbnails).map(thumb => ({
                url: (thumb as any).url,
                width: (thumb as any).width,
                height: (thumb as any).height
              })) : [],
            score: score
          };
        }
      }
    }

    // Usar coincidencia exacta si existe, o la mejor coincidencia, o el primer resultado
    const result = exactMatch || bestMatch || {
      id: response.data.items[0].id?.channelId,
      browseId: response.data.items[0].id?.channelId,
      title: response.data.items[0].snippet?.title,
      description: response.data.items[0].snippet?.description,
      thumbnails: response.data.items[0].snippet?.thumbnails ?
        Object.values(response.data.items[0].snippet.thumbnails).map(thumb => ({
          url: (thumb as any).url,
          width: (thumb as any).width,
          height: (thumb as any).height
        })) : [],
      score: 0.5
    };

    console.log(`[API] Artista encontrado: "${result.title}" (ID: ${result.browseId})`);

    return NextResponse.json({
      success: true,
      artist: result
    });
  } catch (error) {
    console.error('[API] Error al buscar artista por nombre:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
