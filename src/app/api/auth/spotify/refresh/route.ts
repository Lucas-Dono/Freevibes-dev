import { NextRequest, NextResponse } from 'next/server';
import querystring from 'querystring';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  // Obtener el token de refresco de las cookies
  const refreshToken = cookies().get('spotify_refresh_token')?.value;
  
  if (!refreshToken) {
    return NextResponse.json(
      { error: 'No refresh token found' },
      { status: 401 }
    );
  }
  
  try {
    // Solicitar un nuevo token de acceso
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')
      },
      body: querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });
    
    // Si la solicitud falla
    if (!response.ok) {
      // Eliminar las cookies si el token de refresco ya no es válido
      cookies().delete('spotify_access_token');
      cookies().delete('spotify_refresh_token');
      cookies().delete('spotify_user');
      
      return NextResponse.json(
        { error: 'Failed to refresh token' },
        { status: response.status }
      );
    }
    
    // Obtener los datos de la respuesta
    const data = await response.json();
    
    // Actualizar la cookie del token de acceso
    cookies().set({
      name: 'spotify_access_token',
      value: data.access_token,
      maxAge: data.expires_in,
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    // Si se recibió un nuevo token de refresco, actualizarlo también
    if (data.refresh_token) {
      cookies().set({
        name: 'spotify_refresh_token',
        value: data.refresh_token,
        maxAge: 30 * 24 * 60 * 60, // 30 días
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
    }
    
    // Devolver el nuevo token
    return NextResponse.json({
      access_token: data.access_token,
      expires_in: data.expires_in
    });
    
  } catch (error) {
    console.error('Error refreshing Spotify token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 