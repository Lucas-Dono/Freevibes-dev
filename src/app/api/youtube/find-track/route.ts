import { NextRequest, NextResponse } from 'next/server';

// URL del servidor Node que actúa como intermediario
const NODE_SERVER_URL = process.env.NODE_SERVER_URL || 'http://localhost:3001/api';

export async function GET(request: NextRequest) {
  // Obtener parámetros de la URL
  const searchParams = request.nextUrl.searchParams;
  const title = searchParams.get('title');
  const artist = searchParams.get('artist');

  if (!title || !artist) {
    return NextResponse.json(
      { error: 'Se requieren título y artista' },
      { status: 400 }
    );
  }

  console.log(`[API] Buscando track: "${title}" de "${artist}"`);

  try {
    // Llamar al servidor Node que actúa como intermediario
    const response = await fetch(
      `${NODE_SERVER_URL}/youtube/find-track?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MusicPlayer/1.0'
        },
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      throw new Error(`Error en la búsqueda: ${response.status}`);
    }

    const data = await response.json();

    // Retornar los datos recibidos del servidor Node
    return NextResponse.json(data);
  } catch (error) {
    console.error(`[API] Error al buscar video para "${title}" de "${artist}":`, error);

    // Retornar un error con detalles
    return NextResponse.json(
      { error: 'Error al buscar video', details: (error as Error).message },
      { status: 500 }
    );
  }
}
