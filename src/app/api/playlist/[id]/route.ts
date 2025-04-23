import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getAPIConfig } from '@/lib/api-config';

// Esta ruta se marcará como dinámica para regenerarse en cada petición
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const searchParams = request.nextUrl.searchParams;
    const language = searchParams.get('language') || 'es';

    // Obtener configuración de API y determinar URL del servidor Node
    const apiConfig = getAPIConfig();
    const nodeServerUrl = apiConfig.nodeServerUrl || 'http://localhost:3001';


    // Llamamos al servidor Node.js para obtener los detalles de la playlist
    const response = await axios.get(`${nodeServerUrl}/api/demo/playlist/${id}`, {
      params: { language },
      timeout: 15000
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error(`[Playlist API] Error al obtener detalles de playlist ${params.id}:`, error.message);

    // Si la respuesta fue 404, devolver error específico
    if (error.response && error.response.status === 404) {
      return NextResponse.json(
        { error: 'No se encontró la playlist' },
        { status: 404 }
      );
    }

    // Si el error tiene una respuesta, extraer detalles adicionales
    if (error.response) {
      console.error('[Playlist API] Detalles del error:', {
        status: error.response.status,
        data: error.response.data
      });
    }

    return NextResponse.json(
      { error: 'Error al obtener detalles de la playlist', details: error.message },
      { status: 500 }
    );
  }
}
