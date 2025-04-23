import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

// Marcar esta ruta como dinámica
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verificar si estamos en modo demo desde las cookies o los headers
    const demoModeCookie = request.cookies.get('demo-mode')?.value === 'true' || request.cookies.get('demoMode')?.value === 'true';
    const demoModeHeader = request.headers.get('x-demo-mode') === 'true';
    const isDemoMode = demoModeCookie || demoModeHeader;

    // Si estamos en modo demo, devolver un token ficticio
    if (isDemoMode) {
      console.log('[API AUTH] Solicitud de token en modo demo, devolviendo token ficticio');
      return Response.json({
        access_token: 'demo-mode-token-xxxxxx',
        token_type: 'Bearer',
        expires_in: 3600,
        demo_mode: true
      });
    }

    // Obtener sesión del usuario
    const session = await getServerSession(authOptions);

    // Verificar si hay sesión y token de acceso
    if (!session || !session.accessToken) {
      console.error('[API] Token no disponible, usuario no autenticado');
      return Response.json({
        error: 'No autenticado',
        message: 'Se requiere autenticación con Spotify'
      }, { status: 401 });
    }

    // Devolver el token de acceso
    return Response.json({
      access_token: session.accessToken,
      token_type: 'Bearer'
    });
  } catch (error) {
    console.error('[API] Error al obtener token de Spotify:', error);
    return Response.json({
      error: 'Error en la API',
      message: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
