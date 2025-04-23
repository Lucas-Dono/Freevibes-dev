import { NextRequest, NextResponse } from 'next/server';
import { getSpotifyAlbumDetails, getSpotifyAlbumTracks } from '@/lib/spotify-server';

// Esta ruta se marcará como dinámica para regenerarse en cada petición
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: albumId } = params;
  console.log(`[Album API] Solicitud GET para album ID: ${albumId}`);

  try {
    const [albumDetails, albumTracks] = await Promise.all([
      getSpotifyAlbumDetails(albumId),
      getSpotifyAlbumTracks(albumId)
    ]);

    if (!albumDetails) {
      console.error(`[Album API] No se pudieron obtener detalles para el álbum ${albumId}`);
      return NextResponse.json(
        { error: 'No se encontró el álbum o hubo un error al obtener detalles.' },
        { status: 404 }
      );
    }

    const responseData = {
      details: albumDetails,
      tracks: albumTracks
    };

    console.log(`[Album API] Devolviendo detalles y ${albumTracks.length} pistas para el álbum ${albumId}`);
    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error(`[Album API] Error inesperado en la ruta para el álbum ${albumId}:`, error);
    return NextResponse.json(
      { error: 'Error interno del servidor al procesar la solicitud del álbum.', details: error.message },
      { status: 500 }
    );
  }
}
