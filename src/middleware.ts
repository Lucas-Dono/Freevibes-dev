import { NextRequest, NextResponse } from 'next/server';

// Rutas públicas que no requieren autenticación
const publicRoutes = ['/login'];
const apiRoutes = ['/api/auth/spotify'];

export default function middleware(req: NextRequest) {
  const hasSpotifyToken = req.cookies.has('spotify_access_token');
  const { pathname } = req.nextUrl;
  
  // Permitir todas las solicitudes a la API de autenticación
  if (apiRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }
  
  // Verificar si es una ruta pública
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route));
  
  // Si no hay token y no es una ruta pública, redirigir a login
  if (!hasSpotifyToken && !isPublicRoute) {
    const url = new URL('/login', req.url);
    return NextResponse.redirect(url);
  }
  
  // Si hay token y es una ruta pública, redirigir a home
  if (hasSpotifyToken && isPublicRoute) {
    const url = new URL('/home', req.url);
    return NextResponse.redirect(url);
  }
  
  return NextResponse.next();
}

// Configurar el middleware para que se ejecute en todas las rutas excepto las estáticas
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}; 