import { NextRequest, NextResponse } from 'next/server';

// URL del servidor Node que actúa como intermediario
const NODE_SERVER_URL = process.env.NODE_SERVER_URL || 'http://localhost:3001/api';

/**
 * Handler para obtener letras de canciones desde YouTube Music
 * usando el browseId obtenido de get-watch-playlist
 */
export async function GET(request: NextRequest) {
  // Obtener parámetros necesarios
  const browseId = request.nextUrl.searchParams.get('browseId');
  const timestamps = request.nextUrl.searchParams.get('timestamps') === 'true';

  if (!browseId) {
    return NextResponse.json(
      { error: 'Se requiere un browseId' },
      { status: 400 }
    );
  }

  try {
    console.log(`[API] Obteniendo letras para browseId: ${browseId}`);

    // Redirigir la solicitud al servidor Node
    const response = await fetch(`${NODE_SERVER_URL}/youtube/get-lyrics?browseId=${browseId}&timestamps=${timestamps}`, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MusicPlayer/1.0'
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Error al obtener letras: ${response.status}`);
    }

    const data = await response.json();

    console.log(`[API] Letras obtenidas con éxito (con timestamps: ${timestamps})`);

    return NextResponse.json(data);
  } catch (error) {
    console.error(`[API] Error obteniendo letras:`, error);

    return NextResponse.json(
      { error: 'Error al obtener letras', details: (error as Error).message },
      { status: 500 }
    );
  }
}
