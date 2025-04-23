import { NextRequest, NextResponse } from 'next/server';
import demoDataService from '@/services/demo/demo-data-service';

// Garantizar que la ruta sea dinámica para que Next.js no la construya estáticamente
export const dynamic = 'force-dynamic';

/**
 * Manejador principal para las solicitudes al API de Spotify en modo demo
 */
export async function GET(request: NextRequest) {
  try {
    // Obtener parámetros de la consulta
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint') || '';
    const language = searchParams.get('language') || 'es';

    // Configurar el idioma en el servicio
    demoDataService.setLanguage(language);

    // Verificar si los datos demo están disponibles
    const isAvailable = await demoDataService.isDemoDataAvailable();

    if (!isAvailable) {
      return NextResponse.json(
        { error: 'Los datos de modo demo no están disponibles. Inicialice el modo demo primero.' },
        { status: 404 }
      );
    }

    // Responder según el endpoint solicitado
    let data: any;
    const artistId = searchParams.get('artistId');

    if (endpoint.includes('/artists/') && artistId) {
      // Manejo de endpoints específicos de artista
      if (endpoint.includes('/albums')) {
        data = await demoDataService.getArtistAlbums(artistId);
      } else if (endpoint.includes('/top-tracks')) {
        data = await demoDataService.getArtistTopTracks(artistId);
      } else {
        // Buscar el artista directamente
        data = await demoDataService.getArtist(artistId);
      }
    } else {
      // Manejo de endpoints estándar
      switch (endpoint) {
        case 'featured-playlists':
          data = await demoDataService.getFeaturedPlaylists();
          break;

        case 'new-releases':
          data = await demoDataService.getNewReleases();
          break;

        case 'top-tracks':
          data = await demoDataService.getTopTracks();
          break;

        case 'saved-tracks':
          data = await demoDataService.getSavedTracks();
          break;

        case 'recommendations':
          data = await demoDataService.getRecommendations();
          break;

        case 'search':
          const type = searchParams.get('type') || 'track';
          const types = type.split(',');

          // Si hay múltiples tipos, devolver un objeto combinado
          if (types.length > 1) {
            data = {};
            for (const t of types) {
              const result = await demoDataService.getSearchResults(t as any);
              data = { ...data, ...result };
            }
          } else {
            data = await demoDataService.getSearchResults(type as any);
          }
          break;

        default:
          return NextResponse.json(
            { error: `Endpoint no soportado: ${endpoint}` },
            { status: 400 }
          );
      }
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('[DEMO API] Error al procesar la solicitud:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error desconocido al procesar la solicitud',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
