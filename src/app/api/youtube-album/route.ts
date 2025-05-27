import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const albumId = searchParams.get('albumId');

    if (!albumId) {
      console.error('[YouTube Album API] Parámetro albumId no proporcionado');
      return NextResponse.json({ error: 'Se requiere el parámetro albumId' }, { status: 400 });
    }


    // Llamamos al servidor Node.js para obtener detalles del álbum
    const nodeServerUrl = process.env.NODE_SERVER_URL || 'http://localhost:3001';
    const response = await axios.get(`${nodeServerUrl}/api/youtube-album`, {
      params: { albumId },
      timeout: 15000 // Damos más tiempo para obtener los detalles
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('[YouTube Album API] Error:', error.message);
    return NextResponse.json(
      { error: 'Error al obtener detalles del álbum', details: error.message },
      { status: 500 }
    );
  }
}
