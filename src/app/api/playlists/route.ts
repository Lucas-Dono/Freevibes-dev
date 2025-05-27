import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getAPIConfig } from '@/lib/api-config';
import { API_CONFIG } from '@/config/api-config';

// Esta ruta se marcará como dinámica para regenerarse en cada petición
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit') || '10';
    const language = searchParams.get('language') || 'es';

    // Obtener la URL del servidor Node desde la configuración central
    // Esto asegura que siempre usemos la URL correcta independientemente del modo
    const nodeServerUrl = API_CONFIG.getNodeApiUrl();

    console.log(`[API Playlists] Usando servidor Node: ${nodeServerUrl}`);

    // Llamamos al servidor Node.js para obtener las playlists
    const response = await axios.get(`${nodeServerUrl}/api/demo/playlists`, {
      params: { limit, language },
      timeout: API_CONFIG.API_TIMEOUTS.DEFAULT || 10000
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('[Playlists API] Error:', error.message);

    // Si el error tiene una respuesta, extraer detalles adicionales
    if (error.response) {
      console.error('[Playlists API] Detalles del error:', {
        status: error.response.status,
        data: error.response.data
      });
    }

    return NextResponse.json(
      { error: 'Error al obtener playlists', details: error.message },
      { status: 500 }
    );
  }
}
