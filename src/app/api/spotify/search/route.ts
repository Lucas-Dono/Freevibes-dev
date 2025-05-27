import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Endpoint para buscar en Spotify
 * Acepta parámetros:
 * - q: consulta de búsqueda
 * - type: tipo de búsqueda (album, artist, playlist, track)
 * - limit: número máximo de resultados
 */
export async function GET(req: NextRequest) {
  try {
    // Obtener parámetros de la URL
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');
    const type = searchParams.get('type') || 'track';
    const limit = parseInt(searchParams.get('limit') || '5', 10);

    // Validar parámetros
    if (!query) {
      return NextResponse.json(
        { error: 'Se requiere un parámetro de búsqueda (q)' },
        { status: 400 }
      );
    }

    // Obtener la sesión del servidor para acceder al token
    const session = await getServerSession(authOptions);

    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: 'No se pudo obtener el token de acceso de Spotify. Usuario no autenticado.' },
        { status: 401 }
      );
    }

    // Obtener el token de la sesión
    const token = session.accessToken;

    // Codificar parámetros para la URL
    const encodedQuery = encodeURIComponent(query);
    const encodedType = encodeURIComponent(type);

    // Construir URL de búsqueda
    const url = `https://api.spotify.com/v1/search?q=${encodedQuery}&type=${encodedType}&limit=${limit}`;

    // Realizar solicitud a la API de Spotify
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    // Manejar errores de la API
    if (!response.ok) {
      const error = await response.json();
      console.error('[SpotifySearch] Error al buscar en Spotify:', error);

      return NextResponse.json(
        { error: 'Error al buscar en Spotify', details: error },
        { status: response.status }
      );
    }

    // Obtener datos y devolver respuesta
    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('[SpotifySearch] Error en el endpoint de búsqueda:', error);

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
