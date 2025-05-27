import { NextRequest, NextResponse } from 'next/server';

// URL del servidor Node que actúa como intermediario
const NODE_SERVER_URL = process.env.NODE_SERVER_URL || 'http://localhost:3001/api';

/**
 * Handler para obtener la playlist de reproducción y datos adicionales de un video
 * Este endpoint es necesario para obtener el browseId de letras
 */
export async function GET(request: NextRequest) {
  // Obtener el videoId de los parámetros de consulta
  const videoId = request.nextUrl.searchParams.get('videoId');

  if (!videoId) {
    return NextResponse.json(
      { error: 'Se requiere un videoId' },
      { status: 400 }
    );
  }

  try {
    console.log(`[API] Obteniendo información de reproducción para video: ${videoId}`);

    // Redirigir la solicitud al servidor Node
    const response = await fetch(`${NODE_SERVER_URL}/youtube/get-watch-playlist?videoId=${videoId}`, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MusicPlayer/1.0'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Error al obtener información de reproducción: ${response.status}`);
    }

    const data = await response.json();

    console.log(`[API] Información de reproducción obtenida para: ${videoId}`);

    return NextResponse.json(data);
  } catch (error) {
    console.error(`[API] Error obteniendo información de reproducción:`, error);

    return NextResponse.json(
      { error: 'Error al obtener información de reproducción', details: (error as Error).message },
      { status: 500 }
    );
  }
}
