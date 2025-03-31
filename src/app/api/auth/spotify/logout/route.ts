import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getLogoutRedirectUrl } from '@/lib/auth-config';

export async function GET(req: NextRequest) {
  // Eliminar todas las cookies relacionadas con Spotify
  cookies().delete('spotify_access_token');
  cookies().delete('spotify_refresh_token');
  cookies().delete('spotify_user');
  cookies().delete('spotify_access_token_expires');
  
  // Usar la nueva función para obtener la URL de redirección después del logout
  return NextResponse.redirect(getLogoutRedirectUrl());
} 