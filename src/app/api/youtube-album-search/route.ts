import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const albumName = searchParams.get('albumName');

    if (!albumName) {
      console.error('[YouTube Album Search API] Parámetro albumName no proporcionado');
      return NextResponse.json({ error: 'Se requiere el parámetro albumName' }, { status: 400 });
    }

    console.log(`[YouTube Album Search API] Buscando álbum: ${albumName}`);

    // Llamamos al servidor Node.js para buscar el álbum
    const nodeServerUrl = process.env.NODE_SERVER_URL || 'http://localhost:3001';
    const response = await axios.get(`${nodeServerUrl}/api/youtube-album-search`, {
      params: { albumName },
      timeout: 10000
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('[YouTube Album Search API] Error:', error.message);
    return NextResponse.json(
      { error: 'Error al buscar álbum', details: error.message },
      { status: 500 }
    );
  }
}
