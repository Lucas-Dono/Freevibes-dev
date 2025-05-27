import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { connectToDatabase } from '@/lib/db/mongodb';
import { revalidatePath } from 'next/cache';
import { IRecentTrack } from '@/models/RecentTrack';
import { cookies } from 'next/headers';
import { API_CONFIG } from '@/config/api-config';

/**
 * Obtiene el usuario desde las cookies
 */
async function getUserFromCookies() {
  try {
    // Intentar el método getServerSession primero
    try {
      const session = await getServerSession();
      if (session && session.user && session.user.email) {
        return session.user.email;
      }
    } catch (error) {
      console.warn('Error al obtener sesión del servidor:', error);
    }

    // Si no funciona, intenta leer directamente de cookies
    const cookieStore = cookies();
    const userCookie = cookieStore.get('spotify_user');

    if (userCookie && userCookie.value) {
      try {
        const userData = JSON.parse(decodeURIComponent(userCookie.value));
        return userData.email || userData.id;
      } catch (parseError) {
        console.warn('Error al parsear cookie de usuario:', parseError);
      }
    }

    return 'guest-user';
  } catch (error) {
    console.error('Error al obtener usuario de cookies:', error);
    return 'guest-user';
  }
}

/**
 * Elimina tracks duplicados del historial basándose en título y artista
 */
function removeDuplicateTracks(tracks: IRecentTrack[]): IRecentTrack[] {
  const seen = new Map<string, boolean>();

  return tracks.filter((track) => {
    // Obtener título normalizado
    const title = (track.trackName || '').toLowerCase().trim();

    // Obtener artista normalizado
    const artist = (track.artistName || '').toLowerCase().trim();

    // Crear clave única basada en título y artista
    const key = `${title}:${artist}`;

    // Si ya hemos visto esta combinación, filtrar el elemento
    if (seen.has(key)) {
      return false;
    }

    // Caso contrario, marcar como visto y mantener el elemento
    seen.set(key, true);
    return true;
  });
}

/**
 * GET /api/history
 * Obtiene el historial de canciones del usuario
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar si estamos en modo demo
    const isDemoMode = API_CONFIG.isDemoMode();

    if (isDemoMode) {
      console.log('[API History] Modo demo activado - devolviendo historial vacío');
      return NextResponse.json({
        tracks: [],
        total: 0,
        page: 1,
        limit: 20,
        hasMore: false,
        demoMode: true
      });
    }

    // Obtener parámetros de consulta
    const url = new URL(request.url);
    let limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const page = parseInt(url.searchParams.get('page') || '1', 10);

    // Ajustar límite en un rango razonable
    if (limit < 1) limit = 20;
    if (limit > 100) limit = 100;

    // Obtener userId de cookies
    const userId = await getUserFromCookies();

    try {
      // Conectar a MongoDB y manejar errores específicamente
      const conn = await connectToDatabase();

      // Verificar que tengamos una conexión válida
      if (!conn || !conn.connection || !conn.connection.db) {
        throw new Error('Conexión a MongoDB no válida');
      }

      // Acceder a la colección directamente
      const collection = conn.connection.db.collection('recentTracks');

      // Para deduplicación efectiva, obtenemos más registros
      const fetchLimit = limit * 2;

      // Buscar historiales tanto del usuario actual como del usuario invitado
      const query = { $or: [{ userId }, { userId: 'guest-user' }] };

      const tracks = await collection
        .find(query)
        .sort({ playedAt: -1 })
        .limit(fetchLimit)
        .toArray();

      // Si no hay tracks, devolver array vacío en lugar de error
      if (!tracks || tracks.length === 0) {
        return NextResponse.json({
          tracks: [],
          total: 0,
          page,
          limit,
          hasMore: false
        });
      }

      // Eliminar duplicados
      const uniqueTracks = removeDuplicateTracks(tracks as IRecentTrack[]);

      // Ahora aplicamos paginación a los tracks únicos
      const paginatedTracks = uniqueTracks.slice(0, limit);

      return NextResponse.json({
        tracks: paginatedTracks,
        total: uniqueTracks.length,
        page,
        limit,
        hasMore: uniqueTracks.length > limit
      });
    } catch (dbError: any) {
      console.error('Error específico de base de datos:', dbError);

      // Detectar errores específicos
      let errorMessage = 'Error de conexión a la base de datos';

      if (dbError.message.includes('querySrv ENOTFOUND')) {
        errorMessage = 'Error de resolución DNS. Verifica la conexión a internet.';
      }

      // Devolver resultado vacío en caso de error de DB
      return NextResponse.json({
        tracks: [],
        total: 0,
        page,
        limit,
        hasMore: false,
        error: errorMessage
      });
    }
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    // En caso de error, devolver un array vacío en lugar de error 500
    return NextResponse.json({
      tracks: [],
      total: 0,
      page: 1,
      limit: 20,
      hasMore: false,
      error: 'Error al obtener el historial, mostrando lista vacía'
    });
  }
}

/**
 * POST /api/history
 * Añade una canción al historial del usuario
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar si estamos en modo demo
    const isDemoMode = API_CONFIG.isDemoMode();

    if (isDemoMode) {
      console.log('[API History] Modo demo activado - simulando añadir al historial');
      return NextResponse.json({
        success: true,
        message: 'Canción añadida al historial (modo demo)',
        userId: 'demo-user',
        demoMode: true
      });
    }

    // Obtener userId de cookies
    const userId = await getUserFromCookies();

    try {
      // Conectar a MongoDB
      const conn = await connectToDatabase();

      // Verificar que tengamos una conexión válida
      if (!conn || !conn.connection || !conn.connection.db) {
        throw new Error('Conexión a MongoDB no válida');
      }

      // Acceder a la colección directamente
      const collection = conn.connection.db.collection('recentTracks');

      // Obtener datos del cuerpo
      const data = await request.json();

      // Validar datos mínimos requeridos
      if (!data.trackId || !data.trackName || !data.artistName) {
        return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
      }

      // Crear objeto de track reciente
      const recentTrack = {
        userId,
        trackId: data.trackId,
        trackName: data.trackName,
        artistName: data.artistName,
        albumName: data.albumName || 'Unknown Album',
        albumCover: data.albumCover || '',
        playedAt: new Date(),
        source: data.source || 'local',
        sourceData: data.sourceData || {}
      };

      await collection.insertOne(recentTrack);

      // Revalidar ruta de historial para actualizar la UI
      revalidatePath('/history');

      return NextResponse.json({
        success: true,
        message: 'Canción añadida al historial',
        userId
      });
    } catch (dbError: any) {
      console.error('Error específico de base de datos:', dbError);

      // Detectar errores específicos
      let errorMessage = 'Error de conexión a la base de datos';

      if (dbError.message.includes('querySrv ENOTFOUND')) {
        errorMessage = 'Error de resolución DNS. Verifica la conexión a internet.';
      }

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (error) {
    console.error('Error añadiendo al historial:', error);
    return NextResponse.json({ error: 'Error al añadir la canción al historial' }, { status: 500 });
  }
}
