import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  
  // Obtener cookies
  const cookieStore = cookies();
  
  // Eliminar todas las cookies relacionadas con Spotify
  cookieStore.delete('spotify_refresh_token');
  cookieStore.delete('auth_token');
  cookieStore.delete('spotify_token_expiration');
  cookieStore.delete('spotify_user');
  cookieStore.delete('spotify_auth_state');
  
  
  // Redireccionar al usuario a la página de login
  return NextResponse.redirect(new URL('/login', request.url));
} 