import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { upsertUserWithSpotifyInfo } from '@/lib/db/services/userService';
import { getSpotifyCallbackUrl, getBaseUrl } from '@/lib/auth-config';

export async function GET(request: NextRequest) {
  // Obtener los parámetros de la URL
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  
  // Debug para ver el estado recibido
  console.log('Callback recibido - Estado:', state);
  
  // Si hay un error en la respuesta de Spotify
  if (searchParams.has('error')) {
    console.error('Error en callback:', searchParams.get('error'));
    return NextResponse.redirect(new URL('/login?error=spotify_error', request.url));
  }
  
  // Verificar que tenemos código y estado
  if (!code || !state) {
    return NextResponse.redirect(new URL('/login?error=missing_params', request.url));
  }
  
  // Verificar el estado para prevenir CSRF
  const storedState = cookies().get('spotify_auth_state')?.value;
  console.log('Estado almacenado:', storedState);
  
  if (state !== storedState) {
    return NextResponse.redirect(new URL('/login?error=state_mismatch', request.url));
  }
  
  // Estado OK, continuar con el intercambio de código por token
  console.log('Recibido código de autorización:', code);
  
  try {
    // Configuración para Spotify
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    
    // Usar la nueva función para obtener la URL de callback
    const redirectUri = getSpotifyCallbackUrl();
    
    console.log('Usando redirect URI en callback:', redirectUri);
    
    if (!clientId || !clientSecret) {
      console.error('Credenciales de Spotify no configuradas');
      return NextResponse.redirect(new URL('/login?error=server_config', request.url));
    }
    
    // Crear el cuerpo de la petición
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    
    // Intercambiar código por token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    
    // Procesar respuesta
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Error al obtener token:', errorData);
      return NextResponse.redirect(new URL('/login?error=token_exchange', request.url));
    }
    
    // Token obtenido
    const tokenData = await tokenResponse.json();
    console.log('Token obtenido correctamente');
    
    // Obtener perfil de usuario
    const profileResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });
    
    if (!profileResponse.ok) {
      console.error('Error al obtener perfil de usuario');
      return NextResponse.redirect(new URL('/login?error=profile_fetch', request.url));
    }
    
    // Perfil obtenido
    const profileData = await profileResponse.json();
    console.log('Perfil obtenido:', profileData.display_name);
    
    // Guardar el usuario en MongoDB
    try {
      const user = await upsertUserWithSpotifyInfo(profileData);
      console.log('Usuario guardado en MongoDB:', user.name);
    } catch (dbError) {
      console.error('Error al guardar usuario en MongoDB:', dbError);
      // Continuamos con el flujo aunque la DB falle
    }
    
    // Guardar tokens en cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };
    
    // Establecer cookies
    const response = NextResponse.redirect(new URL('/home', request.url));
    
    // Token de acceso - usar expires_in de Spotify
    response.cookies.set('spotify_access_token', tokenData.access_token, {
      ...cookieOptions,
      maxAge: tokenData.expires_in
    });

    // Timestamp de expiración
    const expiresAt = Date.now() + (tokenData.expires_in * 1000);
    response.cookies.set('spotify_access_token_expires', expiresAt.toString(), {
      ...cookieOptions,
      maxAge: tokenData.expires_in
    });
    
    // Token de refresco - 30 días
    response.cookies.set('spotify_refresh_token', tokenData.refresh_token, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60
    });
    
    // Información básica del perfil - 30 días
    response.cookies.set('spotify_user', JSON.stringify({
      id: profileData.id,
      name: profileData.display_name,
      email: profileData.email,
      images: profileData.images,
    }), {
      ...cookieOptions,
      httpOnly: false,
      maxAge: 30 * 24 * 60 * 60
    });
    
    return response;
    
  } catch (error) {
    console.error('Error en el callback de Spotify:', error);
    return NextResponse.redirect(new URL('/login?error=server_error', request.url));
  }
} 