import { NextResponse } from 'next/server';
import { getSpotifyRelatedArtists } from '@/lib/spotify-server';

// Evitar que Next.js cachee esta ruta
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { artistId: string } }
) {
  const artistId = params.artistId;
  console.log(`[API Related Artists] Recibida solicitud para ID: ${artistId}`);

  if (!artistId) {
    console.error('[API Related Artists] Falta el ID del artista');
    return NextResponse.json({ error: 'Artist ID is required' }, { status: 400 });
  }

  try {
    const relatedArtists = await getSpotifyRelatedArtists(artistId);

    if (relatedArtists === null) {
      console.error(`[API Related Artists] Error no recuperable al obtener relacionados para ${artistId} desde el servidor`);
      return NextResponse.json({ error: 'Failed to fetch related artists due to server error' }, { status: 500 });
    }

    console.log(`[API Related Artists] Relacionados para ${artistId} encontrados: ${relatedArtists.length}`);
    return NextResponse.json({ artists: relatedArtists });

  } catch (error) {
    console.error(`[API Related Artists] Error interno al obtener relacionados para ${artistId}:`, error);
    return NextResponse.json({ error: 'Internal server error fetching related artists' }, { status: 500 });
  }
}
