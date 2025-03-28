import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  // Eliminar todas las cookies relacionadas con Spotify
  cookies().delete('spotify_access_token');
  cookies().delete('spotify_refresh_token');
  cookies().delete('spotify_user');
  
  // Redirigir a la página de inicio de sesión
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`);
} 