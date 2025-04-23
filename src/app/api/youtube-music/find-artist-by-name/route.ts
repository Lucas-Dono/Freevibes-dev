import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { API_CONFIG } from '@/config/api-config';

// Configuración para indicar que esta ruta es dinámica
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Obtener el parámetro de búsqueda de la URL
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) {
      return NextResponse.json(
        { error: 'Nombre de artista no proporcionado', success: false },
        { status: 400 }
      );
    }

    console.log(`[API] Buscando artista de YouTube Music por nombre: "${name}"`);

    // Determinar la URL base de la API
    const baseUrl = API_CONFIG.getNodeApiUrl();

    // Llamar a la API de Node.js para buscar artistas por nombre
    const response = await axios.get(`${baseUrl}/youtube/find-artist-by-name`, {
      params: { name },
      timeout: API_CONFIG.API_TIMEOUTS.SEARCH
    });

    // Si la respuesta es exitosa, devolver los datos
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('[API] Error al buscar artista por nombre:', error);

    // Si es un error de respuesta HTTP, intentar extraer detalles
    if (axios.isAxiosError(error) && error.response) {
      return NextResponse.json(
        {
          error: `Error al buscar artista: ${error.response.status}`,
          success: false
        },
        { status: error.response.status }
      );
    }

    // Otros errores
    return NextResponse.json(
      { error: 'Error al buscar artista por nombre', success: false },
      { status: 500 }
    );
  }
}
