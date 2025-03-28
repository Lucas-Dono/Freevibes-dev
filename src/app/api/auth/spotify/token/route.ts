import { NextRequest, NextResponse } from 'next/server';

/**
 * Obtiene un token de cliente para Spotify mediante Client Credentials Flow
 * Este endpoint es utilizado por el componente GenreSelector para obtener
 * un token que permite acceder a recursos públicos de Spotify sin necesidad
 * de autenticación de usuario.
 */
export async function GET(request: NextRequest) {
  try {
    // Obtener credenciales de Spotify de las variables de entorno
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    
    // Verificar que tenemos las credenciales necesarias
    if (!clientId || !clientSecret) {
      console.error('[Spotify Token] Credenciales de Spotify no configuradas');
      return NextResponse.json(
        { error: 'Configuración de servidor incompleta' },
        { status: 500 }
      );
    }
    
    // Solicitar token mediante Client Credentials Flow
    console.log('[Spotify Token] Solicitando token de cliente');
    
    // Crear el cuerpo de la petición
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    
    // Realizar solicitud a la API de Spotify
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      body: params
    });
    
    // Verificar respuesta
    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[Spotify Token] Error al obtener token: ${response.status}`, errorData);
      return NextResponse.json(
        { error: 'Error al obtener token de Spotify' },
        { status: response.status }
      );
    }
    
    // Procesar y devolver el token
    const tokenData = await response.json();
    console.log('[Spotify Token] Token obtenido correctamente');
    
    return NextResponse.json({
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type
    });
    
  } catch (error) {
    console.error('[Spotify Token] Error inesperado:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
} 