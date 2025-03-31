import { NextRequest, NextResponse } from 'next/server';
import querystring from 'querystring';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  console.log('[Spotify Refresh] Iniciando proceso de refresh');
  
  // Obtener el token de refresco de las cookies
  const refreshToken = cookies().get('spotify_refresh_token')?.value;
  const accessToken = cookies().get('spotify_access_token')?.value;
  
  console.log('[Spotify Refresh] Estado de tokens:', {
    hasRefreshToken: !!refreshToken,
    hasAccessToken: !!accessToken
  });
  
  if (!refreshToken) {
    console.error('[Spotify Refresh] No se encontró el token de refresco');
    return NextResponse.json(
      { error: 'No refresh token found' },
      { status: 401 }
    );
  }
  
  try {
    // Verificar credenciales de Spotify
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      console.error('[Spotify Refresh] Credenciales de Spotify no configuradas');
      return NextResponse.json(
        { error: 'Spotify credentials not configured' },
        { status: 500 }
      );
    }
    
    console.log('[Spotify Refresh] Solicitando nuevo token de acceso');
    
    // Solicitar un nuevo token de acceso
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(
          `${clientId}:${clientSecret}`
        ).toString('base64')
      },
      body: querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });
    
    // Si la solicitud falla
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Spotify Refresh] Error al refrescar token:', errorData);
      
      // Eliminar las cookies si el token de refresco ya no es válido
      cookies().delete('spotify_access_token');
      cookies().delete('spotify_refresh_token');
      cookies().delete('spotify_user');
      
      return NextResponse.json(
        { error: 'Failed to refresh token', details: errorData },
        { status: response.status }
      );
    }
    
    // Obtener los datos de la respuesta
    const data = await response.json();
    console.log('[Spotify Refresh] Nuevo token obtenido, actualizando cookies');
    
    const cookieOptions = {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const
    };

    // Actualizar la cookie del token de acceso
    cookies().set({
      name: 'spotify_access_token',
      value: data.access_token,
      ...cookieOptions,
      maxAge: data.expires_in
    });

    // Actualizar timestamp de expiración
    const expiresAt = Date.now() + (data.expires_in * 1000);
    cookies().set({
      name: 'spotify_access_token_expires',
      value: expiresAt.toString(),
      ...cookieOptions,
      maxAge: data.expires_in
    });
    
    // Si se recibió un nuevo token de refresco, actualizarlo también
    if (data.refresh_token) {
      console.log('[Spotify Refresh] Actualizando token de refresco');
      cookies().set({
        name: 'spotify_refresh_token',
        value: data.refresh_token,
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60 // 30 días
      });
    }
    
    console.log('[Spotify Refresh] Proceso completado exitosamente');
    
    // Devolver el nuevo token
    return NextResponse.json({
      access_token: data.access_token,
      expires_in: data.expires_in
    });
    
  } catch (error) {
    console.error('[Spotify Refresh] Error interno:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 