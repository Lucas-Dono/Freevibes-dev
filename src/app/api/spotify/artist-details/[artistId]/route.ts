import { NextResponse } from 'next/server';
import { getSpotifyArtistDetails } from '@/lib/spotify-server';

// Evitar que Next.js cachee esta ruta
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { artistId: string } }
) {
  const artistId = params.artistId;
  console.log(`[API Artist Details] Recibida solicitud para ID: ${artistId}`);

  if (!artistId) {
    console.error('[API Artist Details] Falta el ID del artista');
    return NextResponse.json({ error: 'Artist ID is required' }, { status: 400 });
  }

  try {
    const artistDetails = await getSpotifyArtistDetails(artistId);

    if (!artistDetails) {
      console.error(`[API Artist Details] No se encontraron detalles para el artista ${artistId}`);
      return NextResponse.json({ error: 'Artist details not found' }, { status: 404 });
    }

    console.log(`[API Artist Details] Detalles del artista ${artistId} encontrados.`);
    // Devolver directamente los detalles obtenidos
    return NextResponse.json(artistDetails);

  } catch (error) {
    console.error(`[API Artist Details] Error interno al obtener detalles para ${artistId}:`, error);
    return NextResponse.json({ error: 'Internal server error fetching artist details' }, { status: 500 });
  }
}
