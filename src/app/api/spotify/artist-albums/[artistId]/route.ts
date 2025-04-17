import { NextResponse } from 'next/server';
import { getSpotifyArtistAlbums } from '@/lib/spotify-server';

// Evitar que Next.js cachee esta ruta
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { artistId: string } }
) {
  const artistId = params.artistId;
  // Obtener el límite de la query string, default a 20
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 20;

  console.log(`[API Artist Albums] Recibida solicitud para ID: ${artistId}, limit: ${limit}`);

  if (!artistId) {
    console.error('[API Artist Albums] Falta el ID del artista');
    return NextResponse.json({ error: 'Artist ID is required' }, { status: 400 });
  }

  if (isNaN(limit) || limit <= 0) {
    console.error(`[API Artist Albums] Límite inválido: ${limitParam}`);
    return NextResponse.json({ error: 'Invalid limit parameter' }, { status: 400 });
  }

  try {
    const albums = await getSpotifyArtistAlbums(artistId, limit);

    if (albums === null) {
      console.error(`[API Artist Albums] Error al obtener álbumes para ${artistId} desde el servidor`);
      // Podría ser 404 si el artista no existe o 500 si hubo otro error
      return NextResponse.json({ error: 'Failed to fetch artist albums' }, { status: 500 }); 
    }

    console.log(`[API Artist Albums] Álbumes para ${artistId} encontrados: ${albums.length}`);
    // Devolver el array de álbumes (puede ser vacío si no tiene)
    return NextResponse.json({ albums });

  } catch (error) {
    console.error(`[API Artist Albums] Error interno al obtener álbumes para ${artistId}:`, error);
    return NextResponse.json({ error: 'Internal server error fetching artist albums' }, { status: 500 });
  }
} 