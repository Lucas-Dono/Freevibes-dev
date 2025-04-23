import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  // NextAuth maneja el cierre de sesión en su propio endpoint (/api/auth/signout)
  // Esta ruta es solo para limpieza adicional o redirección

  // Limpiar cookies manuales que podríamos haber creado
  cookies().delete('spotify_user');
  cookies().delete('spotify_auth_state');
  cookies().delete('spotify_token_expiration');
  cookies().delete('spotify_refresh_token');
  cookies().delete('auth_token');


  // Redireccionar al login
  return NextResponse.redirect(new URL('/login?logout=success', request.url));
}
