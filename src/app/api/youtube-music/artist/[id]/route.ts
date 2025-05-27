import { NextResponse } from 'next/server';
import axios from 'axios';
import { API_CONFIG } from '@/config/api-config';

// Función para obtener información detallada de un artista desde la API de YouTube Music
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Obtener el ID del artista desde los parámetros de la ruta
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'ID de artista no proporcionado' },
        { status: 400 }
      );
    }


    // Determinar la URL base de la API
    const baseUrl = API_CONFIG.getApiBaseUrl();

    // Llamar a la API de YouTube Music para obtener los detalles del artista
    const response = await axios.get(`${baseUrl}/youtube-artist`, {
      params: {
        artistId: id
      },
      timeout: API_CONFIG.API_TIMEOUTS.SEARCH // Usar un timeout adecuado para detalles
    });

    // Si la respuesta es exitosa, devolver los datos
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('[API] Error al obtener información del artista:', error);

    // Si es un error de respuesta HTTP, intentar extraer detalles
    if (axios.isAxiosError(error) && error.response) {
      return NextResponse.json(
        { error: `Error al obtener información del artista: ${error.response.status}` },
        { status: error.response.status }
      );
    }

    // Otros errores
    return NextResponse.json(
      { error: 'Error al obtener información del artista' },
      { status: 500 }
    );
  }
}
